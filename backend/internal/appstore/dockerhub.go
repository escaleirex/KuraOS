package appstore

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	dockerHubSearchURL = "https://hub.docker.com/v2/search/repositories/"
	dockerHubRepoURL   = "https://hub.docker.com/v2/repositories/"
	dockerHubTagsURL   = "https://hub.docker.com/v2/repositories/%s/%s/tags/?page_size=12&ordering=last_updated"
	detailsCacheTTL    = time.Hour
)

// ── Featured list ──────────────────────────────────────────────────────────

type featuredEntry struct {
	HubRef   string // namespace/name on Docker Hub
	Image    string // actual pull ref (may differ for some)
	Category string
	Name     string // override if needed
}

var featuredImages = []featuredEntry{
	{HubRef: "jellyfin/jellyfin",             Image: "jellyfin/jellyfin",             Category: "media"},
	{HubRef: "library/nextcloud",             Image: "nextcloud",                     Category: "sync"},
	{HubRef: "portainer/portainer-ce",        Image: "portainer/portainer-ce",        Category: "dev"},
	{HubRef: "vaultwarden/server",            Image: "vaultwarden/server",            Category: "security"},
	{HubRef: "jc21/nginx-proxy-manager",      Image: "jc21/nginx-proxy-manager",      Category: "network"},
	{HubRef: "gitea/gitea",                   Image: "gitea/gitea",                   Category: "dev"},
	{HubRef: "photoprism/photoprism",         Image: "photoprism/photoprism",         Category: "media"},
	{HubRef: "filebrowser/filebrowser",       Image: "filebrowser/filebrowser",       Category: "files"},
	{HubRef: "grafana/grafana",               Image: "grafana/grafana",               Category: "monitoring"},
	{HubRef: "adguard/adguardhome",           Image: "adguard/adguardhome",           Category: "network"},
	{HubRef: "freshrss/freshrss",             Image: "freshrss/freshrss",             Category: "productivity"},
	{HubRef: "linuxserver/sonarr",            Image: "linuxserver/sonarr",            Category: "media"},
	{HubRef: "linuxserver/radarr",            Image: "linuxserver/radarr",            Category: "media"},
	{HubRef: "pihole/pihole",                 Image: "pihole/pihole",                 Category: "network"},
	{HubRef: "homeassistant/home-assistant",  Image: "homeassistant/home-assistant",  Category: "home"},
	{HubRef: "linuxserver/transmission",      Image: "linuxserver/transmission",      Category: "download"},
	{HubRef: "linuxserver/jellyseerr",        Image: "linuxserver/jellyseerr",        Category: "media"},
	{HubRef: "stirlingtools/stirling-pdf",    Image: "stirlingtools/stirling-pdf",    Category: "productivity"},
	{HubRef: "library/influxdb",             Image: "influxdb",                      Category: "monitoring"},
	{HubRef: "actualbudget/actual-server",    Image: "actualbudget/actual-server",    Category: "finance"},
}

// ── Hub details ────────────────────────────────────────────────────────────

type HubDetails struct {
	AppTemplate
	LogoURL         string   `json:"logo_url,omitempty"`
	FullDescription string   `json:"full_description,omitempty"`
	LastUpdated     string   `json:"last_updated,omitempty"`
	Tags            []string `json:"tags,omitempty"`
	Screenshots     []string `json:"screenshots,omitempty"`
	PullCountRaw    int      `json:"pull_count_raw,omitempty"`
}

var (
	detailsCacheMu sync.RWMutex
	detailsCache   = make(map[string]*HubDetails)
	detailsCacheAt = make(map[string]time.Time)

	featuredCacheMu sync.RWMutex
	featuredCache   []HubDetails
	featuredCacheAt time.Time

	reMarkdownImage = regexp.MustCompile(`!\[[^\]]*\]\((https?://[^\s)]+)\)`)
)

