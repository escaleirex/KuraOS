package auth

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// TOTPSecret wraps the provisioning info for a new TOTP setup.
type TOTPSecret struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauth_url"`
	QRCodeURL  string `json:"qr_code_url"` // base64 PNG data URI
}

// GenerateTOTPSecret creates a new TOTP secret for a user.
func GenerateTOTPSecret(username string) (*TOTPSecret, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "KuraOS",
		AccountName: username,
		SecretSize:  32,
		Rand:        rand.Reader,
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
// Uses a 1-period skew window to account for clock drift.
func ValidateTOTPCode(secret, code string) bool {
	return totp.Validate(code, secret)
}

// VerifyTOTP looks up the user's TOTP secret and validates the code.
// TODO: load secret from secure store (currently stub).
func VerifyTOTP(username, code string) (bool, error) {
	secret, err := loadTOTPSecret(username)
	if err != nil {
		return false, err
	}
	valid := totp.Validate(code, secret)
	return valid, nil
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

// loadTOTPSecret is a stub — replace with config store lookup.
func loadTOTPSecret(username string) (string, error) {
	// TODO: query config store for user TOTP secret
	return "", fmt.Errorf("user %q not found", username)
}
