package memory

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// Search scans HISTORY.md for lines matching query (case-insensitive).
// Returns up to maxResults lines.
func (m *MemoryStore) Search(query string, maxResults int) []string {
	path := m.historyPath()
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	lower := strings.ToLower(query)
	var results []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(strings.ToLower(line), lower) {
			results = append(results, line)
			if len(results) >= maxResults {
				break
			}
		}
	}
	return results
}

// ListDailyLogs returns a list of all daily log file paths, newest first.
func (m *MemoryStore) ListDailyLogs() ([]string, error) {
	base := filepath.Join(m.workspace, "memory")
	var files []string
	err := filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(path, ".md") && path != m.historyPath() {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Reverse for newest-first
	for i, j := 0, len(files)-1; i < j; i, j = i+1, j-1 {
		files[i], files[j] = files[j], files[i]
	}
	return files, nil
}
