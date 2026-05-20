package appstore

import "time"

type PortMapping struct {
	Host      int    `json:"host"`
	Container int    `json:"container"`
	Protocol  string `json:"protocol"` // tcp | udp
}

type VolumeMapping struct {
	HostPath      string `json:"host_path"`
	ContainerPath string `json:"container_path"`
	ReadOnly      bool   `json:"read_only"`
}

type EnvVar struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Required bool   `json:"required"`
	Hint     string `json:"hint,omitempty"`
}

// Source values: "builtin" | "community" | "dockerhub"
type AppTemplate struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Category        string          `json:"category"`
	Description     string          `json:"description"`
	Icon            string          `json:"icon"`
	Image           string          `json:"image"`
	Ports           []PortMapping   `json:"ports"`
	Volumes         []VolumeMapping `json:"volumes"`
	Env             []EnvVar        `json:"env"`
	WebPort         int             `json:"web_port,omitempty"`
	Source          string          `json:"source,omitempty"`
	Stars           int             `json:"stars,omitempty"`
	Pulls           string          `json:"pulls,omitempty"`
	IsOfficial      bool            `json:"is_official,omitempty"`
	ComposeTemplate string          `json:"-"`
}

type AppStatus string

const (
	StatusRunning  AppStatus = "running"
	StatusStopped  AppStatus = "stopped"
	StatusStarting AppStatus = "starting"
	StatusError    AppStatus = "error"
)

type InstalledApp struct {
	ID          string          `json:"id"`
	TemplateID  string          `json:"template_id"`
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Icon        string          `json:"icon"`
	Status      AppStatus       `json:"status"`
	Ports       []PortMapping   `json:"ports"`
	Volumes     []VolumeMapping `json:"volumes"`
	DataDir     string          `json:"data_dir"`
	ComposeDir  string          `json:"compose_dir"`
	InstalledAt time.Time       `json:"installed_at"`
	WebURL      string          `json:"web_url,omitempty"`
}

type InstallRequest struct {
	Ports   []PortMapping   `json:"ports"`
	Volumes []VolumeMapping `json:"volumes"`
	Env     []EnvVar        `json:"env"`
	DataDir string          `json:"data_dir"`
}
