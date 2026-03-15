package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
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

// RateLimiter implements a sliding-window per-IP rate limiter (max 60 req/min).
type RateLimiter struct {
	mu     sync.Mutex
	counts map[string][]time.Time
}

func newRateLimiter() *RateLimiter {
	return &RateLimiter{counts: make(map[string][]time.Time)}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	window := now.Add(-time.Minute)
	times := rl.counts[ip]
	var fresh []time.Time
	for _, t := range times {
		if t.After(window) {
			fresh = append(fresh, t)
		}
	}
	if len(fresh) >= 60 {
		rl.counts[ip] = fresh
		return false
	}
	rl.counts[ip] = append(fresh, now)
	return true
}

// statusRecorder wraps ResponseWriter to capture the status code for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	// Strip port
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}

// Server holds the HTTP server state.
type Server struct {
	port        string
	router      *http.ServeMux
	cfg         *config.Config
	startTime   time.Time
	browser     *browser.Browser
	engine      *automation.Engine
	mem         *memory.MemoryStore
	loop        *agent.AgentLoop
	toolReg     *tools.Registry
	provider    *providers.Router
	rateLimiter *RateLimiter
}

// NewServer creates a new API server bound to port.
func NewServer(port string, cfg *config.Config, loop *agent.AgentLoop, toolReg *tools.Registry, prov *providers.Router) *Server {
	workspace := cfg.Workspace
	if workspace == "" {
		home, _ := os.UserHomeDir()
		workspace = filepath.Join(home, ".vikingclaw", "workspace")
	}
	s := &Server{
		port:        port,
		router:      http.NewServeMux(),
		cfg:         cfg,
		startTime:   time.Now(),
		browser:     browser.New(),
		engine:      automation.NewEngine(workspace),
		mem:         memory.NewStore(workspace),
		loop:        loop,
		toolReg:     toolReg,
		provider:    prov,
		rateLimiter: newRateLimiter(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	// cors applies CORS headers, restricting to localhost origins.
	cors := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			allowed := origin == "" ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:")
			if allowed && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(204)
				return
			}
			h(w, r)
		}
	}

	// requestLog logs method, path, IP, status, and duration for every request.
	requestLog := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: 200}
			h(rec, r)
			log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("ip", clientIP(r)).
				Int("status", rec.status).
				Dur("dur", time.Since(start)).
				Msg("api")
		}
	}

	// rateLimit enforces per-IP rate limiting (60 req/min).
	rateLimit := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			if !s.rateLimiter.Allow(ip) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			h(w, r)
		}
	}

	// wrap combines cors + rateLimit + requestLog middleware.
	wrap := func(h http.HandlerFunc) http.HandlerFunc {
		return requestLog(rateLimit(cors(h)))
	}

	s.router.HandleFunc("/api/status", wrap(s.handleStatus))
	s.router.HandleFunc("/api/models", wrap(s.handleModels))
	s.router.HandleFunc("/api/memory", wrap(s.handleMemory))
	s.router.HandleFunc("/api/memory/search", wrap(s.handleMemorySearch))
	s.router.HandleFunc("/api/security/audit", wrap(s.handleAudit))
	s.router.HandleFunc("/api/sandbox/test", wrap(s.handleSandboxTest))
	s.router.HandleFunc("/api/budget", wrap(s.handleBudget))
	s.router.HandleFunc("/api/agents", wrap(s.handleAgents))
	s.router.HandleFunc("/api/cron", wrap(s.handleCron))
	s.router.HandleFunc("/ws", wrap(s.handleWebSocket))
	// Browser
	s.router.HandleFunc("/api/browser/status", wrap(s.handleBrowserStatus))
	s.router.HandleFunc("/api/browser/navigate", wrap(s.handleBrowserNavigate))
	s.router.HandleFunc("/api/browser/screenshot", wrap(s.handleBrowserScreenshot))
	s.router.HandleFunc("/api/browser/execute", wrap(s.handleBrowserExecute))
	s.router.HandleFunc("/api/browser/stop", wrap(s.handleBrowserStop))
	// Automation
	s.router.HandleFunc("/api/automation/rules", wrap(s.handleAutomationRules))
	s.router.HandleFunc("/api/automation/rule/add", wrap(s.handleAutomationAddRule))
	s.router.HandleFunc("/api/automation/rule/toggle", wrap(s.handleAutomationToggleRule))
	s.router.HandleFunc("/api/automation/rule/delete", wrap(s.handleAutomationDeleteRule))
	s.router.HandleFunc("/api/automation/rule/run", wrap(s.handleAutomationRunRule))
	s.router.HandleFunc("/api/automation/runs", wrap(s.handleAutomationRuns))
	// Tools
	s.router.HandleFunc("/api/tools", wrap(s.handleToolsList))
	s.router.HandleFunc("/api/tools/list", wrap(s.handleToolsList)) // alias
	s.router.HandleFunc("/api/tools/execute", wrap(s.handleToolsExecute))
	// LM Studio
	s.router.HandleFunc("/api/lmstudio/status", wrap(s.handleLMStudioStatus))
	s.router.HandleFunc("/api/lmstudio/models", wrap(s.handleLMStudioModels))
	// Chat
	s.router.HandleFunc("/api/chat", wrap(s.handleChat))
	s.router.HandleFunc("/api/chat/stream", wrap(s.handleChatStream))
	// Models extended
	s.router.HandleFunc("/api/models/running", wrap(s.handleModelsRunning))
	s.router.HandleFunc("/api/models/delete", wrap(s.handleModelsDelete))
	s.router.HandleFunc("/api/models/default", wrap(s.handleModelsDefault))
	s.router.HandleFunc("/api/models/pull/stream", wrap(s.handleModelsPullStream))
	// System & config
	s.router.HandleFunc("/api/system", wrap(s.handleSystem))
	s.router.HandleFunc("/api/config", wrap(s.handleAgentConfig))
	// Models pull
	s.router.HandleFunc("/api/models/pull", wrap(s.handleModelsPull))
	// System analyzer + model assignments
	s.router.HandleFunc("/api/system/specs", wrap(s.handleSystemSpecs))
	s.router.HandleFunc("/api/system/recommendations", wrap(s.handleRecommendations))
	s.router.HandleFunc("/api/models/assign", wrap(s.handleModelAssign))
	s.router.HandleFunc("/api/models/assignments", wrap(s.handleModelAssignments))

	// Google Workspace
	s.router.HandleFunc("/api/google/status", wrap(s.handleGoogleStatus))
	s.router.HandleFunc("/api/google/gmail", wrap(s.handleGoogleGmail))
	s.router.HandleFunc("/api/google/calendar", wrap(s.handleGoogleCalendar))
	s.router.HandleFunc("/api/google/drive", wrap(s.handleGoogleDrive))

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
