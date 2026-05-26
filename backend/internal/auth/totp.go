package auth

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"time"

	"github.com/kura-os/kura/backend/pkg/config"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// TOTPSecret wraps the provisioning info for a new TOTP setup.
type TOTPSecret struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauth_url"`
}

// GenerateTOTPSecret creates a new TOTP secret for a user.
func GenerateTOTPSecret(username string) (*TOTPSecret, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "KuraOS",
		AccountName: username,
		SecretSize:  20,
		Algorithm:   otp.AlgorithmSHA1,
		Digits:      otp.DigitsSix,
		Period:      30,
	})
	if err != nil {
		return nil, fmt.Errorf("generate totp: %w", err)
	}
	return &TOTPSecret{
		Secret:     key.Secret(),
		OTPAuthURL: key.URL(),
	}, nil
}

// ValidateTOTPCode checks a 6-digit code against the stored secret.
func ValidateTOTPCode(secret, code string) bool {
	return totp.Validate(code, secret)
}

// VerifyTOTP looks up the user's TOTP secret and validates the code.
func VerifyTOTP(store *config.Store, username, code string) (bool, error) {
	secret, err := loadTOTPSecret(store, username)
	if err != nil {
		return false, err
	}
	return totp.Validate(code, secret), nil
}

// TOTPEnabled reports whether TOTP is configured for the user.
func TOTPEnabled(store *config.Store, username string) (bool, error) {
	var s string
	if err := store.Get(totpKey(username), &s); err != nil {
		return false, nil // key absent → not enabled
	}
	return s != "", nil
}

// EnableTOTP persists the TOTP secret, marking 2FA active.
func EnableTOTP(store *config.Store, username, secret string) error {
	if err := store.Set(totpKey(username), secret); err != nil {
		return fmt.Errorf("enable totp: %w", err)
	}
	_ = store.Delete(pendingKey(username))
	return nil
}

// DisableTOTP removes the TOTP secret.
func DisableTOTP(store *config.Store, username string) error {
	return store.Delete(totpKey(username))
}

// StorePendingSecret saves a not-yet-confirmed TOTP secret during setup.
func StorePendingSecret(store *config.Store, username, secret string) error {
	return store.Set(pendingKey(username), secret)
}

// LoadAndClearPendingSecret retrieves and deletes the pending secret.
func LoadAndClearPendingSecret(store *config.Store, username string) (string, error) {
	var s string
	if err := store.Get(pendingKey(username), &s); err != nil || s == "" {
		return "", fmt.Errorf("no pending TOTP setup for %q", username)
	}
	_ = store.Delete(pendingKey(username))
	return s, nil
}

// GenerateRandomSecret generates a raw base32 secret (for fallback use).
func GenerateRandomSecret() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base32.StdEncoding.EncodeToString(b), nil
}

// CurrentTOTPCode returns the current code for a secret (useful for testing).
func CurrentTOTPCode(secret string) (string, error) {
	return totp.GenerateCode(secret, time.Now())
}

func loadTOTPSecret(store *config.Store, username string) (string, error) {
	var s string
	if err := store.Get(totpKey(username), &s); err != nil || s == "" {
		return "", fmt.Errorf("TOTP not configured for %q", username)
	}
	return s, nil
}

func totpKey(username string) string   { return "totp:" + username + ":secret" }
func pendingKey(username string) string { return "totp:" + username + ":pending" }
