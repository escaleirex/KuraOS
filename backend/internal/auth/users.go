package auth

import (
	"context"
	"fmt"
	"os"
	"os/user"
	"time"

	"github.com/kura-os/kura/backend/pkg/config"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

// devUsers is active only when KURA_DEV_MODE=1.
var devUsers = map[string]string{
	"admin": "admin",
}

// VerifyPassword authenticates a user via PAM (through kura-helper).
// Returns (ok, totpRequired, error).
func VerifyPassword(store *config.Store, username, password string) (bool, bool, error) {
	// Dev accounts (admin/admin) always work regardless of helper state.
	if os.Getenv("KURA_DEV_MODE") == "1" {
		if pass, ok := devUsers[username]; ok && pass == password {
			totpEnabled, err := hasTOTP(store, username)
			if err != nil {
				return false, false, err
			}
			return true, totpEnabled, nil
		}
	}

	// Ensure the user exists on the system before hitting PAM.
	if _, err := user.Lookup(username); err != nil {
		return false, false, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reply, err := ipc.Call(ctx, ipc.Op{
		Action: "auth.pam_verify",
		Params: map[string]string{
			"username": username,
			"password": password,
		},
	})
	if err != nil {
		if os.Getenv("KURA_DEV_MODE") == "1" {
			return false, false, fmt.Errorf("kura-helper not running — start with: sudo ./dist/kura-helper")
		}
		return false, false, fmt.Errorf("pam verify: %w", err)
	}
	if !reply.OK {
		return false, false, nil
	}

	totpEnabled, err := hasTOTP(store, username)
	if err != nil {
		return false, false, err
	}
	return true, totpEnabled, nil
}

// HashPassword returns a bcrypt hash of the given password.
// Used for TOTP setup and future local user creation flows.
func HashPassword(password string) (string, error) {
	return "", fmt.Errorf("not implemented: use PAM for authentication")
}

func hasTOTP(store *config.Store, username string) (bool, error) {
	return TOTPEnabled(store, username)
}
