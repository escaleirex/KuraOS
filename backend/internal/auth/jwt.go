package auth

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = func() []byte {
	if s := os.Getenv("KURA_JWT_SECRET"); s != "" {
		return []byte(s)
	}
	// Fallback: read from /var/lib/kura/jwt.secret (written by installer)
	data, err := os.ReadFile("/var/lib/kura/jwt.secret")
	if err == nil {
		return data
	}
	panic("KURA_JWT_SECRET not set and /var/lib/kura/jwt.secret not found")
}()

type Claims struct {
	jwt.RegisteredClaims
	Username string `json:"username"`
	Admin    bool   `json:"admin"`
}

// IssueJWT creates a signed access token valid for 8 hours.
func IssueJWT(username string) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
			Issuer:    "kura-daemon",
		},
		Username: username,
		Admin:    username == "admin", // TODO: load from user store
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ParseJWT validates and parses a token string.
func ParseJWT(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}
