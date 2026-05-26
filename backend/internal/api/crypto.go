package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/kura-os/kura/backend/pkg/config"
)

const encryptKeyStorageKey = "sys:encrypt_key"

func loadOrGenKey(store *config.Store) ([]byte, error) {
	var hexKey string
	if err := store.Get(encryptKeyStorageKey, &hexKey); err == nil {
		key, err := hex.DecodeString(hexKey)
		if err != nil {
			return nil, fmt.Errorf("decode encrypt key: %w", err)
		}
		return key, nil
	}

	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generate encrypt key: %w", err)
	}
	if err := store.Set(encryptKeyStorageKey, hex.EncodeToString(key)); err != nil {
		return nil, fmt.Errorf("persist encrypt key: %w", err)
	}
	return key, nil
}

func encryptField(key []byte, plaintext string) (string, error) {
	if len(plaintext) == 0 {
		return "", nil
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptField(key []byte, ciphertext string) (string, error) {
	if len(ciphertext) == 0 {
		return "", nil
	}
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertextBytes := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
