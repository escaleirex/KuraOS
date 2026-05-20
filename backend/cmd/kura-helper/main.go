package main

import (
	"log/slog"
	"os"

	"github.com/kura-os/kura/backend/internal/helper"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if os.Getuid() != 0 {
		slog.Error("kura-helper must run as root")
		os.Exit(1)
	}

	socketPath := "/run/kura/helper.sock"
	if err := os.MkdirAll("/run/kura", 0750); err != nil {
		slog.Error("create socket dir", "err", err)
		os.Exit(1)
	}

	srv := helper.NewServer(socketPath)
	slog.Info("kura-helper listening", "socket", socketPath)
	if err := srv.Listen(); err != nil {
		slog.Error("helper server error", "err", err)
		os.Exit(1)
	}
}