// FetchHubDetails returns full details for a Docker Hub image (namespace/name).
// Results are cached for 1 hour.
func FetchHubDetails(ctx context.Context, hubRef string) (*HubDetails, error) {
	detailsCacheMu.RLock()
	if d, ok := detailsCache[hubRef]; ok {
		if time.Since(detailsCacheAt[hubRef]) < detailsCacheTTL {
			detailsCacheMu.RUnlock()
			return d, nil
		}
	}
	detailsCacheMu.RUnlock()

	d, err := fetchHubDetailsUncached(ctx, hubRef)
	if err != nil {
		return nil, err
	}

	detailsCacheMu.Lock()
	detailsCache[hubRef] = d
	detailsCacheAt[hubRef] = time.Now()
	detailsCacheMu.Unlock()
	return d, nil
}

func fetchHubDetailsUncached(ctx context.Context, hubRef string) (*HubDetails, error) {
	ns, name := splitHubRef(hubRef)
	apiURL := dockerHubRepoURL + ns + "/" + name + "/"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "kura-daemon/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hub details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hub details %s: HTTP %d", hubRef, resp.StatusCode)
	}

	var raw struct {
		Name            string `json:"name"`
		Namespace       string `json:"namespace"`
		Description     string `json:"description"`
		FullDescription string `json:"full_description"`
		StarCount       int    `json:"star_count"`
		PullCount       int    `json:"pull_count"`
		LogoURL         string `json:"logo_url"`
		LastUpdated     string `json:"last_updated"`
		IsOfficial      bool   `json:"is_official"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	tags, _ := fetchTags(ctx, ns, name)
	screenshots := extractScreenshots(raw.FullDescription)

	// Truncate full_description for transport (client can fetch more via separate call)
	desc := raw.FullDescription
	if len(desc) > 3000 {
		desc = desc[:3000] + "…"
	}

	// Determine image ref
	image := ns + "/" + name + ":latest"
	if ns == "library" {
		image = name + ":latest"
	}

	id := "hub-" + slugify(ns+"-"+name)
	displayName := capitalize(raw.Name)
	if ns != "library" {
		displayName = capitalize(raw.Name)
	}

	d := &HubDetails{
		AppTemplate: AppTemplate{
			ID:          id,
			Name:        displayName,
			Category:    "other",
			Description: raw.Description,
			Icon:        "📦",
			Image:       image,
			Source:      "dockerhub",
			Stars:       raw.StarCount,
			Pulls:       formatPullCount(raw.PullCount),
			IsOfficial:  raw.IsOfficial,
			ComposeTemplate: buildGenericCompose(slugify(name), image),
		},
		LogoURL:         raw.LogoURL,
		FullDescription: desc,
		LastUpdated:     raw.LastUpdated,
		Tags:            tags,
		Screenshots:     screenshots,
		PullCountRaw:    raw.PullCount,
	}
	return d, nil
}

func fetchTags(ctx context.Context, ns, name string) ([]string, error) {
	tagsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tagsURL := fmt.Sprintf(dockerHubTagsURL, ns, name)
	req, err := http.NewRequestWithContext(tagsCtx, http.MethodGet, tagsURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "kura-daemon/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Results []struct {
			Name string `json:"name"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	tags := make([]string, 0, len(result.Results))
	for _, t := range result.Results {
		tags = append(tags, t.Name)
	}
	return tags, nil
}

func extractScreenshots(md string) []string {
	matches := reMarkdownImage.FindAllStringSubmatch(md, 8)
	var urls []string
	for _, m := range matches {
		if len(m) > 1 {
			u := m[1]
			// skip tiny images like badges/shields
			if strings.Contains(u, "shields.io") ||
				strings.Contains(u, "badge") ||
				strings.Contains(u, "travis") ||
				strings.Contains(u, "circleci") {
				continue
			}
			urls = append(urls, u)
		}
	}
	return urls
}

