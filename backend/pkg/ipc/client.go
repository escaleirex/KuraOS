package ipc

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"time"
)

const SocketPath = "/run/kura/helper.sock"

// Op represents a privileged operation request sent to kura-helper.
type Op struct {
	Action string            `json:"action"`
	Params map[string]string `json:"params"`
}

// Reply is the response from kura-helper.
type Reply struct {
	OK     bool   `json:"ok"`
	Output string `json:"output,omitempty"`
	Error  string `json:"error,omitempty"`
}

// Call sends an Op to kura-helper over the Unix socket and returns the Reply.
func Call(ctx context.Context, op Op) (*Reply, error) {
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "unix", SocketPath)
	if err != nil {
		return nil, fmt.Errorf("connect helper socket: %w", err)
	}
	defer conn.Close()

	deadline, ok := ctx.Deadline()
	if ok {
		conn.SetDeadline(deadline)
	} else {
		conn.SetDeadline(time.Now().Add(60 * time.Second))
	}

	enc := json.NewEncoder(conn)
	if err := enc.Encode(op); err != nil {
		return nil, fmt.Errorf("send op: %w", err)
	}

	var reply Reply
	dec := json.NewDecoder(conn)
	if err := dec.Decode(&reply); err != nil {
		return nil, fmt.Errorf("decode reply: %w", err)
	}
	return &reply, nil
}
