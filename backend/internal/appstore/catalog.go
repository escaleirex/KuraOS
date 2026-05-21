package appstore

var builtinCatalog = []AppTemplate{
	{
		ID:          "jellyfin",
		Name:        "Jellyfin",
		Category:    "media",
		Description: "Free software media system. Stream movies, TV shows, music, and photos to any device.",
		Icon:        "🎬",
		Image:       "jellyfin/jellyfin:latest",
		WebPort:     8096,
		Ports: []PortMapping{
			{Host: 8096, Container: 8096, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/config", ContainerPath: "/config"},
			{HostPath: "{{.DataDir}}/cache", ContainerPath: "/cache"},
			{HostPath: "{{.MediaDir}}", ContainerPath: "/media"},
		},
		Env: []EnvVar{
			{Key: "JELLYFIN_PublishedServerUrl", Value: "", Required: false, Hint: "Optional: public URL for reverse proxy"},
		},
		ComposeTemplate: `services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    network_mode: host
    volumes:
      - {{.DataDir}}/config:/config
      - {{.DataDir}}/cache:/cache
      - {{.MediaDir}}:/media
    environment:
      - JELLYFIN_PublishedServerUrl={{.PublishedServerUrl}}
    restart: unless-stopped
`,
	},
	{
		ID:          "nextcloud",
		Name:        "Nextcloud",
		Category:    "sync",
		Description: "Self-hosted productivity platform: files, calendar, contacts, and office suite.",
		Icon:        "☁️",
		Image:       "nextcloud:latest",
		WebPort:     8080,
		Ports: []PortMapping{
			{Host: 8080, Container: 80, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/data", ContainerPath: "/var/www/html"},
		},
		Env: []EnvVar{
			{Key: "NEXTCLOUD_ADMIN_USER", Value: "admin", Required: true, Hint: "Admin username"},
			{Key: "NEXTCLOUD_ADMIN_PASSWORD", Value: "", Required: true, Hint: "Admin password"},
		},
		ComposeTemplate: `services:
  nextcloud:
    image: nextcloud:latest
    container_name: nextcloud
    ports:
      - "{{.Port8080}}:80"
    volumes:
      - {{.DataDir}}/data:/var/www/html
    environment:
      - NEXTCLOUD_ADMIN_USER={{.AdminUser}}
      - NEXTCLOUD_ADMIN_PASSWORD={{.AdminPassword}}
    restart: unless-stopped
`,
	},
	{
		ID:          "transmission",
		Name:        "Transmission",
		Category:    "download",
		Description: "Lightweight BitTorrent client with web interface.",
		Icon:        "⬇️",
		Image:       "lscr.io/linuxserver/transmission:latest",
		WebPort:     9091,
		Ports: []PortMapping{
			{Host: 9091, Container: 9091, Protocol: "tcp"},
			{Host: 51413, Container: 51413, Protocol: "tcp"},
			{Host: 51413, Container: 51413, Protocol: "udp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/config", ContainerPath: "/config"},
			{HostPath: "{{.DataDir}}/downloads", ContainerPath: "/downloads"},
		},
		Env: []EnvVar{
			{Key: "PUID", Value: "1000", Required: false},
			{Key: "PGID", Value: "1000", Required: false},
			{Key: "TZ", Value: "Europe/Lisbon", Required: false, Hint: "Timezone"},
		},
		ComposeTemplate: `services:
  transmission:
    image: lscr.io/linuxserver/transmission:latest
    container_name: transmission
    environment:
      - PUID={{.PUID}}
      - PGID={{.PGID}}
      - TZ={{.TZ}}
    volumes:
      - {{.DataDir}}/config:/config
      - {{.DataDir}}/downloads:/downloads
    ports:
      - "{{.Port9091}}:9091"
      - "51413:51413"
      - "51413:51413/udp"
    restart: unless-stopped
`,
	},
	{
		ID:          "home-assistant",
		Name:        "Home Assistant",
		Category:    "home",
		Description: "Open source home automation platform. Control smart home devices locally.",
		Icon:        "🏠",
		Image:       "ghcr.io/home-assistant/home-assistant:stable",
		WebPort:     8123,
		Ports: []PortMapping{
			{Host: 8123, Container: 8123, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/config", ContainerPath: "/config"},
		},
		Env: []EnvVar{
			{Key: "TZ", Value: "Europe/Lisbon", Required: false, Hint: "Timezone"},
		},
		ComposeTemplate: `services:
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    network_mode: host
    volumes:
      - {{.DataDir}}/config:/config
    environment:
      - TZ={{.TZ}}
    restart: unless-stopped
`,
	},
	{
		ID:          "portainer",
		Name:        "Portainer",
		Category:    "dev",
		Description: "Container management UI for Docker. Manage containers, images, volumes, and networks.",
		Icon:        "🐳",
		Image:       "portainer/portainer-ce:latest",
		WebPort:     9000,
		Ports: []PortMapping{
			{Host: 9000, Container: 9000, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "/var/run/docker.sock", ContainerPath: "/var/run/docker.sock", ReadOnly: true},
			{HostPath: "{{.DataDir}}/data", ContainerPath: "/data"},
		},
		ComposeTemplate: `services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    ports:
      - "{{.Port9000}}:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - {{.DataDir}}/data:/data
    restart: unless-stopped
`,
	},
	{
		ID:          "nginx-proxy-manager",
		Name:        "Nginx Proxy Manager",
		Category:    "network",
		Description: "Reverse proxy management with free SSL certificates via Let's Encrypt.",
		Icon:        "🔀",
		Image:       "jc21/nginx-proxy-manager:latest",
		WebPort:     81,
		Ports: []PortMapping{
			{Host: 80, Container: 80, Protocol: "tcp"},
			{Host: 443, Container: 443, Protocol: "tcp"},
			{Host: 81, Container: 81, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/data", ContainerPath: "/data"},
			{HostPath: "{{.DataDir}}/letsencrypt", ContainerPath: "/etc/letsencrypt"},
		},
		ComposeTemplate: `services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    ports:
      - "80:80"
      - "443:443"
      - "{{.Port81}}:81"
    volumes:
      - {{.DataDir}}/data:/data
      - {{.DataDir}}/letsencrypt:/etc/letsencrypt
    restart: unless-stopped
`,
	},
	{
		ID:          "code-server",
		Name:        "code-server",
		Category:    "dev",
		Description: "VS Code in the browser with full access to the host filesystem at /host. Edit KuraOS configs, scripts, and server files directly.",
		Icon:        "code",
		Image:       "codercom/code-server:latest",
		WebPort:     8080,
		Ports: []PortMapping{
			{Host: 8443, Container: 8080, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/config", ContainerPath: "/root/.config/code-server"},
			{HostPath: "/", ContainerPath: "/host"},
		},
		ComposeTemplate: `services:
  code-server:
    image: codercom/code-server:latest
    container_name: code-server
    user: "0:0"
    command: ["--auth", "none"]
    ports:
      - "{{.Port8080}}:8080"
    volumes:
      - {{.DataDir}}/config:/root/.config/code-server
      - /:/host
    working_dir: /host
    restart: unless-stopped
`,
	},
	{
		ID:          "vaultwarden",
		Name:        "Vaultwarden",
		Category:    "network",
		Description: "Unofficial Bitwarden-compatible server. Self-host your password manager.",
		Icon:        "🔐",
		Image:       "vaultwarden/server:latest",
		WebPort:     8222,
		Ports: []PortMapping{
			{Host: 8222, Container: 80, Protocol: "tcp"},
		},
		Volumes: []VolumeMapping{
			{HostPath: "{{.DataDir}}/data", ContainerPath: "/data"},
		},
		Env: []EnvVar{
			{Key: "WEBSOCKET_ENABLED", Value: "true", Required: false},
			{Key: "SIGNUPS_ALLOWED", Value: "false", Required: false, Hint: "Disable after first user"},
		},
		ComposeTemplate: `services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    ports:
      - "{{.Port8222}}:80"
    volumes:
      - {{.DataDir}}/data:/data
    environment:
      - WEBSOCKET_ENABLED=true
      - SIGNUPS_ALLOWED={{.SignupsAllowed}}
    restart: unless-stopped
`,
	},
}

// Catalog returns the built-in app catalog, filtered by optional category and search.
func Catalog(category, search string) []AppTemplate {
	var result []AppTemplate
	for _, t := range builtinCatalog {
		if category != "" && t.Category != category {
			continue
		}
		if search != "" {
			q := search
			if !containsFold(t.Name, q) && !containsFold(t.Description, q) && !containsFold(t.Category, q) {
				continue
			}
		}
		t.Source = "builtin"
		result = append(result, t)
	}
	return result
}

// GetTemplate returns a single template by id.
func GetTemplate(id string) (AppTemplate, bool) {
	for _, t := range builtinCatalog {
		if t.ID == id {
			return t, true
		}
	}
	return AppTemplate{}, false
}

func containsFold(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	sl, subl := len(s), len(sub)
	for i := 0; i <= sl-subl; i++ {
		if equalFold(s[i:i+subl], sub) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}
