package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"time"

	"github.com/medioteq/vikingclaw/pkg/config"
)

// handleModelsRunning proxies GET /api/ps from Ollama — returns which model is loaded in RAM.
func (s *Server) handleModelsRunning(w http.ResponseWriter, r *http.Request) {
	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(ollamaURL + "/api/ps")
	if err != nil {
		jsonResponse(w, map[string]interface{}{"models": []interface{}{}, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		jsonResponse(w, map[string]interface{}{"models": []interface{}{}})
		return
	}
	jsonResponse(w, result)
}

// handleModelsDelete removes a model from Ollama (DELETE /api/delete).
func (s *Server) handleModelsDelete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonResponse(w, map[string]interface{}{"error": "model name required"})
		return
	}
	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}
	body, _ := json.Marshal(map[string]string{"name": req.Name})
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodDelete, ollamaURL+"/api/delete", bytes.NewReader(body))
	if err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		jsonResponse(w, map[string]interface{}{"ok": true, "deleted": req.Name})
	} else {
		data, _ := io.ReadAll(resp.Body)
		jsonResponse(w, map[string]interface{}{"error": string(data)})
	}
}

// handleModelsDefault saves a model as the configured default in config.yaml.
func (s *Server) handleModelsDefault(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonResponse(w, map[string]interface{}{"error": "model name required"})
		return
	}
	if s.cfg != nil {
		s.cfg.Providers.Ollama.Model = req.Name
		if err := config.Save(s.cfg); err != nil {
			jsonResponse(w, map[string]interface{}{"error": err.Error()})
			return
		}
	}
	jsonResponse(w, map[string]interface{}{"ok": true, "default": req.Name})
}

// handleSystem returns Go runtime memory/goroutine stats.
func (s *Server) handleSystem(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	jsonResponse(w, map[string]interface{}{
		"alloc_mb":   m.Alloc / 1024 / 1024,
		"sys_mb":     m.Sys / 1024 / 1024,
		"heap_mb":    m.HeapAlloc / 1024 / 1024,
		"goroutines": runtime.NumGoroutine(),
		"uptime":     formatUptime(time.Since(s.startTime)),
		"gc_runs":    m.NumGC,
	})
}

// handleAgentConfig returns non-secret config metadata for the UI panels.
func (s *Server) handleAgentConfig(w http.ResponseWriter, r *http.Request) {
	if s.cfg == nil {
		jsonResponse(w, map[string]interface{}{"error": "no config loaded"})
		return
	}
	jsonResponse(w, map[string]interface{}{
		"agent_name":            s.cfg.Agent.Name,
		"model":                 s.cfg.Providers.Ollama.Model,
		"ollama_url":            s.cfg.Providers.Ollama.BaseURL,
		"daily_limit":           s.cfg.Providers.TokenBudget.DailyLimit,
		"autonomy":              s.cfg.Security.Autonomy,
		"max_actions_per_hour":  s.cfg.Security.MaxActionsPerHour,
		"forbidden_paths_count": len(s.cfg.Security.ForbiddenPaths),
		"allow_commands_count":  len(s.cfg.Security.AllowCommands),
		"deny_commands_count":   len(s.cfg.Security.DenyCommands),
		"has_openai_key":        s.cfg.Providers.OpenAI.APIKey != "",
		"has_telegram":          s.cfg.Channels.Telegram.BotToken != "",
		"workspace":             s.cfg.Workspace,
	})
}

// handleModelsPullStream streams Ollama pull progress as SSE.
// POST /api/models/pull/stream
// Events: {"status":"pulling manifest"}
//
//	{"status":"downloading","percent":45,"total_bytes":4000000000,"done_bytes":1800000000}
//	{"status":"success","done":true,"model":"llama3:8b"}
func (s *Server) handleModelsPullStream(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Model string `json:"model"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "model name required", http.StatusBadRequest)
		return
	}
	modelName := req.Model
	if modelName == "" {
		modelName = req.Name
	}
	if modelName == "" {
		http.Error(w, "model name required", http.StatusBadRequest)
		return
	}

	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	sendEvt := func(data interface{}) {
		b, _ := json.Marshal(data)
		fmt.Fprintf(w, "data: %s\n\n", b)
		flusher.Flush()
	}

	body, _ := json.Marshal(map[string]interface{}{"name": modelName, "stream": true})
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, ollamaURL+"/api/pull", bytes.NewReader(body))
	if err != nil {
		sendEvt(map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(httpReq)
	if err != nil {
		sendEvt(map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 512*1024), 512*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		var msg map[string]interface{}
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			continue
		}
		status, _ := msg["status"].(string)
		total, _ := msg["total"].(float64)
		completed, _ := msg["completed"].(float64)

		evt := map[string]interface{}{"status": status}
		if total > 0 {
			pct := int(completed / total * 100)
			evt["percent"] = pct
			evt["total_bytes"] = int64(total)
			evt["done_bytes"] = int64(completed)
		}
		if status == "success" {
			evt["done"] = true
			sendEvt(evt)
			break
		}
		sendEvt(evt)
	}

	if err := scanner.Err(); err != nil {
		sendEvt(map[string]interface{}{"error": err.Error(), "done": true})
		return
	}

	sendEvt(map[string]interface{}{"done": true, "status": "complete", "model": modelName})
}
