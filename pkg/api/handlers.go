package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/medioteq/vikingclaw/pkg/agent"
	"github.com/medioteq/vikingclaw/pkg/automation"
	"github.com/medioteq/vikingclaw/pkg/security"
	"github.com/rs/zerolog/log"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins
}

// handleStatus returns basic agent status information including provider state.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(s.startTime)
	hours := int(uptime.Hours())
	minutes := int(uptime.Minutes()) % 60

	agentName := "Viking"
	if s.cfg != nil {
		agentName = s.cfg.Agent.Name
	}

	// LM Studio status
	lmRunning := false
	lmModel := ""
	if s.provider != nil && s.provider.LMStudio() != nil {
		lm := s.provider.LMStudio()
		lmRunning = lm.Available()
		if lmRunning {
			lmModel = lm.GetLoadedModel()
		}
	}

	// Ollama status
	ollamaRunning := false
	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}
	client := &http.Client{Timeout: 2 * time.Second}
	if resp, err := client.Get(ollamaURL + "/api/tags"); err == nil {
		resp.Body.Close()
		ollamaRunning = true
	}

	activeProvider := "none"
	if s.provider != nil {
		activeProvider = s.provider.ActiveProvider()
	}

	// Sandbox stats from config
	forbiddenPathsCount := 0
	forbiddenCommandsCount := 0
	ollamaModel := ""
	if s.cfg != nil {
		forbiddenPathsCount = len(s.cfg.Security.ForbiddenPaths)
		forbiddenCommandsCount = len(s.cfg.Security.DenyCommands)
		ollamaModel = s.cfg.Providers.Ollama.Model
	}

	jsonResponse(w, map[string]interface{}{
		"status":    "running",
		"version":   "1.0.0",
		"uptime":    fmt.Sprintf("%dh %dm", hours, minutes),
		"agentName": agentName,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"lmstudio": map[string]interface{}{
			"running": lmRunning,
			"model":   lmModel,
		},
		"ollama": map[string]interface{}{
			"running": ollamaRunning,
			"model":   ollamaModel,
		},
		"active_provider": activeProvider,
		"sandbox": map[string]interface{}{
			"active":            true,
			"forbidden_paths":   forbiddenPathsCount,
			"forbidden_commands": forbiddenCommandsCount,
			"scrubber_patterns": security.ScrubberPatternCount(),
			"rate_limit":        "60 req/min",
		},
	})
}

// handleLMStudioStatus checks LM Studio availability and returns status + loaded model.
func (s *Server) handleLMStudioStatus(w http.ResponseWriter, r *http.Request) {
	if s.provider == nil || s.provider.LMStudio() == nil {
		jsonResponse(w, map[string]interface{}{"running": false, "model": "", "error": "not configured"})
		return
	}
	lm := s.provider.LMStudio()
	running := lm.Available()
	model := ""
	models := []map[string]interface{}{}
	if running {
		model = lm.GetLoadedModel()
		models = lm.GetAllModels()
		if models == nil {
			models = []map[string]interface{}{}
		}
	}
	jsonResponse(w, map[string]interface{}{
		"running": running,
		"model":   model,
		"models":  models,
	})
}

// handleLMStudioModels proxies to LM Studio's /v1/models endpoint.
func (s *Server) handleLMStudioModels(w http.ResponseWriter, r *http.Request) {
	if s.provider == nil || s.provider.LMStudio() == nil {
		jsonResponse(w, map[string]interface{}{"data": []interface{}{}})
		return
	}
	models := s.provider.LMStudio().GetAllModels()
	if models == nil {
		models = []map[string]interface{}{}
	}
	jsonResponse(w, map[string]interface{}{"data": models})
}

// handleModels proxies to Ollama and returns real model list.
func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}

	resp, err := http.Get(ollamaURL + "/api/tags")
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"models": []interface{}{},
			"error":  err.Error(),
			"status": "offline",
		})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		jsonResponse(w, map[string]interface{}{
			"models": []interface{}{},
			"error":  err.Error(),
			"status": "error",
		})
		return
	}
	result["status"] = "online"
	jsonResponse(w, result)
}

