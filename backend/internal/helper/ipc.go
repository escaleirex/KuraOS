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

	// Allow group access so kura-daemon (running as non-root) can connect
	if err := os.Chmod(s.socketPath, 0660); err != nil {
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
	case "network.wifi_set_enabled":
		return ops.WifiSetEnabled(op.Params)
	case "network.wifi_scan":
		return ops.WifiScan(op.Params)
	case "network.wifi_connect":
		return ops.WifiConnect(op.Params)
	case "network.eth_get_config":
		return ops.EthGetConfig(op.Params)
	case "network.eth_set_config":
		return ops.EthSetConfig(op.Params)

	// System
	case "system.service_start":
		return ops.ServiceStart(op.Params)
	case "system.service_stop":
		return ops.ServiceStop(op.Params)
	case "system.service_restart":
		return ops.ServiceRestart(op.Params)
	case "system.service_status":
		return ops.ServiceStatus(op.Params)
	case "system.service_enable":
		return ops.ServiceEnable(op.Params)
	case "system.service_disable":
		return ops.ServiceDisable(op.Params)
	case "system.service_enabled":
		return ops.ServiceEnabled(op.Params)
	case "system.modprobe":
		return ops.Modprobe(op.Params)
	case "system.set_locale":
		return ops.SetLocale(op.Params)
	case "system.set_cpu_governor":
		return ops.SetCPUGovernor(op.Params)
	case "system.set_disk_spindown":
		return ops.SetDiskSpindown(op.Params)
	case "system.set_wol":
		return ops.SetWoL(op.Params)
	case "system.set_timezone":
		return ops.SetTimezone(op.Params)
	case "system.set_ntp":
		return ops.SetNTP(op.Params)
	case "system.set_time_manual":
		return ops.SetTimeManual(op.Params)
	case "system.list_timezones":
		return ops.ListTimezones(op.Params)

	// SSH
	case "ssh.apply_config":
		return ops.ApplySSHConfig(op.Params)
	case "ssh.add_key":
		return ops.AddAuthorizedKey(op.Params)
	case "ssh.remove_key":
		return ops.RemoveAuthorizedKey(op.Params)

	// Auth
	case "auth.pam_verify":
		return ops.PAMVerify(op.Params)

	// Users
	case "users.list":
		return ops.UserList(op.Params)
	case "users.create":
		return ops.UserCreate(op.Params)
	case "users.delete":
		return ops.UserDelete(op.Params)
	case "users.set_password":
		return ops.UserSetPassword(op.Params)
	case "users.set_role":
		return ops.UserSetRole(op.Params)
	case "users.set_samba":
		return ops.UserSetSamba(op.Params)

	// Remote Desktop
	case "remotedesktop.setup_rdp":
		return ops.SetupRDP(op.Params)
	case "remotedesktop.setup_vnc":
		return ops.SetupVNC(op.Params)
	case "remotedesktop.install_desktop":
		return ops.InstallDesktop(op.Params)
	case "remotedesktop.status":
		return ops.RemoteDesktopStatus(op.Params)

	// Updates
	case "updates.check":
		return ops.CheckUpdates(op.Params)
	case "updates.install":
		return ops.InstallUpdates(op.Params)

	default:
		return ipc.Reply{OK: false, Error: fmt.Sprintf("unknown action: %q", op.Action)}
	}
}
