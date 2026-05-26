package ops

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

var reUserName = regexp.MustCompile(`^[a-z_][a-z0-9_\-\.]{0,31}$`)

var reservedUsers = map[string]bool{
	"root": true, "daemon": true, "bin": true, "sys": true, "sync": true,
	"games": true, "man": true, "lp": true, "mail": true, "news": true,
	"uucp": true, "proxy": true, "www-data": true, "backup": true,
	"list": true, "irc": true, "gnats": true, "nobody": true, "kura": true,
}

type UserEntry struct {
	Username  string `json:"username"`
	Role      string `json:"role"`
	Samba     bool   `json:"samba"`
	LastLogin string `json:"lastLogin"`
}

// UserList returns all human system users (UID >= 1000, excluding nobody/nologin).
func UserList(_ map[string]string) ipc.Reply {
	ctx := context.Background()

	res, err := kexec.Run(ctx, 10*time.Second, "getent", "passwd")
	if err != nil {
		return errReply(fmt.Errorf("getent passwd: %w", err))
	}

	// Build sudo member set from /etc/group
	sudoMembers := map[string]bool{}
	if grpRes, err := kexec.Run(ctx, 5*time.Second, "getent", "group", "sudo"); err == nil {
		// Format: sudo:x:27:user1,user2
		parts := strings.Split(strings.TrimSpace(grpRes.Stdout), ":")
		if len(parts) == 4 && parts[3] != "" {
			for _, m := range strings.Split(parts[3], ",") {
				sudoMembers[strings.TrimSpace(m)] = true
			}
		}
	}

	// Build samba user set from pdbedit -L
	sambaUsers := map[string]bool{}
	if pdbRes, err := kexec.Run(ctx, 5*time.Second, "pdbedit", "-L"); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(pdbRes.Stdout))
		for scanner.Scan() {
			// Format: username:uid:full_name
			parts := strings.SplitN(scanner.Text(), ":", 2)
			if len(parts) >= 1 && parts[0] != "" {
				sambaUsers[parts[0]] = true
			}
		}
	}

	var users []UserEntry
	scanner := bufio.NewScanner(strings.NewReader(res.Stdout))
	for scanner.Scan() {
		parts := strings.Split(scanner.Text(), ":")
		if len(parts) < 7 {
			continue
		}
		uid, err := strconv.Atoi(parts[2])
		if err != nil || uid < 1000 || uid == 65534 {
			continue
		}
		shell := parts[6]
		if shell == "/usr/sbin/nologin" || shell == "/bin/false" || shell == "/sbin/nologin" {
			continue
		}
		username := parts[0]
		role := "user"
		if sudoMembers[username] {
			role = "admin"
		}
		users = append(users, UserEntry{
			Username:  username,
			Role:      role,
			Samba:     sambaUsers[username],
			LastLogin: lastLoginFor(username),
		})
	}

	if users == nil {
		users = []UserEntry{}
	}
	out, err := json.Marshal(users)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: string(out)}
}

// UserCreate creates a new system user.
// Required params: username, password, role ("admin"|"user"), samba ("true"|"false")
func UserCreate(params map[string]string) ipc.Reply {
	username := params["username"]
	password := params["password"]
	role := params["role"]
	samba := params["samba"] == "true"

	if err := validateUser(username); err != nil {
		return errReply(err)
	}
	if reservedUsers[username] {
		return ipc.Reply{OK: false, Error: "username is reserved"}
	}
	if len(password) < 8 {
		return ipc.Reply{OK: false, Error: "password too short (minimum 8 characters)"}
	}
	if role != "admin" && role != "user" {
		return ipc.Reply{OK: false, Error: "role must be admin or user"}
	}

	ctx := context.Background()

	if _, err := kexec.Run(ctx, 30*time.Second, "useradd", "-m", "-s", "/bin/bash", username); err != nil {
		return errReply(fmt.Errorf("useradd: %w", err))
	}

	if _, err := kexec.RunWithStdin(ctx, 10*time.Second, fmt.Sprintf("%s:%s", username, password), "chpasswd"); err != nil {
		kexec.Run(ctx, 10*time.Second, "userdel", "-r", username) //nolint:errcheck
		return errReply(fmt.Errorf("chpasswd: %w", err))
	}

	if role == "admin" {
		if _, err := kexec.Run(ctx, 10*time.Second, "usermod", "-aG", "sudo", username); err != nil {
			return errReply(fmt.Errorf("usermod: %w", err))
		}
	}

	if samba {
		sambaInput := fmt.Sprintf("%s\n%s\n", password, password)
		kexec.RunWithStdin(ctx, 10*time.Second, sambaInput, "smbpasswd", "-a", "-s", username) //nolint:errcheck
	}

	return ipc.Reply{OK: true}
}