// handleMemory reads real memory files from the workspace.
func (s *Server) handleMemory(w http.ResponseWriter, r *http.Request) {
	workspace := s.workspacePath()

	memoryMD := readFileGraceful(filepath.Join(workspace, "MEMORY.md"))
	historyMD := lastNLines(filepath.Join(workspace, "HISTORY.md"), 20)

	today := time.Now().Format("2006-01-02")
	dailyLog := readFileGraceful(filepath.Join(workspace, "memory", today+".md"))

	jsonResponse(w, map[string]interface{}{
		"memory":   memoryMD,
		"daily":    dailyLog,
		"history":  historyMD,
		"date":     today,
		"workspace": workspace,
	})
}

// handleAudit reads the audit.log (JSONL) and returns last 50 entries.
func (s *Server) handleAudit(w http.ResponseWriter, r *http.Request) {
	workspace := s.workspacePath()
	auditPath := filepath.Join(workspace, "audit.log")

	entries := readJSONLTail(auditPath, 50)
	jsonResponse(w, map[string]interface{}{
		"entries": entries,
		"count":   len(entries),
		"path":    auditPath,
	})
}

// handleBudget returns token budget info.
func (s *Server) handleBudget(w http.ResponseWriter, r *http.Request) {
	dailyLimit := 10000
	if s.cfg != nil && s.cfg.Providers.TokenBudget.DailyLimit > 0 {
		dailyLimit = s.cfg.Providers.TokenBudget.DailyLimit
	}

	jsonResponse(w, map[string]interface{}{
		"dailyLimit":   dailyLimit,
		"usedToday":    0,
		"savedByLocal": 100,
		"providers": map[string]interface{}{
			"ollama":    map[string]interface{}{"tokens": 0, "cost": 0},
			"anthropic": map[string]interface{}{"tokens": 0, "cost": 0},
		},
	})
}

// handleAgents returns the list of agents (currently just the main agent).
func (s *Server) handleAgents(w http.ResponseWriter, r *http.Request) {
	agentName := "Viking"
	if s.cfg != nil {
		agentName = s.cfg.Agent.Name
	}

	jsonResponse(w, map[string]interface{}{
		"agents": []map[string]interface{}{
			{
				"id":     "main",
				"name":   agentName,
				"status": "running",
				"uptime": time.Since(s.startTime).String(),
			},
		},
	})
}

// handleCron returns an empty cron list.
func (s *Server) handleCron(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, map[string]interface{}{
		"jobs": []interface{}{},
	})
}

// handleWebSocket upgrades to WebSocket and sends heartbeats every 5s.
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}
	defer conn.Close()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Send initial connection message
	msg, _ := json.Marshal(map[string]interface{}{
		"type": "connected",
		"ts":   time.Now().UTC().Format(time.RFC3339),
	})
	if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
		return
	}

	// Handle incoming messages + send heartbeats
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case t := <-ticker.C:
			heartbeat, _ := json.Marshal(map[string]interface{}{
				"type": "heartbeat",
				"ts":   t.UTC().Format(time.RFC3339),
			})
			if err := conn.WriteMessage(websocket.TextMessage, heartbeat); err != nil {
				return
			}
		}
	}
}

// --- helpers ---

func (s *Server) workspacePath() string {
	if s.cfg != nil && s.cfg.Workspace != "" {
		return s.cfg.Workspace
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".vikingclaw", "workspace")
}

// readFileGraceful reads a file and returns its content; empty string on error.
func readFileGraceful(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

// lastNLines reads the last n lines of a file gracefully.
func lastNLines(path string, n int) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) <= n {
		return string(data)
	}
	return strings.Join(lines[len(lines)-n:], "\n")
}

// readJSONLTail reads a JSONL file and returns the last n entries as parsed JSON.
func readJSONLTail(path string, n int) []map[string]interface{} {
	f, err := os.Open(path)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			lines = append(lines, line)
		}
	}

	// take last n
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}

	entries := make([]map[string]interface{}, 0, len(lines))
	for _, line := range lines {
		var entry map[string]interface{}
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			entries = append(entries, entry)
		}
	}
	return entries
}

// formatUptime formats a duration as "Xh Ym".
func formatUptime(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	return fmt.Sprintf("%dh %dm", h, m)
}

// --- Browser handlers ---

