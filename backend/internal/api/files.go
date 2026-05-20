package api

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var allowedRoots = []string{"/mnt", "/home", "/media", "/srv", "/data"}

type fileEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	Mode    string    `json:"mode"`
}

type filesHandler struct{}

func (h *filesHandler) listDir(w http.ResponseWriter, r *http.Request) {
	rawPath := r.URL.Query().Get("path")
	if rawPath == "" {
		rawPath = "/"
	}

	clean := filepath.Clean(rawPath)

	// Virtual root: return allowed mount points that exist
	if clean == "/" {
		entries := []fileEntry{}
		for _, root := range allowedRoots {
			info, err := os.Stat(root)
			if err != nil {
				continue
			}
			entries = append(entries, fileEntry{
				Name:    filepath.Base(root),
				Path:    root,
				IsDir:   true,
				ModTime: info.ModTime(),
				Mode:    info.Mode().String(),
			})
		}
		jsonOK(w, map[string]any{"path": "/", "parent": "", "entries": entries})
		return
	}

	// Validate path is under an allowed root
	allowed := false
	for _, root := range allowedRoots {
		if clean == root || strings.HasPrefix(clean, root+"/") {
			allowed = true
			break
		}
	}
	if !allowed {
		jsonError(w, "path not allowed", http.StatusForbidden)
		return
	}

	f, err := os.Open(clean)
	if err != nil {
		jsonError(w, "cannot open path", http.StatusNotFound)
		return
	}
	defer f.Close()

	infos, err := f.Readdir(-1)
	if err != nil {
		jsonError(w, "cannot read directory", http.StatusInternalServerError)
		return
	}

	entries := make([]fileEntry, 0, len(infos))
	for _, info := range infos {
		if strings.HasPrefix(info.Name(), ".") {
			continue
		}
		entries = append(entries, fileEntry{
			Name:    info.Name(),
			Path:    filepath.Join(clean, info.Name()),
			IsDir:   info.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Mode:    info.Mode().String(),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})

	parent := filepath.Dir(clean)
	if clean == "/" {
		parent = ""
	}

	jsonOK(w, map[string]any{"path": clean, "parent": parent, "entries": entries})
}

func (h *filesHandler) downloadFile(w http.ResponseWriter, r *http.Request) {
	rawPath := r.URL.Query().Get("path")
	if rawPath == "" {
		jsonError(w, "missing path parameter", http.StatusBadRequest)
		return
	}

	clean := filepath.Clean(rawPath)

	// Validate path is under an allowed root
	allowed := false
	for _, root := range allowedRoots {
		if clean == root || strings.HasPrefix(clean, root+"/") {
			allowed = true
			break
		}
	}
	if !allowed {
		jsonError(w, "path not allowed", http.StatusForbidden)
		return
	}

	info, err := os.Stat(clean)
	if err != nil {
		jsonError(w, "file not found", http.StatusNotFound)
		return
	}

	if info.IsDir() {
		jsonError(w, "cannot download a directory", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(clean))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, clean)
}

