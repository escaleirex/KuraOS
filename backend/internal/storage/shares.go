package storage

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"text/template"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"context"
	"time"
)

type ShareProtocol string

const (
	ProtocolSMB    ShareProtocol = "smb"
	ProtocolNFS    ShareProtocol = "nfs"
	ProtocolFTP    ShareProtocol = "ftp"
	ProtocolWebDAV ShareProtocol = "webdav"
)

type Share struct {
	Name        string        `json:"name"`
	Path        string        `json:"path"`
	Protocol    ShareProtocol `json:"protocol"`
	Description string        `json:"description,omitempty"`
	ReadOnly    bool          `json:"read_only"`
	// SMB-specific
	ValidUsers  []string `json:"valid_users,omitempty"`
	ForceGroup  string   `json:"force_group,omitempty"`
	// NFS-specific
	NFSClients  []NFSClient `json:"nfs_clients,omitempty"`
	// Windows ACL compatibility (off by default to preserve POSIX perms)
	WindowsACL  bool `json:"windows_acl"`
}

type NFSClient struct {
	Host    string `json:"host"` // IP or CIDR, e.g. "192.168.1.0/24"
	Options string `json:"options"` // e.g. "rw,sync,no_subtree_check"
}

// --- SMB ---

const smbShareTmpl = `
[{{.Name}}]
   comment = {{.Description}}
   path = {{.Path}}
   browseable = yes
   read only = {{if .ReadOnly}}yes{{else}}no{{end}}
   {{- if .ValidUsers}}
   valid users = {{join .ValidUsers " "}}
   {{- end}}
   force group = {{if .ForceGroup}}{{.ForceGroup}}{{else}}kura-data{{end}}
   create mask = 0664
   directory mask = 0775
   {{- if .WindowsACL}}
   vfs objects = acl_xattr
   map acl inherit = yes
   {{- else}}
   store dos attributes = no
   ea support = no
   {{- end}}
`

var smbTmpl = template.Must(template.New("smb").Funcs(template.FuncMap{
	"join": func(s []string, sep string) string {
		result := ""
		for i, v := range s {
			if i > 0 {
				result += sep
			}
			result += v
		}
		return result
	},
}).Parse(smbShareTmpl))

// RenderSMBShare generates the smb.conf stanza for a share.
func RenderSMBShare(s Share) (string, error) {
	var buf bytes.Buffer
	if err := smbTmpl.Execute(&buf, s); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ApplySMBConfig writes all shares to /etc/samba/kura-shares.conf
// and reloads Samba. The main smb.conf must include this file.
func ApplySMBConfig(ctx context.Context, shares []Share) error {
	confPath := "/etc/samba/kura-shares.conf"
	var buf bytes.Buffer
	for _, s := range shares {
		if s.Protocol != ProtocolSMB {
			continue
		}
		stanza, err := RenderSMBShare(s)
		if err != nil {
			return fmt.Errorf("render SMB share %q: %w", s.Name, err)
		}
		buf.WriteString(stanza)
		buf.WriteString("\n")
	}

	if err := os.WriteFile(confPath, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("write smb config: %w", err)
	}

	// Validate before reload
	if _, err := kexec.Run(ctx, 10*time.Second, "testparm", "-s", confPath); err != nil {
		return fmt.Errorf("testparm failed: %w", err)
	}

	_, err := kexec.Run(ctx, 15*time.Second, "systemctl", "reload", "smbd")
	return err
}

// EnsureBaseSMBConf writes the base smb.conf that includes kura-shares.conf.
// Only called during initial setup if the file doesn't already include our include line.
func EnsureBaseSMBConf() error {
	baseConf := `/etc/samba/smb.conf`
	include := "\ninclude = /etc/samba/kura-shares.conf\n"

	data, err := os.ReadFile(baseConf)
	if err != nil {
		return err
	}
	if bytes.Contains(data, []byte("kura-shares.conf")) {
		return nil
	}
	f, err := os.OpenFile(baseConf, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(include)
	return err
}

// --- NFS ---

// ApplyNFSConfig writes /etc/exports and runs exportfs -ra.
func ApplyNFSConfig(ctx context.Context, shares []Share) error {
	var buf bytes.Buffer
	for _, s := range shares {
		if s.Protocol != ProtocolNFS {
			continue
		}
		for _, client := range s.NFSClients {
			opts := client.Options
			if opts == "" {
				if s.ReadOnly {
					opts = "ro,sync,no_subtree_check,no_root_squash"
				} else {
					opts = "rw,sync,no_subtree_check,no_root_squash"
				}
			}
			fmt.Fprintf(&buf, "%s\t%s(%s)\n", s.Path, client.Host, opts)
		}
	}

	exportsPath := "/etc/exports.d/kura.exports"
	if err := os.MkdirAll(filepath.Dir(exportsPath), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(exportsPath, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("write exports: %w", err)
	}

	_, err := kexec.Run(ctx, 15*time.Second, "exportfs", "-ra")
	return err
}

// EnsureShareDir creates the share directory with correct ownership.
func EnsureShareDir(path, group string) error {
	if err := os.MkdirAll(path, 0775); err != nil {
		return err
	}
	// Ownership set via helper (requires root) — caller handles this
	return nil
}
