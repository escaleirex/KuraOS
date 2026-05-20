package config

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"

	_ "github.com/mattn/go-sqlite3"
)

const schema = `
CREATE TABLE IF NOT EXISTS kv (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`

type Store struct {
	mu sync.RWMutex
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if _, err = db.Exec(schema); err != nil {
		return nil, fmt.Errorf("init schema: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Set(key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err = s.db.Exec(`INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, string(b))
	return err
}

func (s *Store) Get(key string, dst any) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var raw string
	if err := s.db.QueryRow(`SELECT value FROM kv WHERE key=?`, key).Scan(&raw); err != nil {
		return err
	}
	return json.Unmarshal([]byte(raw), dst)
}

func (s *Store) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec(`DELETE FROM kv WHERE key=?`, key)
	return err
}
