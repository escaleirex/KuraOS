package ops

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

const sshdConfigPath = "/etc/ssh/sshd_config.d/kura.conf"

var reSSHKeyType = regexp.MustCompile(`^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com)\s+`)

// ApplySSHConfig writes /etc/ssh/sshd_config.d/kura.conf and restarts or stops sshd.
// Required params: enabled ("true"/"false"), port, password_auth ("true"/"false"), root_login ("true"/"false")
func ApplySSHConfig(params map[string]string) ipc.Reply {
	enabled := params["enabled"] == "true"
	port := params["port"]
	passwordAuth := params["password_auth"] == "true"
	rootLogin := params["root_login"] == "true"

	if port == "" {
		port = "22"
	}
	p, err := strconv.Atoi(port)
	if err != nil || p < 1 || p > 65535 {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid port: %q", port)}
	}

	if !enabled {
		res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "stop", "sshd")
		if err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}
		return ipc.Reply{OK: true}
	}

	boolDirective := func(b bool) string {
		if b {
			return "yes"
		}
		return "no"
	}
	rootDirective := "no"
	if rootLogin {
		rootDirective = "yes"
	}

	var buf bytes.Buffer
	fmt.Fprintf(&buf, "# Managed by kura — do not edit manually\n")
	fmt.Fprintf(&buf, "Port %s\n", port)
	fmt.Fprintf(&buf, "PasswordAuthentication %s\n", boolDirective(passwordAuth))
	fmt.Fprintf(&buf, "PermitRootLogin %s\n", rootDirective)

	if err := os.MkdirAll(filepath.Dir(sshdConfigPath), 0755); err != nil {
		return errReply(fmt.Errorf("mkdir sshd_config.d: %w", err))
	}
	if err := os.WriteFile(sshdConfigPath, buf.Bytes(), 0644); err != nil {
		return errReply(fmt.Errorf("write sshd config: %w", err))
	}

	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "restart", "sshd")
	if err != nil {
		return ipc.Reply{OK: false, Error: res.Stderr}
	}
	return ipc.Reply{OK: true}
}

// AddAuthorizedKey appends a validated public key to the authorized_keys file.
// Required params: key, user (default: "root")
func AddAuthorizedKey(params map[string]string) ipc.Reply {
	key := strings.TrimSpace(params["key"])
	user := params["user"]
	if user == "" {
		user = "root"
	}

	if !reSSHKeyType.MatchString(key) {
		return ipc.Reply{OK: false, Error: "unsupported or invalid public key format"}
	}
	// Reject multi-line
	if strings.ContainsAny(key, "\n\r") {
		return ipc.Reply{OK: false, Error: "key must be a single line"}
	}

	authKeysPath, err := authorizedKeysPath(user)
	if err != nil {
		return errReply(err)
	}

	if err := os.MkdirAll(filepath.Dir(authKeysPath), 0700); err != nil {
		return errReply(fmt.Errorf("mkdir .ssh: %w", err))
	}

	f, err := os.OpenFile(authKeysPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return errReply(fmt.Errorf("open authorized_keys: %w", err))
	}
	defer f.Close()

	if _, err := fmt.Fprintln(f, key); err != nil {
		return errReply(fmt.Errorf("write key: %w", err))
	}
	return ipc.Reply{OK: true}
}

// RemoveAuthorizedKey removes the key at 1-based line index from authorized_keys.
// Required params: line, user (default: "root")
func RemoveAuthorizedKey(params map[string]string) ipc.Reply {
	user := params["user"]
	if user == "" {
		user = "root"
	}
	lineNum, err := strconv.Atoi(params["line"])
	if err != nil || lineNum < 1 {
		return ipc.Reply{OK: false, Error: "invalid line param"}
	}

	authKeysPath, err := authorizedKeysPath(user)
	if err != nil {
		return errReply(err)
	}

	data, err := os.ReadFile(authKeysPath)
	if err != nil {
		return errReply(fmt.Errorf("read authorized_keys: %w", err))
	}

	var lines []string
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	if lineNum > len(lines) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("line %d out of range (%d lines)", lineNum, len(lines))}
	}

	lines = append(lines[:lineNum-1], lines[lineNum:]...)
	newData := []byte(strings.Join(lines, "\n"))
	if len(lines) > 0 {
		newData = append(newData, '\n')
	}

	tmp := authKeysPath + ".tmp"
	if err := os.WriteFile(tmp, newData, 0600); err != nil {
		return errReply(fmt.Errorf("write tmp: %w", err))
	}
	if err := os.Rename(tmp, authKeysPath); err != nil {
		return errReply(fmt.Errorf("rename: %w", err))
	}
	return ipc.Reply{OK: true}
}

func authorizedKeysPath(user string) (string, error) {
	if user == "root" {
		return "/root/.ssh/authorized_keys", nil
	}
	// Validate username — no path traversal
	if !regexp.MustCompile(`^[a-z_][a-z0-9_\-]{0,31}$`).MatchString(user) {
		return "", fmt.Errorf("invalid username: %q", user)
	}
	return fmt.Sprintf("/home/%s/.ssh/authorized_keys", user), nil
}
