package appstore

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"text/template"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

const (
	defaultBaseDir  = "/var/lib/kura/apps"
	stateFile       = "state.json"
)

// Manager handles compose-based app lifecycle.
type Manager struct {
	mu       sync.RWMutex
	baseDir  string
	apps     map[string]*InstalledApp // keyed by app ID (template_id)
}

func NewManager(baseDir string) (*Manager, error) {
	if baseDir == "" {
		baseDir = defaultBaseDir
	}
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, fmt.Errorf("create base dir: %w", err)
	}
	m := &Manager{baseDir: baseDir, apps: make(map[string]*InstalledApp)}
	_ = m.loadState()
	return m, nil
}

// Install renders the compose template, writes it to disk, and runs docker compose up.
func (m *Manager) Install(ctx context.Context, tmpl AppTemplate, req InstallRequest) (*InstalledApp, error) {
	if _, exists := m.apps[tmpl.ID]; exists {
		return nil, fmt.Errorf("app %q already installed", tmpl.ID)
	}

	dataDir := req.DataDir
	if dataDir == "" {
		dataDir = filepath.Join(m.baseDir, tmpl.ID, "data")
	}
	composeDir := filepath.Join(m.baseDir, tmpl.ID)

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	if err := os.MkdirAll(composeDir, 0o755); err != nil {
		return nil, fmt.Errorf("create compose dir: %w", err)
	}

	// Resolve ports (use requested or template defaults)
	ports := req.Ports
	if len(ports) == 0 {
		ports = tmpl.Ports
	}
	// Check for port conflicts
	for _, p := range ports {
		if err := checkPortFree(p.Host); err != nil {
			return nil, fmt.Errorf("port %d: %w", p.Host, err)
		}
	}

	// Build template data from env vars
	tplData := buildTemplateData(tmpl, req, dataDir, ports)
	compose, err := renderCompose(tmpl.ComposeTemplate, tplData)
	if err != nil {
		return nil, fmt.Errorf("render compose: %w", err)
	}

	composePath := filepath.Join(composeDir, "docker-compose.yml")
	if err := os.WriteFile(composePath, []byte(compose), 0o644); err != nil {
		return nil, fmt.Errorf("write compose file: %w", err)
	}

	// docker compose up
	_, err = kexec.Run(ctx, 5*time.Minute, "docker", "compose", "-f", composePath, "up", "-d", "--pull", "always")
	if err != nil {
		return nil, fmt.Errorf("docker compose up: %w", err)
	}

	webURL := ""
	for _, p := range ports {
		if p.Container == tmpl.WebPort {
			webURL = fmt.Sprintf("http://localhost:%d", p.Host)
			break
		}
	}

	app := &InstalledApp{
		ID:          tmpl.ID,
		TemplateID:  tmpl.ID,
		Name:        tmpl.Name,
		Category:    tmpl.Category,
		Icon:        tmpl.Icon,
		Status:      StatusRunning,
		Ports:       ports,
		DataDir:     dataDir,
		ComposeDir:  composeDir,
		InstalledAt: time.Now(),
		WebURL:      webURL,
	}

	m.mu.Lock()
	m.apps[tmpl.ID] = app
	m.mu.Unlock()
	_ = m.saveState()
	return app, nil
}

// Uninstall stops and removes the app's containers.
func (m *Manager) Uninstall(ctx context.Context, appID string) error {
	m.mu.RLock()
	app, ok := m.apps[appID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("app %q not installed", appID)
	}

	composePath := filepath.Join(app.ComposeDir, "docker-compose.yml")
	_, err := kexec.Run(ctx, 2*time.Minute, "docker", "compose", "-f", composePath, "down", "--remove-orphans")
	if err != nil {
		return fmt.Errorf("docker compose down: %w", err)
	}

	m.mu.Lock()
	delete(m.apps, appID)
	m.mu.Unlock()
	_ = m.saveState()
	return nil
}

// Start starts a stopped app.
func (m *Manager) Start(ctx context.Context, appID string) error {
	return m.composeCmd(ctx, appID, "start")
}

// Stop stops a running app.
func (m *Manager) Stop(ctx context.Context, appID string) error {
	return m.composeCmd(ctx, appID, "stop")
}

// Restart restarts an app.
func (m *Manager) Restart(ctx context.Context, appID string) error {
	return m.composeCmd(ctx, appID, "restart")
}

// Update pulls the latest image and recreates containers.
func (m *Manager) Update(ctx context.Context, appID string) error {
	m.mu.RLock()
	app, ok := m.apps[appID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("app %q not installed", appID)
	}
	composePath := filepath.Join(app.ComposeDir, "docker-compose.yml")
	_, err := kexec.Run(ctx, 5*time.Minute, "docker", "compose", "-f", composePath, "up", "-d", "--pull", "always", "--force-recreate")
	return err
}

