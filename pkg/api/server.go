package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/medioteq/vikingclaw/pkg/agent"
	"github.com/medioteq/vikingclaw/pkg/automation"
	"github.com/medioteq/vikingclaw/pkg/browser"
	"github.com/medioteq/vikingclaw/pkg/config"
	"github.com/medioteq/vikingclaw/pkg/memory"
	"github.com/medioteq/vikingclaw/pkg/providers"
	"github.com/medioteq/vikingclaw/pkg/tools"
	"github.com/rs/zerolog/log"
)

// Server holds the HTTP server state.
type Server struct {
	port      string
	router    *http.ServeMux
	cfg       *config.Config
	startTime time.Time
	browser   *browser.Browser
	engine    *automation.Engine
	mem       *memory.MemoryStore
	loop      *agent.AgentLoop
	toolReg   *tools.Registry
	provider  *providers.Router
}

// NewServer creates a new API server bound to port.
func NewServer(port string, cfg *config.Config, loop *agent.AgentLoop, toolReg *tools.Registry, prov *providers.Router) *Server {
	workspace := cfg.Workspace
	if workspace == "" {
		home, _ := os.UserHomeDir()
		workspace = filepath.Join(home, ".vikingclaw", "workspace")
	}
	s := &Server{
		port:      port,
		router:    http.NewServeMux(),
		cfg:       cfg,
		startTime: time.Now(),
		browser:   browser.New(),
		engine:    automation.NewEngine(workspace),
		mem:       memory.NewStore(workspace),
		loop:      loop,
		toolReg:   toolReg,
		provider:  prov,
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	cors := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(200)
				return
			}
			h(w, r)
		}
	}

	s.router.HandleFunc("/api/status", cors(s.handleStatus))
	s.router.HandleFunc("/api/models", cors(s.handleModels))
	s.router.HandleFunc("/api/memory", cors(s.handleMemory))
	s.router.HandleFunc("/api/memory/search", cors(s.handleMemorySearch))
	s.router.HandleFunc("/api/security/audit", cors(s.handleAudit))
	s.router.HandleFunc("/api/budget", cors(s.handleBudget))
	s.router.HandleFunc("/api/agents", cors(s.handleAgents))
	s.router.HandleFunc("/api/cron", cors(s.handleCron))
	s.router.HandleFunc("/ws", cors(s.handleWebSocket))
	// Browser
	s.router.HandleFunc("/api/browser/status", cors(s.handleBrowserStatus))
	s.router.HandleFunc("/api/browser/navigate", cors(s.handleBrowserNavigate))
	s.router.HandleFunc("/api/browser/screenshot", cors(s.handleBrowserScreenshot))
	s.router.HandleFunc("/api/browser/execute", cors(s.handleBrowserExecute))
	s.router.HandleFunc("/api/browser/stop", cors(s.handleBrowserStop))
	// Automation
	s.router.HandleFunc("/api/automation/rules", cors(s.handleAutomationRules))
	s.router.HandleFunc("/api/automation/rule/add", cors(s.handleAutomationAddRule))
	s.router.HandleFunc("/api/automation/rule/toggle", cors(s.handleAutomationToggleRule))
	s.router.HandleFunc("/api/automation/rule/delete", cors(s.handleAutomationDeleteRule))
	s.router.HandleFunc("/api/automation/rule/run", cors(s.handleAutomationRunRule))
	s.router.HandleFunc("/api/automation/runs", cors(s.handleAutomationRuns))
	// Tools
	s.router.HandleFunc("/api/tools", cors(s.handleToolsList))
	s.router.HandleFunc("/api/tools/list", cors(s.handleToolsList)) // alias
	s.router.HandleFunc("/api/tools/execute", cors(s.handleToolsExecute))
	// LM Studio
	s.router.HandleFunc("/api/lmstudio/status", cors(s.handleLMStudioStatus))
	s.router.HandleFunc("/api/lmstudio/models", cors(s.handleLMStudioModels))
	// Chat
	s.router.HandleFunc("/api/chat", cors(s.handleChat))
	s.router.HandleFunc("/api/chat/stream", cors(s.handleChatStream))
	// Models extended
	s.router.HandleFunc("/api/models/running", cors(s.handleModelsRunning))
	s.router.HandleFunc("/api/models/delete", cors(s.handleModelsDelete))
	s.router.HandleFunc("/api/models/default", cors(s.handleModelsDefault))
	s.router.HandleFunc("/api/models/pull/stream", cors(s.handleModelsPullStream))
	// System & config
	s.router.HandleFunc("/api/system", cors(s.handleSystem))
	s.router.HandleFunc("/api/config", cors(s.handleAgentConfig))
	// Models pull
	s.router.HandleFunc("/api/models/pull", cors(s.handleModelsPull))
	// System analyzer + model assignments
	s.router.HandleFunc("/api/system/specs", cors(s.handleSystemSpecs))
	s.router.HandleFunc("/api/system/recommendations", cors(s.handleRecommendations))
	s.router.HandleFunc("/api/models/assign", cors(s.handleModelAssign))
	s.router.HandleFunc("/api/models/assignments", cors(s.handleModelAssignments))

	// Google Workspace
	s.router.HandleFunc("/api/google/status", cors(s.handleGoogleStatus))
	s.router.HandleFunc("/api/google/gmail", cors(s.handleGoogleGmail))
	s.router.HandleFunc("/api/google/calendar", cors(s.handleGoogleCalendar))
	s.router.HandleFunc("/api/google/drive", cors(s.handleGoogleDrive))

	// Landing page + install scripts
	s.router.Handle("/landing/", http.StripPrefix("/landing/", http.FileServer(http.Dir("./landing"))))
	s.router.HandleFunc("/install.sh", s.handleInstallSh)
	s.router.HandleFunc("/install.ps1", s.handleInstallPs1)

	// Serve React app — try binary-relative path first, then CWD
	uiDir := resolveUIDir()
	log.Info().Str("ui_dir", uiDir).Msg("🌐 Serving React app")
	s.router.Handle("/", http.FileServer(http.Dir(uiDir)))
}

// StartEngine starts the automation cron engine in the background.
func (s *Server) StartEngine(ctx context.Context) {
	go s.engine.Start(ctx)
}

// Start runs the HTTP server until ctx is cancelled.
func (s *Server) Start(ctx context.Context) error {
	srv := &http.Server{Addr: ":" + s.port, Handler: s.router}
	log.Info().Str("port", s.port).Msg("🖥️ HQ Dashboard starting")
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutCtx) //nolint:errcheck
	}()
	return srv.ListenAndServe()
}

// resolveUIDir returns the absolute path to ui/dist, looking next to the binary first.
func resolveUIDir() string {
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), "ui", "dist")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	// Fall back to CWD
	return "./ui/dist"
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}
