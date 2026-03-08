package api

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/medioteq/vikingclaw/pkg/system"
)

// handleSystemSpecs returns hardware specs detected in WSL.
func (s *Server) handleSystemSpecs(w http.ResponseWriter, r *http.Request) {
	specs := system.GetSpecs()
	jsonResponse(w, specs)
}

// handleRecommendations returns model recommendations based on hardware + installed models.
func (s *Server) handleRecommendations(w http.ResponseWriter, r *http.Request) {
	specs := system.GetSpecs()

	// Get installed models from Ollama
	installed := map[string]bool{}
	resp, err := http.Get("http://localhost:11434/api/tags")
	if err == nil {
		defer resp.Body.Close()
		var data struct {
			Models []struct{ Name string } `json:"models"`
		}
		json.NewDecoder(resp.Body).Decode(&data) //nolint:errcheck
		for _, m := range data.Models {
			installed[m.Name] = true
		}
	}

	recs := system.GetRecommendations(specs, installed)
	jsonResponse(w, map[string]interface{}{
		"recommendations": recs,
		"specs":           specs,
	})
}

// handleModelAssign saves a model role assignment to workspace.
func (s *Server) handleModelAssign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role  string `json:"role"`
		Model string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Role == "" {
		jsonResponse(w, map[string]interface{}{"error": "role and model required"})
		return
	}

	workspace := s.workspacePath()
	assignPath := workspace + "/model_assignments.json"
	assignments := loadAssignments(assignPath)
	assignments[req.Role] = req.Model

	data, _ := json.MarshalIndent(assignments, "", "  ")
	os.WriteFile(assignPath, data, 0600) //nolint:errcheck

	jsonResponse(w, map[string]interface{}{"ok": true, "role": req.Role, "model": req.Model})
}

// handleModelAssignments returns the current role→model assignments.
func (s *Server) handleModelAssignments(w http.ResponseWriter, r *http.Request) {
	workspace := s.workspacePath()
	assignPath := workspace + "/model_assignments.json"
	jsonResponse(w, loadAssignments(assignPath))
}

func loadAssignments(path string) map[string]string {
	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]string{}
	}
	var m map[string]string
	json.Unmarshal(data, &m) //nolint:errcheck
	return m
}
