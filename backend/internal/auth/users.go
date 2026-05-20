package auth

import (
	"errors"
	"fmt"
	"os"
	"os/user"

	"golang.org/x/crypto/bcrypt"
)

// devUsers is active only when KURA_DEV_MODE=1.
// Never compiled into production builds.
var devUsers = map[string]string{
	"admin": "admin",
}

// VerifyPassword checks username + bcrypt password against the local user store.
// Returns (ok, totpRequired, error).
func VerifyPassword(username, password string) (bool, bool, error) {
	// Dev mode bypass — KURA_DEV_MODE=1 only
	if os.Getenv("KURA_DEV_MODE") == "1" {
		if pass, ok := devUsers[username]; ok && pass == password {
			return true, false, nil
		}
		return false, false, nil
	}

	// Validate username exists on the system
	if _, err := user.Lookup(username); err != nil {
		return false, false, nil
	}

	hash, err := loadPasswordHash(username)
	if err != nil {
		return false, false, fmt.Errorf("load password hash: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, false, nil
		}
		return false, false, err
	}

	totpEnabled, err := hasTOTP(username)
	if err != nil {
		return false, false, err
	}
	return true, totpEnabled, nil
}

// HashPassword returns a bcrypt hash of the given password.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// loadPasswordHash is a stub — replace with config store.
func loadPasswordHash(username string) (string, error) {
	// TODO: query config store: SELECT password_hash FROM users WHERE username=?
	return "", fmt.Errorf("user %q not in kura store", username)
}

// hasTOTP is a stub — replace with config store.
func hasTOTP(username string) (bool, error) {
	// TODO: query config store: SELECT totp_secret FROM users WHERE username=?
	return false, nil
}
