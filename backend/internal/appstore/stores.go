package appstore

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const portainerTemplatesURL = "https://raw.githubusercontent.com/portainer/templates/master/templates-2.0.json"

// portainerTemplate is the Portainer v2 template format (type 1 = single container).
type portainerTemplate struct {
	Type        int    `json:"type"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Logo        string `json:"logo"`
	Image       string `json:"image"`
	Categories  []string `json:"categories"`
	Platform    string   `json:"platform"`
	Ports       []string `json:"ports"` // "80/tcp", "443/tcp"
	Volumes     []struct {
		Container string `json:"container"`
		Bind      string `json:"bind,omitempty"`
		ReadOnly  bool   `json:"readonly,omitempty"`
	} `json:"volumes"`
	Env []struct {
		Name    string `json:"name"`
		Label   string `json:"label,omitempty"`
		Default string `json:"default,omitempty"`
		Preset  bool   `json:"preset,omitempty"`
	} `json:"env"`
	Network    string `json:"network,omitempty"`
	RestartPolicy string `json:"restart_policy,omitempty"`
}

type portainerManifest struct {
	Version   string               `json:"version"`
	Templates []portainerTemplate  `json:"templates"`
}

// FetchCommunityApps downloads and converts Portainer community templates.
// Only single-container apps (type=1) targeting linux are included.
func FetchCommunityApps(ctx context.Context) ([]AppTemplate, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, portainerTemplatesURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "kura-daemon/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch portainer templates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("portainer templates: HTTP %d", resp.StatusCode)
	}

	var manifest portainerManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("decode portainer templates: %w", err)
	}

	var result []AppTemplate
	seen := make(map[string]bool)

	for _, pt := range manifest.Templates {
		// Only single-container linux apps
		if pt.Type != 1 || pt.Image == "" {
			continue
		}
		if pt.Platform != "" && pt.Platform != "linux" {
			continue
		}

		id := slugify(pt.Title)
		if seen[id] {
			id = slugify(pt.Title + "-" + pt.Image)
		}
		seen[id] = true

		category := "other"
		if len(pt.Categories) > 0 {
			category = strings.ToLower(pt.Categories[0])
		}

		ports := parsePorts(pt.Ports)
		webPort := 0
		if len(ports) > 0 {
			webPort = ports[0].Container
		}

		volumes := make([]VolumeMapping, 0, len(pt.Volumes))
		for _, v := range pt.Volumes {
			host := v.Bind
			if host == "" {
				host = "{{.DataDir}}" + v.Container
			}
			volumes = append(volumes, VolumeMapping{
				HostPath:      host,
				ContainerPath: v.Container,
				ReadOnly:      v.ReadOnly,
			})
		}

		envVars := make([]EnvVar, 0, len(pt.Env))
		for _, e := range pt.Env {
			if e.Preset {
				continue
			}
			label := e.Label
			if label == "" {
				label = e.Name
			}
			envVars = append(envVars, EnvVar{
				Key:   e.Name,
				Value: e.Default,
				Hint:  label,
			})
		}

		compose := buildSimpleCompose(id, pt.Image, ports, volumes, envVars, pt.Network, pt.RestartPolicy)

		result = append(result, AppTemplate{
			ID:              "community-" + id,
			Name:            pt.Title,
			Category:        category,
			Description:     pt.Description,
			Icon:            "📦",
			Image:           pt.Image,
			Ports:           ports,
			Volumes:         volumes,
			Env:             envVars,
			WebPort:         webPort,
			Source:          "community",
			ComposeTemplate: compose,
		})
	}

	return result, nil
}

func parsePorts(raw []string) []PortMapping {
	var ports []PortMapping
	for _, s := range raw {
		// formats: "80/tcp", "8080:80/tcp", "80"
		proto := "tcp"
		if idx := strings.LastIndex(s, "/"); idx >= 0 {
			proto = s[idx+1:]
			s = s[:idx]
		}
		parts := strings.SplitN(s, ":", 2)
		var host, container int
		if len(parts) == 2 {
			host, _ = strconv.Atoi(parts[0])
			container, _ = strconv.Atoi(parts[1])
		} else {
			container, _ = strconv.Atoi(parts[0])
			host = container
		}
		if container > 0 {
			ports = append(ports, PortMapping{Host: host, Container: container, Protocol: proto})
		}
	}
	return ports
}

func buildSimpleCompose(id, image string, ports []PortMapping, volumes []VolumeMapping, env []EnvVar, network, restartPolicy string) string {
	var sb strings.Builder
	sb.WriteString("services:\n")
	sb.WriteString(fmt.Sprintf("  %s:\n", id))
	sb.WriteString(fmt.Sprintf("    image: %s\n", image))
	sb.WriteString(fmt.Sprintf("    container_name: %s\n", id))

	if network == "host" {
		sb.WriteString("    network_mode: host\n")
	} else if len(ports) > 0 {
		sb.WriteString("    ports:\n")
		for _, p := range ports {
			sb.WriteString(fmt.Sprintf("      - \"${Port%d}:%d/%s\"\n", p.Container, p.Container, p.Protocol))
		}
	}

	if len(volumes) > 0 {
		sb.WriteString("    volumes:\n")
		for _, v := range volumes {
			if v.ReadOnly {
				sb.WriteString(fmt.Sprintf("      - %s:%s:ro\n", v.HostPath, v.ContainerPath))
			} else {
				sb.WriteString(fmt.Sprintf("      - %s:%s\n", v.HostPath, v.ContainerPath))
			}
		}
	}

	if len(env) > 0 {
		sb.WriteString("    environment:\n")
		for _, e := range env {
			sb.WriteString(fmt.Sprintf("      - %s=${%s}\n", e.Key, e.Key))
		}
	}

	rp := restartPolicy
	if rp == "" {
		rp = "unless-stopped"
	}
	sb.WriteString(fmt.Sprintf("    restart: %s\n", rp))
	return sb.String()
}

func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		} else if r == ' ' || r == '_' || r == '.' {
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}
