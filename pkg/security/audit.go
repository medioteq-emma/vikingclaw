package security

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// AuditLog is a tamper-evident append-only log using SHA-256 hash chaining.
type AuditLog struct {
	path     string
	mu       sync.Mutex
	lastHash string
}

// AuditEntry is a single audit log line.
type AuditEntry struct {
	TS       time.Time `json:"ts"`
	Agent    string    `json:"agent"`
	Action   string    `json:"action"`
	Detail   string    `json:"detail"`
	Severity string    `json:"severity"`
	PrevHash string    `json:"prev_hash"`
	Hash     string    `json:"hash"`
}

// NewAuditLog opens (or creates) the audit log at path.
func NewAuditLog(workspace string) *AuditLog {
	path := filepath.Join(workspace, "audit.log")
	return &AuditLog{path: path}
}

// Append writes a new entry to the audit log.
func (a *AuditLog) Append(agent, action, detail, severity string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	entry := AuditEntry{
		TS:       time.Now().UTC(),
		Agent:    agent,
		Action:   action,
		Detail:   Scrub(detail), // scrub credentials before logging
		Severity: severity,
		PrevHash: a.lastHash,
	}

	// Compute hash over the entry fields (excluding Hash itself)
	hashInput, _ := json.Marshal(struct {
		TS                     time.Time
		Agent, Action, Detail  string
		Severity, PrevHash     string
	}{
		entry.TS, entry.Agent, entry.Action, entry.Detail,
		entry.Severity, entry.PrevHash,
	})
	h := sha256.Sum256(hashInput)
	entry.Hash = hex.EncodeToString(h[:])
	a.lastHash = entry.Hash

	line, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(a.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n", line)
	return err
}

// Verify reads the audit log and checks hash chain integrity.
// Returns (valid, error). valid=true means no tampering detected.
func (a *AuditLog) Verify() (bool, error) {
	data, err := os.ReadFile(a.path)
	if err != nil {
		if os.IsNotExist(err) {
			return true, nil // empty log is valid
		}
		return false, err
	}

	lines := splitLines(data)
	prevHash := ""

	for i, line := range lines {
		if line == "" {
			continue
		}
		var entry AuditEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			return false, fmt.Errorf("line %d: parse error: %w", i+1, err)
		}
		if entry.PrevHash != prevHash {
			return false, fmt.Errorf("line %d: hash chain broken (expected prev=%s got %s)", i+1, prevHash, entry.PrevHash)
		}
		// Recompute hash
		hashInput, _ := json.Marshal(struct {
			TS                     time.Time
			Agent, Action, Detail  string
			Severity, PrevHash     string
		}{
			entry.TS, entry.Agent, entry.Action, entry.Detail,
			entry.Severity, entry.PrevHash,
		})
		h := sha256.Sum256(hashInput)
		expected := hex.EncodeToString(h[:])
		if entry.Hash != expected {
			return false, fmt.Errorf("line %d: hash mismatch", i+1)
		}
		prevHash = entry.Hash
	}
	return true, nil
}

func splitLines(data []byte) []string {
	var lines []string
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, string(data[start:i]))
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, string(data[start:]))
	}
	return lines
}
