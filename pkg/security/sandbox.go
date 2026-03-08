package security

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/medioteq/vikingclaw/pkg/config"
)

// Autonomy levels.
const (
	ReadOnly   = "readonly"
	Supervised = "supervised"
	Full       = "full"
)

// SecurityPolicy enforces command, path, and rate-limit rules.
type SecurityPolicy struct {
	Autonomy          string
	AllowCommands     []string
	DenyCommands      []string
	ForbiddenPaths    []string
	MaxActionsPerHour int

	mu          sync.Mutex
	actionsHour int
	hourStart   time.Time
}

// NewPolicy constructs a SecurityPolicy from config.
func NewPolicy(cfg config.SecurityConfig) *SecurityPolicy {
	return &SecurityPolicy{
		Autonomy:          cfg.Autonomy,
		AllowCommands:     cfg.AllowCommands,
		DenyCommands:      cfg.DenyCommands,
		ForbiddenPaths:    cfg.ForbiddenPaths,
		MaxActionsPerHour: cfg.MaxActionsPerHour,
		hourStart:         time.Now(),
	}
}

// CheckCommand verifies a shell command is allowed under the current policy.
func (p *SecurityPolicy) CheckCommand(cmd string) error {
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		return fmt.Errorf("empty command")
	}
	base := filepath.Base(parts[0])

	// Deny list is checked in all modes
	for _, denied := range p.DenyCommands {
		if strings.EqualFold(base, denied) || strings.Contains(cmd, denied) {
			return fmt.Errorf("command denied by security policy: %s", base)
		}
	}

	switch p.Autonomy {
	case ReadOnly:
		return fmt.Errorf("commands are disabled in readonly mode")

	case Supervised:
		for _, allowed := range p.AllowCommands {
			if strings.EqualFold(base, allowed) {
				return nil
			}
		}
		return fmt.Errorf("command not in allowlist: %s (autonomy: supervised). Add it to security.allow_commands to permit it", base)

	case Full:
		// Only deny list applies — already checked above
		return nil

	default:
		return fmt.Errorf("unknown autonomy level: %s", p.Autonomy)
	}
}

// CheckPath verifies that a filesystem path is accessible.
// If writing is true, the path must also be within workspace.
func (p *SecurityPolicy) CheckPath(path, workspace string) error {
	// Reject path traversal attempts
	clean := filepath.Clean(path)
	if strings.Contains(path, "..") {
		return fmt.Errorf("path traversal not allowed: %s", path)
	}

	// Check forbidden paths
	for _, forbidden := range p.ForbiddenPaths {
		if strings.HasPrefix(clean, forbidden) {
			return fmt.Errorf("path is forbidden: %s", clean)
		}
	}

	_ = workspace // workspace enforcement handled by callers when needed
	return nil
}

// CheckPathWrite verifies a write target is inside workspace and not forbidden.
func (p *SecurityPolicy) CheckPathWrite(path, workspace string) error {
	if err := p.CheckPath(path, workspace); err != nil {
		return err
	}
	clean := filepath.Clean(path)
	wsClean := filepath.Clean(workspace)
	if !strings.HasPrefix(clean, wsClean) {
		return fmt.Errorf("write outside workspace is not allowed: %s", clean)
	}
	return nil
}

// CheckRateLimit records an action and returns an error if the hourly cap is exceeded.
func (p *SecurityPolicy) CheckRateLimit() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Reset counter if we've rolled into a new hour
	if time.Since(p.hourStart) > time.Hour {
		p.actionsHour = 0
		p.hourStart = time.Now()
	}

	if p.MaxActionsPerHour > 0 && p.actionsHour >= p.MaxActionsPerHour {
		return fmt.Errorf("rate limit exceeded: %d actions per hour (resets in ~%s)",
			p.MaxActionsPerHour,
			time.Until(p.hourStart.Add(time.Hour)).Round(time.Second),
		)
	}
	p.actionsHour++
	return nil
}

// ActionsThisHour returns the current action count.
func (p *SecurityPolicy) ActionsThisHour() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.actionsHour
}