func (s *Server) handleBrowserNavigate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck
	if err := s.browser.Navigate(req.URL); err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	screenshot, _ := s.browser.TakeScreenshot()
	jsonResponse(w, map[string]interface{}{
		"ok":         true,
		"url":        req.URL,
		"screenshot": screenshot,
	})
}

func (s *Server) handleBrowserScreenshot(w http.ResponseWriter, r *http.Request) {
	screenshot, err := s.browser.TakeScreenshot()
	if err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	jsonResponse(w, map[string]interface{}{"screenshot": screenshot, "ok": true})
}

func (s *Server) handleBrowserExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Script string `json:"script"`
	}
	json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck
	result, err := s.browser.ExecuteJS(req.Script)
	if err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	jsonResponse(w, map[string]interface{}{"result": result, "ok": true})
}

func (s *Server) handleBrowserStatus(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, s.browser.Status())
}

func (s *Server) handleBrowserStop(w http.ResponseWriter, r *http.Request) {
	s.browser.Stop()
	jsonResponse(w, map[string]interface{}{"ok": true})
}

// --- Automation handlers ---

func (s *Server) handleAutomationRules(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, map[string]interface{}{"rules": s.engine.GetRules()})
}

func (s *Server) handleAutomationRuns(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, map[string]interface{}{"runs": s.engine.GetRunLog()})
}

func (s *Server) handleAutomationAddRule(w http.ResponseWriter, r *http.Request) {
	var rule automation.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	rule.ID = uuid.New().String()
	if err := s.engine.AddRule(rule); err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	jsonResponse(w, map[string]interface{}{"ok": true, "id": rule.ID})
}

func (s *Server) handleAutomationToggleRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck
	s.engine.ToggleRule(req.ID)          //nolint:errcheck
	jsonResponse(w, map[string]interface{}{"ok": true})
}

func (s *Server) handleAutomationDeleteRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck
	s.engine.DeleteRule(req.ID)          //nolint:errcheck
	jsonResponse(w, map[string]interface{}{"ok": true})
}

func (s *Server) handleAutomationRunRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	json.NewDecoder(r.Body).Decode(&req) //nolint:errcheck
	if err := s.engine.RunRule(req.ID); err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	jsonResponse(w, map[string]interface{}{"ok": true})
}

// --- Memory search handler ---

func (s *Server) handleMemorySearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		jsonResponse(w, map[string]interface{}{"results": []interface{}{}})
		return
	}
	results := s.mem.SearchAll(query)
	jsonResponse(w, map[string]interface{}{"results": results, "query": query})
}

// --- Tools handlers ---

// ToolInfo describes a registered tool for the UI.
type ToolInfo struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

func (s *Server) handleToolsList(w http.ResponseWriter, r *http.Request) {
	if s.toolReg == nil {
		jsonResponse(w, map[string]interface{}{"tools": []interface{}{}})
		return
	}
	defs := s.toolReg.ToDefinitions()
	infos := make([]ToolInfo, 0, len(defs))
	for _, d := range defs {
		infos = append(infos, ToolInfo{
			Name:        d.Function.Name,
			Description: d.Function.Description,
			Parameters:  d.Function.Parameters,
		})
	}
	jsonResponse(w, map[string]interface{}{"tools": infos})
}

