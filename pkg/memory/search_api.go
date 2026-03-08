package memory

import (
	"os"
	"path/filepath"
	"strings"
)

// SearchResult is a single memory search hit.
type SearchResult struct {
	Content    string  `json:"content"`
	Source     string  `json:"source"`
	Score      float64 `json:"score"`
	IsRelevant bool    `json:"is_relevant"`
}

// SearchAll does keyword-based search across all memory layers and returns
// up to 10 results sorted by relevance score.
func (m *MemoryStore) SearchAll(query string) []SearchResult {
	var results []SearchResult

	sources := map[string]string{
		"long_term": m.ReadLongTerm(),
		"daily":     m.ReadToday(),
		"history":   m.readHistoryTail(),
	}

	queryLower := strings.ToLower(query)
	queryWords := strings.Fields(queryLower)
	if len(queryWords) == 0 {
		return results
	}

	for source, content := range sources {
		if content == "" {
			continue
		}
		lines := strings.Split(content, "\n")
		for _, line := range lines {
			if strings.TrimSpace(line) == "" {
				continue
			}
			lineLower := strings.ToLower(line)
			score := 0.0
			for _, word := range queryWords {
				if strings.Contains(lineLower, word) {
					score += 1.0 / float64(len(queryWords))
				}
			}
			if score > 0 {
				results = append(results, SearchResult{
					Content:    line,
					Source:     source,
					Score:      score,
					IsRelevant: score >= 0.5,
				})
			}
		}
	}

	// Sort by score descending (insertion sort — small result sets)
	for i := 1; i < len(results); i++ {
		for j := i; j > 0 && results[j].Score > results[j-1].Score; j-- {
			results[j], results[j-1] = results[j-1], results[j]
		}
	}

	// Return top 10
	if len(results) > 10 {
		results = results[:10]
	}
	return results
}

// readHistoryTail returns the last 100 lines of HISTORY.md.
func (m *MemoryStore) readHistoryTail() string {
	data, err := os.ReadFile(filepath.Join(m.workspace, "memory", "HISTORY.md"))
	if err != nil {
		return ""
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) > 100 {
		lines = lines[len(lines)-100:]
	}
	return strings.Join(lines, "\n")
}
