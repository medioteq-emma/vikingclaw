package providers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/medioteq/vikingclaw/pkg/config"
)

// Router sends requests to LM Studio first, then Ollama, then cloud.
type Router struct {
	lmstudio *LMStudioProvider
	local    Provider // Ollama
	cloud    Provider // OpenAI-compatible cloud
	budget   *TokenBudget
	mu       sync.Mutex
}

// TokenBudget tracks cloud API token usage.
type TokenBudget struct {
	DailyLimit int
	UsedToday  int
	ResetDate  string // YYYY-MM-DD
}

// NewRouter constructs a Router from provider config.
func NewRouter(cfg config.ProvidersConfig) *Router {
	r := &Router{
		budget: &TokenBudget{
			DailyLimit: cfg.TokenBudget.DailyLimit,
			ResetDate:  today(),
		},
	}

	// LM Studio: always wire in with defaults
	lmBase := cfg.LMStudio.BaseURL
	if lmBase == "" {
		lmBase = "http://localhost:1234"
	}
	lmKey := cfg.LMStudio.APIKey
	if lmKey == "" {
		lmKey = "lm-studio"
	}
	r.lmstudio = NewLMStudio(lmBase, lmKey, cfg.LMStudio.Timeout)

	// Ollama: local fallback
	if cfg.Ollama.BaseURL != "" {
		r.local = NewOllama(cfg.Ollama.BaseURL, cfg.Ollama.Model, cfg.Ollama.Timeout)
	}

	// Cloud OpenAI: last resort
	if cfg.OpenAI.APIKey != "" {
		r.cloud = NewOpenAI(cfg.OpenAI.BaseURL, cfg.OpenAI.APIKey, cfg.OpenAI.Model, cfg.OpenAI.Timeout)
	}

	return r
}

func (r *Router) Name() string { return "router" }

// LMStudio returns the LM Studio provider for status checks.
func (r *Router) LMStudio() *LMStudioProvider { return r.lmstudio }

// Available returns true if any provider is usable.
func (r *Router) Available() bool {
	if r.lmstudio != nil && r.lmstudio.Available() {
		return true
	}
	if r.local != nil && r.local.Available() {
		return true
	}
	if r.cloud != nil {
		return true
	}
	return false
}

// ActiveProvider returns the name of the first available provider.
func (r *Router) ActiveProvider() string {
	if r.lmstudio != nil && r.lmstudio.Available() {
		return "lmstudio"
	}
	if r.local != nil && r.local.Available() {
		return "ollama"
	}
	if r.cloud != nil {
		return "cloud"
	}
	return "none"
}

// Chat routes to LM Studio first, then Ollama, then cloud.
func (r *Router) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	// 1. Try LM Studio first (primary)
	if r.lmstudio != nil && r.lmstudio.Available() {
		resp, err := r.lmstudio.Chat(ctx, req)
		if err == nil {
			return resp, nil
		}
		// LM Studio failed — log and fall through
	}

	// 2. Try local Ollama
	if r.local != nil && r.local.Available() {
		resp, err := r.local.Chat(ctx, req)
		if err == nil {
			return resp, nil
		}
		// Local failed — fall through to cloud
	}

	// 3. Check daily token budget (reset at midnight)
	r.mu.Lock()
	r.maybeResetBudget()
	if r.budget.DailyLimit > 0 && r.budget.UsedToday >= r.budget.DailyLimit {
		r.mu.Unlock()
		return ChatResponse{}, fmt.Errorf(
			"daily token budget exceeded (%d / %d tokens). Set a higher limit or wait until tomorrow",
			r.budget.UsedToday, r.budget.DailyLimit,
		)
	}
	r.mu.Unlock()

	// 4. Fall back to cloud
	if r.cloud != nil {
		resp, err := r.cloud.Chat(ctx, req)
		if err != nil {
			return resp, err
		}
		r.mu.Lock()
		r.budget.UsedToday += resp.TokensUsed
		r.mu.Unlock()
		return resp, nil
	}

	return ChatResponse{}, fmt.Errorf("no provider available — is LM Studio or Ollama running?")
}

// BudgetStatus returns a human-readable budget summary.
func (r *Router) BudgetStatus() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.budget.DailyLimit == 0 {
		return fmt.Sprintf("cloud tokens used today: %d (no limit)", r.budget.UsedToday)
	}
	return fmt.Sprintf("cloud tokens: %d / %d (resets %s)", r.budget.UsedToday, r.budget.DailyLimit, r.budget.ResetDate)
}

func (r *Router) maybeResetBudget() {
	t := today()
	if r.budget.ResetDate != t {
		r.budget.UsedToday = 0
		r.budget.ResetDate = t
	}
}

func today() string {
	return time.Now().UTC().Format("2006-01-02")
}
