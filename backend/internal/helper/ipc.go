package helper

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"os"

	"github.com/kura-os/kura/backend/internal/helper/ops"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

// Server listens on the Unix socket and dispatches privileged operations.
type Server struct {
	socketPath string
}

func NewServer(socketPath string) *Server {
	return &Server{socketPath: socketPath}
}

func (s *Server) Listen() error {
	os.Remove(s.socketPath)
	ln, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("listen unix socket: %w", err)
	}
	defer ln.Close()

	// Restrict to root:kura only
	if err := os.Chmod(s.socketPath, 0600); err != nil {
		return fmt.Errorf("chmod socket: %w", err)
	}

	for {
		conn, err := ln.Accept()
		if err != nil {
			slog.Error("accept", "err", err)
			continue
		}
		go s.handle(conn)
	}
}

func (s *Server) handle(conn net.Conn) {
	defer conn.Close()

	var op ipc.Op
	dec := json.NewDecoder(conn)
	if err := dec.Decode(&op); err != nil {
		slog.Error("decode op", "err", err)
		return
	}

	slog.Info("helper op", "action", op.Action, "params", op.Params)

	reply := dispatch(op)

	enc := json.NewEncoder(conn)
	if err := enc.Encode(reply); err != nil {
		slog.Error("encode reply", "err", err)
	}
}

// dispatch routes the action to the correct handler.
// ALL allowed actions are listed explicitly — unknown actions are rejected.
func dispatch(op ipc.Op) ipc.Reply {
	switch op.Action {
	// Storage
	case "storage.mount":
		return ops.Mount(op.Params)
	case "storage.umount":
		return ops.Umount(op.Params)
	case "storage.chown_share":
		return ops.ChownShare(op.Params)
	case "storage.format_btrfs":
		return ops.FormatBtrfs(op.Params)
	case "storage.format_ext4":
		return ops.FormatExt4(op.Params)

	// Network
	case "network.ufw_allow":
		return ops.UFWAllow(op.Params)
	case "network.ufw_deny":
		return ops.UFWDeny(op.Params)
	case "network.tailscale_up":
		return ops.TailscaleUp(op.Params)
	case "network.tailscale_down":
		return ops.TailscaleDown(op.Params)

	// System
	case "system.service_restart":
		return ops.ServiceRestart(op.Params)
	case "system.service_status":
		return ops.ServiceStatus(op.Params)
	case "system.modprobe":
		return ops.Modprobe(op.Params)

	default:
		return ipc.Reply{OK: false, Error: fmt.Sprintf("unknown action: %q", op.Action)}
	}
}