// UserDelete removes a system user and their home directory.
// Required params: username
func UserDelete(params map[string]string) ipc.Reply {
	username := params["username"]
	if err := validateUser(username); err != nil {
		return errReply(err)
	}
	if username == "admin" {
		return ipc.Reply{OK: false, Error: "cannot delete the admin user"}
	}

	ctx := context.Background()
	kexec.Run(ctx, 10*time.Second, "smbpasswd", "-x", username) //nolint:errcheck

	if _, err := kexec.Run(ctx, 30*time.Second, "userdel", "-r", username); err != nil {
		return errReply(fmt.Errorf("userdel: %w", err))
	}
	return ipc.Reply{OK: true}
}

// UserSetPassword changes a user's system password.
// Required params: username, password
func UserSetPassword(params map[string]string) ipc.Reply {
	username := params["username"]
	password := params["password"]
	if err := validateUser(username); err != nil {
		return errReply(err)
	}
	if len(password) < 8 {
		return ipc.Reply{OK: false, Error: "password too short (minimum 8 characters)"}
	}

	if _, err := kexec.RunWithStdin(context.Background(), 10*time.Second,
		fmt.Sprintf("%s:%s", username, password), "chpasswd"); err != nil {
		return errReply(fmt.Errorf("chpasswd: %w", err))
	}
	return ipc.Reply{OK: true}
}

// UserSetRole adds or removes a user from the sudo group.
// Required params: username, role ("admin"|"user")
func UserSetRole(params map[string]string) ipc.Reply {
	username := params["username"]
	role := params["role"]
	if err := validateUser(username); err != nil {
		return errReply(err)
	}
	if role != "admin" && role != "user" {
		return ipc.Reply{OK: false, Error: "role must be admin or user"}
	}
	if username == "admin" && role == "user" {
		return ipc.Reply{OK: false, Error: "cannot demote the admin user"}
	}

	ctx := context.Background()
	if role == "admin" {
		if _, err := kexec.Run(ctx, 10*time.Second, "usermod", "-aG", "sudo", username); err != nil {
			return errReply(fmt.Errorf("usermod: %w", err))
		}
	} else {
		if _, err := kexec.Run(ctx, 10*time.Second, "gpasswd", "-d", username, "sudo"); err != nil {
			return errReply(fmt.Errorf("gpasswd: %w", err))
		}
	}
	return ipc.Reply{OK: true}
}

// UserSetSamba enables or disables Samba access.
// Required params: username, enabled ("true"|"false"), password (required when enabling)
func UserSetSamba(params map[string]string) ipc.Reply {
	username := params["username"]
	enabled := params["enabled"] == "true"
	password := params["password"]
	if err := validateUser(username); err != nil {
		return errReply(err)
	}

	ctx := context.Background()
	if enabled {
		if len(password) < 8 {
			return ipc.Reply{OK: false, Error: "password required to enable Samba (minimum 8 characters)"}
		}
		sambaInput := fmt.Sprintf("%s\n%s\n", password, password)
		if _, err := kexec.RunWithStdin(ctx, 10*time.Second, sambaInput, "smbpasswd", "-a", "-s", username); err != nil {
			return errReply(fmt.Errorf("smbpasswd: %w", err))
		}
	} else {
		if _, err := kexec.Run(ctx, 10*time.Second, "smbpasswd", "-x", username); err != nil {
			return errReply(fmt.Errorf("smbpasswd: %w", err))
		}
	}
	return ipc.Reply{OK: true}
}

func validateUser(username string) error {
	if !reUserName.MatchString(username) {
		return fmt.Errorf("invalid username: %q", username)
	}
	return nil
}

func lastLoginFor(username string) string {
	res, err := kexec.Run(context.Background(), 5*time.Second, "lastlog", "-u", username)
	if err != nil || res == nil {
		return "Never"
	}
	lines := strings.Split(strings.TrimSpace(res.Stdout), "\n")
	if len(lines) < 2 {
		return "Never"
	}
	data := strings.TrimSpace(lines[1])
	if strings.Contains(data, "**Never logged in**") {
		return "Never"
	}
	// lastlog output fields: username port from date...
	// Skip the username field and return the rest
	fields := strings.Fields(data)
	if len(fields) >= 5 {
		return strings.Join(fields[len(fields)-5:], " ")
	}
	return "Never"
}
