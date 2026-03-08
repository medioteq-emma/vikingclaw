package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/adhocore/gronx"
	"github.com/rs/zerolog/log"
)

// TriggerType specifies how a rule is triggered.
type TriggerType string

const (
	TriggerCron    TriggerType = "cron"
	TriggerWebhook TriggerType = "webhook"
	TriggerManual  TriggerType = "manual"
)

// ActionType specifies what an action does.
type ActionType string

const (
	ActionShell   ActionType = "shell"
	ActionBrowser ActionType = "browser"
	ActionMessage ActionType = "message"
	ActionAI      ActionType = "ai"
)

// Rule is a single automation rule with trigger + actions.
type Rule struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Enabled    bool       `json:"enabled"`
	Trigger    Trigger    `json:"trigger"`
	Actions    []Action   `json:"actions"`
	LastRun    *time.Time `json:"last_run,omitempty"`
	LastStatus string     `json:"last_status,omitempty"`
	RunCount   int        `json:"run_count"`
	CreatedAt  time.Time  `json:"created_at"`
}

// Trigger defines when a rule fires.
type Trigger struct {
	Type     TriggerType `json:"type"`
	Schedule string      `json:"schedule,omitempty"` // cron expression
}

// Action is a single step in a rule.
type Action struct {
	Type   ActionType             `json:"type"`
	Params map[string]interface{} `json:"params"`
}

// Engine manages automation rules and executes them.
type Engine struct {
	rules     []Rule
	rulesPath string
	mu        sync.RWMutex
	gron      *gronx.Gronx
	runLog    []RunLogEntry
}

// RunLogEntry records one execution of a rule.
type RunLogEntry struct {
	RuleID    string    `json:"rule_id"`
	RuleName  string    `json:"rule_name"`
	StartedAt time.Time `json:"started_at"`
	Status    string    `json:"status"`
	Output    string    `json:"output,omitempty"`
	Error     string    `json:"error,omitempty"`
}

// NewEngine creates an Engine backed by workspace/automation.json.
func NewEngine(workspace string) *Engine {
	e := &Engine{
		rulesPath: filepath.Join(workspace, "automation.json"),
		gron:      gronx.New(),
	}
	e.loadRules()
	return e
}

func (e *Engine) loadRules() {
	data, err := os.ReadFile(e.rulesPath)
	if err != nil {
		e.rules = []Rule{}
		return
	}
	if err := json.Unmarshal(data, &e.rules); err != nil {
		e.rules = []Rule{}
	}
}

func (e *Engine) saveRules() error {
	data, err := json.MarshalIndent(e.rules, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(e.rulesPath, data, 0600)
}

// AddRule adds a new rule to the engine.
func (e *Engine) AddRule(rule Rule) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	rule.CreatedAt = time.Now()
	rule.Enabled = true
	e.rules = append(e.rules, rule)
	return e.saveRules()
}

// GetRules returns a copy of all rules.
func (e *Engine) GetRules() []Rule {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]Rule, len(e.rules))
	copy(result, e.rules)
	return result
}

// DeleteRule removes a rule by ID.
func (e *Engine) DeleteRule(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			e.rules = append(e.rules[:i], e.rules[i+1:]...)
			return e.saveRules()
		}
	}
	return nil
}

// ToggleRule flips the enabled flag for a rule.
func (e *Engine) ToggleRule(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	for i, r := range e.rules {
		if r.ID == id {
			e.rules[i].Enabled = !r.Enabled
			return e.saveRules()
		}
	}
	return nil
}

// GetRunLog returns a copy of the run log.
func (e *Engine) GetRunLog() []RunLogEntry {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]RunLogEntry, len(e.runLog))
	copy(result, e.runLog)
	return result
}

// RunRule executes a rule immediately by ID (manual trigger).
func (e *Engine) RunRule(id string) error {
	e.mu.RLock()
	var found *Rule
	for i, r := range e.rules {
		if r.ID == id {
			cp := e.rules[i]
			found = &cp
			break
		}
	}
	e.mu.RUnlock()
	if found == nil {
		return fmt.Errorf("rule %s not found", id)
	}
	go e.executeRule(*found)
	return nil
}

// Start runs the cron check loop until ctx is cancelled.
func (e *Engine) Start(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	log.Info().Msg("⚡ Automation engine started")
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.checkCronRules()
		}
	}
}

func (e *Engine) checkCronRules() {
	e.mu.RLock()
	rules := make([]Rule, len(e.rules))
	copy(rules, e.rules)
	e.mu.RUnlock()

	now := time.Now()
	for _, rule := range rules {
		if !rule.Enabled || rule.Trigger.Type != TriggerCron {
			continue
		}
		due, _ := e.gron.IsDue(rule.Trigger.Schedule, now)
		if due {
			go e.executeRule(rule)
		}
	}
}

func (e *Engine) executeRule(rule Rule) {
	entry := RunLogEntry{
		RuleID:    rule.ID,
		RuleName:  rule.Name,
		StartedAt: time.Now(),
		Status:    "running",
	}
	log.Info().Str("rule", rule.Name).Msg("⚡ Executing automation rule")

	for _, action := range rule.Actions {
		switch action.Type {
		case ActionShell:
			cmd, _ := action.Params["command"].(string)
			entry.Output += fmt.Sprintf("Shell: %s\n", cmd)
		case ActionMessage:
			msg, _ := action.Params["message"].(string)
			entry.Output += fmt.Sprintf("Message: %s\n", msg)
		case ActionBrowser:
			url, _ := action.Params["url"].(string)
			entry.Output += fmt.Sprintf("Browser: navigate to %s\n", url)
		case ActionAI:
			prompt, _ := action.Params["prompt"].(string)
			entry.Output += fmt.Sprintf("AI: %s\n", prompt)
		}
	}

	entry.Status = "success"
	now := time.Now()

	e.mu.Lock()
	for i, r := range e.rules {
		if r.ID == rule.ID {
			e.rules[i].LastRun = &now
			e.rules[i].LastStatus = "success"
			e.rules[i].RunCount++
		}
	}
	if len(e.runLog) > 100 {
		e.runLog = e.runLog[len(e.runLog)-100:]
	}
	e.runLog = append(e.runLog, entry)
	e.saveRules() //nolint:errcheck
	e.mu.Unlock()
}
