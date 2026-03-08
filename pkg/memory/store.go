package memory

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// MemoryStore manages the 3-layer memory system.
type MemoryStore struct {
	workspace string
}

// NewStore creates a MemoryStore rooted at workspace.
func NewStore(workspace string) *MemoryStore {
	return &MemoryStore{workspace: workspace}
}

// --- Layer 1: SOUL.md ---

// ReadSoul returns the contents of SOUL.md, or "".
func (m *MemoryStore) ReadSoul() string {
	data, err := os.ReadFile(filepath.Join(m.workspace, "SOUL.md"))
	if err != nil {
		return ""
	}
	return string(data)
}

// --- Layer 1: MEMORY.md (long-term facts) ---

// ReadLongTerm returns the contents of MEMORY.md, or "".
func (m *MemoryStore) ReadLongTerm() string {
	data, err := os.ReadFile(filepath.Join(m.workspace, "MEMORY.md"))
	if err != nil {
		return ""
	}
	return string(data)
}

// AppendLongTerm adds a line to MEMORY.md atomically.
func (m *MemoryStore) AppendLongTerm(content string) error {
	path := filepath.Join(m.workspace, "MEMORY.md")
	existing, _ := os.ReadFile(path)
	updated := string(existing) + "\n" + content + "\n"
	return atomicWrite(path, updated)
}

// --- Layer 2: Daily logs (memory/YYYY/YYYYMMDD.md) ---

func (m *MemoryStore) dailyPath() string {
	now := time.Now()
	year := now.Format("2006")
	day := now.Format("20060102")
	return filepath.Join(m.workspace, "memory", year, day+".md")
}

// ReadToday returns today's daily log, or "".
func (m *MemoryStore) ReadToday() string {
	data, err := os.ReadFile(m.dailyPath())
	if err != nil {
		return ""
	}
	return string(data)
}

// AppendToday adds an entry to today's daily log atomically.
func (m *MemoryStore) AppendToday(entry string) error {
	path := m.dailyPath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	existing, _ := os.ReadFile(path)
	timestamp := time.Now().Format("15:04")
	updated := string(existing) + fmt.Sprintf("\n## %s\n%s\n", timestamp, entry)
	return atomicWrite(path, updated)
}

// --- Layer 3: HISTORY.md (grep-searchable event log) ---

func (m *MemoryStore) historyPath() string {
	return filepath.Join(m.workspace, "memory", "HISTORY.md")
}

// AppendHistory adds a one-liner to the grep-searchable history log.
func (m *MemoryStore) AppendHistory(line string) error {
	path := m.historyPath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n", line)
	return err
}

// --- Combined context ---

// LoadContext assembles long-term memory + today's notes into a single string
// suitable for injection into the system prompt.
func (m *MemoryStore) LoadContext(query string) string {
	longTerm := m.ReadLongTerm()
	today := m.ReadToday()

	var sb strings.Builder
	if longTerm != "" {
		sb.WriteString("## Long-term Memory\n")
		sb.WriteString(longTerm)
		sb.WriteString("\n\n")
	}
	if today != "" {
		sb.WriteString("## Today's Notes\n")
		sb.WriteString(today)
		sb.WriteString("\n")
	}
	return sb.String()
}

// --- atomic write helper ---

// atomicWrite writes data to path via a temp file + rename (crash-safe).
func atomicWrite(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