// Logs returns the last `tail` lines of logs for an app.
func (m *Manager) Logs(ctx context.Context, appID string, tail int) (string, error) {
	m.mu.RLock()
	app, ok := m.apps[appID]
	m.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("app %q not installed", appID)
	}
	composePath := filepath.Join(app.ComposeDir, "docker-compose.yml")
	tailStr := fmt.Sprintf("%d", tail)
	res, err := kexec.Run(ctx, 30*time.Second, "docker", "compose", "-f", composePath, "logs", "--no-color", "--tail", tailStr)
	if err != nil {
		return "", err
	}
	return res.Stdout, nil
}

// ListInstalled returns all installed apps with refreshed status.
func (m *Manager) ListInstalled(ctx context.Context) []InstalledApp {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := make([]InstalledApp, 0, len(m.apps))
	for _, app := range m.apps {
		app.Status = m.liveStatus(ctx, app)
		result = append(result, *app)
	}
	return result
}

// GetInstalled returns a single installed app with refreshed status.
func (m *Manager) GetInstalled(ctx context.Context, appID string) (*InstalledApp, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	app, ok := m.apps[appID]
	if !ok {
		return nil, false
	}
	app.Status = m.liveStatus(ctx, app)
	return app, true
}

func (m *Manager) composeCmd(ctx context.Context, appID, cmd string) error {
	m.mu.RLock()
	app, ok := m.apps[appID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("app %q not installed", appID)
	}
	composePath := filepath.Join(app.ComposeDir, "docker-compose.yml")
	_, err := kexec.Run(ctx, 2*time.Minute, "docker", "compose", "-f", composePath, cmd)
	return err
}

func (m *Manager) liveStatus(ctx context.Context, app *InstalledApp) AppStatus {
	composePath := filepath.Join(app.ComposeDir, "docker-compose.yml")
	res, err := kexec.Run(ctx, 10*time.Second, "docker", "compose", "-f", composePath, "ps", "--format", "json")
	if err != nil || strings.TrimSpace(res.Stdout) == "" {
		return StatusStopped
	}
	scanner := bufio.NewScanner(strings.NewReader(res.Stdout))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var obj map[string]any
		if err := json.Unmarshal([]byte(line), &obj); err != nil {
			continue
		}
		state, _ := obj["State"].(string)
		if strings.ToLower(state) == "running" {
			return StatusRunning
		}
	}
	return StatusStopped
}

// checkPortFree returns error if TCP port is already in use.
func checkPortFree(port int) error {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("port %d already in use", port)
	}
	ln.Close()
	return nil
}

func buildTemplateData(tmpl AppTemplate, req InstallRequest, dataDir string, ports []PortMapping) map[string]string {
	data := map[string]string{
		"DataDir":  dataDir,
		"MediaDir": dataDir + "/media",
	}
	// Port shortcuts: Port<N> keys
	for _, p := range ports {
		key := fmt.Sprintf("Port%d", p.Container)
		data[key] = fmt.Sprintf("%d", p.Host)
	}
	// Env vars from request
	for _, e := range req.Env {
		data[e.Key] = e.Value
	}
	// Env vars from template defaults (only if not already set)
	for _, e := range tmpl.Env {
		if _, exists := data[e.Key]; !exists {
			data[e.Key] = e.Value
		}
	}
	// Specific known mappings
	data["PublishedServerUrl"] = data["JELLYFIN_PublishedServerUrl"]
	data["AdminUser"] = data["NEXTCLOUD_ADMIN_USER"]
	data["AdminPassword"] = data["NEXTCLOUD_ADMIN_PASSWORD"]
	data["PUID"] = orDefault(data["PUID"], "1000")
	data["PGID"] = orDefault(data["PGID"], "1000")
	data["TZ"] = orDefault(data["TZ"], "UTC")
	data["SignupsAllowed"] = orDefault(data["SIGNUPS_ALLOWED"], "false")
	return data
}

func renderCompose(tmplStr string, data map[string]string) (string, error) {
	t, err := template.New("compose").Option("missingkey=zero").Parse(tmplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func (m *Manager) saveState() error {
	m.mu.RLock()
	defer m.mu.RUnlock()
	apps := make([]*InstalledApp, 0, len(m.apps))
	for _, a := range m.apps {
		apps = append(apps, a)
	}
	data, err := json.MarshalIndent(apps, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(m.baseDir, stateFile), data, 0o644)
}

func (m *Manager) loadState() error {
	data, err := os.ReadFile(filepath.Join(m.baseDir, stateFile))
	if err != nil {
		return nil // first run
	}
	var apps []*InstalledApp
	if err := json.Unmarshal(data, &apps); err != nil {
		return err
	}
	for _, a := range apps {
		m.apps[a.ID] = a
	}
	return nil
}