// FetchFeatured returns details for all featured apps, fetched in parallel, cached 1h.
func FetchFeatured(ctx context.Context) ([]HubDetails, error) {
	featuredCacheMu.RLock()
	if featuredCache != nil && time.Since(featuredCacheAt) < detailsCacheTTL {
		result := featuredCache
		featuredCacheMu.RUnlock()
		return result, nil
	}
	featuredCacheMu.RUnlock()

	// Fetch all in parallel, max 5 concurrent
	type indexedResult struct {
		idx int
		d   *HubDetails
		err error
	}

	sem := make(chan struct{}, 5)
	results := make([]indexedResult, len(featuredImages))
	var wg sync.WaitGroup

	for i, entry := range featuredImages {
		wg.Add(1)
		go func(idx int, e featuredEntry) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			fetchCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
			defer cancel()

			d, err := FetchHubDetails(fetchCtx, e.HubRef)
			if err != nil {
				// Fallback: return minimal entry
				d = &HubDetails{
					AppTemplate: AppTemplate{
						ID:       "hub-" + slugify(e.HubRef),
						Name:     capitalize(e.HubRef),
						Category: e.Category,
						Icon:     "📦",
						Image:    e.Image + ":latest",
						Source:   "dockerhub",
					},
				}
			} else {
				// Override category from our curated list
				d.AppTemplate.Category = e.Category
				// Override image with actual pull ref
				d.AppTemplate.Image = e.Image + ":latest"
			}
			results[idx] = indexedResult{idx: idx, d: d}
		}(i, entry)
	}

	wg.Wait()

	featured := make([]HubDetails, 0, len(results))
	for _, r := range results {
		if r.d != nil {
			featured = append(featured, *r.d)
		}
	}

	featuredCacheMu.Lock()
	featuredCache = featured
	featuredCacheAt = time.Now()
	featuredCacheMu.Unlock()

	return featured, nil
}

// ── Search ─────────────────────────────────────────────────────────────────

type hubSearchResult struct {
	Count   int `json:"count"`
	Results []struct {
		RepoName         string `json:"repo_name"`
		ShortDescription string `json:"short_description"`
		StarCount        int    `json:"star_count"`
		PullCount        int    `json:"pull_count"`
		IsOfficial       bool   `json:"is_official"`
	} `json:"results"`
}

func SearchDockerHub(ctx context.Context, query string, pageSize int) ([]AppTemplate, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 25
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	params := url.Values{}
	params.Set("query", query)
	params.Set("page_size", fmt.Sprintf("%d", pageSize))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, dockerHubSearchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "kura-daemon/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("docker hub search: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("docker hub: HTTP %d", resp.StatusCode)
	}

	var hub hubSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&hub); err != nil {
		return nil, fmt.Errorf("decode docker hub response: %w", err)
	}

	result := make([]AppTemplate, 0, len(hub.Results))
	for _, r := range hub.Results {
		image := r.RepoName + ":latest"
		id := "hub-" + slugify(r.RepoName)
		result = append(result, AppTemplate{
			ID:              id,
			Name:            capitalize(r.RepoName),
			Category:        "other",
			Description:     r.ShortDescription,
			Icon:            "📦",
			Image:           image,
			Source:          "dockerhub",
			Stars:           r.StarCount,
			Pulls:           formatPullCount(r.PullCount),
			IsOfficial:      r.IsOfficial,
			ComposeTemplate: buildGenericCompose(slugify(r.RepoName), image),
		})
	}
	return result, nil
}

// ── Helpers ────────────────────────────────────────────────────────────────

func splitHubRef(ref string) (ns, name string) {
	parts := strings.SplitN(ref, "/", 2)
	if len(parts) == 1 {
		return "library", parts[0]
	}
	return parts[0], parts[1]
}

func buildGenericCompose(id, image string) string {
	return fmt.Sprintf(`services:
  %s:
    image: %s
    container_name: %s
    restart: unless-stopped
`, id, image, id)
}

func formatPullCount(n int) string {
	switch {
	case n >= 1_000_000_000:
		return fmt.Sprintf("%.1fB", float64(n)/1_000_000_000)
	case n >= 1_000_000:
		return fmt.Sprintf("%.1fM", float64(n)/1_000_000)
	case n >= 1_000:
		return fmt.Sprintf("%.1fK", float64(n)/1_000)
	default:
		return fmt.Sprintf("%d", n)
	}
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	if idx := strings.LastIndex(s, "/"); idx >= 0 {
		s = s[idx+1:]
	}
	r := []rune(s)
	if r[0] >= 'a' && r[0] <= 'z' {
		r[0] -= 32
	}
	return string(r)
}