func (s *Server) handleToolsExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tool   string                 `json:"tool"`
		Params map[string]interface{} `json:"params"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]interface{}{"error": "invalid request"})
		return
	}
	if s.toolReg == nil {
		jsonResponse(w, map[string]interface{}{"error": "tool registry not available"})
		return
	}
	start := time.Now()
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	result, err := s.toolReg.Execute(ctx, req.Tool, req.Params)
	duration := time.Since(start)
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"ok":       false,
			"error":    err.Error(),
			"duration": duration.String(),
		})
		return
	}
	jsonResponse(w, map[string]interface{}{
		"ok":       true,
		"output":   result,
		"duration": duration.String(),
		"tool":     req.Tool,
	})
}

// --- Chat handler ---

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message   string `json:"message"`
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, map[string]interface{}{"error": "invalid request"})
		return
	}
	if req.Message == "" {
		jsonResponse(w, map[string]interface{}{"error": "message required"})
		return
	}
	if req.SessionID == "" {
		req.SessionID = "hq-" + uuid.New().String()[:8]
	}
	if s.loop == nil {
		jsonResponse(w, map[string]interface{}{"error": "agent loop not available — is Ollama running?"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	reply, err := s.loop.Process(ctx, req.Message, req.SessionID)
	if err != nil {
		jsonResponse(w, map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
			"reply": "",
		})
		return
	}
	jsonResponse(w, map[string]interface{}{
		"ok":         true,
		"reply":      reply,
		"session_id": req.SessionID,
	})
}

// --- Sandbox test handler ---

// handleSandboxTest runs live sandbox checks and returns pass/fail for each.
func (s *Server) handleSandboxTest(w http.ResponseWriter, r *http.Request) {
	// Build a policy seeded with config values (or empty if cfg is nil)
	var policy *security.SecurityPolicy
	if s.cfg != nil {
		policy = security.NewPolicy(s.cfg.Security)
	} else {
		policy = &security.SecurityPolicy{}
	}

	type testResult struct {
		Test   string `json:"test"`
		Passed bool   `json:"passed"`
		Output string `json:"output,omitempty"`
	}

	var results []testResult

	// Test 1: forbidden path blocked
	blocked1 := policy.IsPathForbidden("/etc/passwd")
	results = append(results, testResult{Test: "block /etc/passwd", Passed: blocked1})

	// Test 2: forbidden command blocked
	blocked2 := policy.IsCommandForbidden("rm -rf /")
	results = append(results, testResult{Test: "block rm -rf /", Passed: blocked2})

	// Test 3: credential scrubbing
	testInput := "my key is sk-abc123def456ghi789jkl012 please use it"
	scrubbed := policy.Scrub(testInput)
	clean := !strings.Contains(scrubbed, "sk-abc")
	results = append(results, testResult{Test: "scrub API key", Passed: clean, Output: scrubbed})

	allPassed := true
	for _, res := range results {
		if !res.Passed {
			allPassed = false
		}
	}

	jsonResponse(w, map[string]interface{}{
		"sandbox_active":  true,
		"all_passed":      allPassed,
		"tests":           results,
		"forbidden_paths": len(security.DefaultForbiddenPaths),
		"forbidden_cmds":  len(security.DefaultForbiddenShellCommands),
		"scrubber_patterns": security.ScrubberPatternCount(),
	})
}

// --- Models pull handler ---

func (s *Server) handleModelsPull(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Model string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Model == "" {
		jsonResponse(w, map[string]interface{}{"error": "model name required"})
		return
	}
	ollamaURL := "http://localhost:11434"
	if s.cfg != nil && s.cfg.Providers.Ollama.BaseURL != "" {
		ollamaURL = s.cfg.Providers.Ollama.BaseURL
	}
	body, _ := json.Marshal(map[string]interface{}{"name": req.Model, "stream": false})
	resp, err := http.Post(ollamaURL+"/api/pull", "application/json", bytes.NewReader(body))
	if err != nil {
		jsonResponse(w, map[string]interface{}{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		result = map[string]interface{}{"raw": string(data)}
	}
	result["ok"] = true
	result["model"] = req.Model
	jsonResponse(w, result)
}

// handleChatStream streams the agent response word-by-word as SSE.
// POST /api/chat/stream  →  text/event-stream
// Events: {"type":"tool_start","tool":"name","args":"{}"}
//         {"type":"tool_done","tool":"name","result":"..."}
//         {"type":"chunk","content":"word "}
//         {"type":"done"}
//         {"type":"error","message":"..."}
func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Message   string `json:"message"`
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Message == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}
	if req.SessionID == "" {
		req.SessionID = "hq-" + uuid.New().String()[:8]
	}

	// Set SSE headers before any write
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	sendEvent := func(evt interface{}) {
		data, err := json.Marshal(evt)
		if err != nil {
			return
		}
		fmt.Fprintf(w, "data: %s\n\n", string(data))
		flusher.Flush()
	}

	if s.loop == nil {
		sendEvent(agent.StreamEvent{Type: "error", Message: "agent loop not available — is Ollama running? (ollama serve)"})
		return
	}

	ctx := r.Context()
	events := make(chan agent.StreamEvent, 64)
	go s.loop.ProcessStream(ctx, req.Message, req.SessionID, events)

	for evt := range events {
		sendEvent(evt)
		if evt.Type == "done" || evt.Type == "error" {
			return
		}
	}
}
