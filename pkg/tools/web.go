package tools

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const (
	maxWebBytes   = 50 * 1024 // 50 KB
	webUserAgent  = "VikingClaw/1.0 (+https://github.com/medioteq/vikingclaw)"
)

// WebTool fetches URLs and returns plain-text content.
type WebTool struct {
	client *http.Client
}

// NewWebTool creates a WebTool.
func NewWebTool() *WebTool {
	return &WebTool{
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (t *WebTool) Name() string { return "web_fetch" }

func (t *WebTool) Description() string {
	return "Fetch a URL and return its text content (HTML stripped). Useful for reading documentation, web pages, or APIs."
}

func (t *WebTool) Parameters() map[string]ToolParam {
	return map[string]ToolParam{
		"url": {
			Type:        "string",
			Description: "The URL to fetch.",
			Required:    true,
		},
	}
}

func (t *WebTool) Execute(ctx context.Context, params map[string]interface{}) (string, error) {
	url, _ := params["url"].(string)
	if url == "" {
		return "", fmt.Errorf("url is required")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("web_fetch: invalid URL: %w", err)
	}
	req.Header.Set("User-Agent", webUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/json,text/plain")

	resp, err := t.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("web_fetch: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("web_fetch: HTTP %d for %s", resp.StatusCode, url)
	}

	limited := io.LimitReader(resp.Body, maxWebBytes)
	body, err := io.ReadAll(limited)
	if err != nil {
		return "", fmt.Errorf("web_fetch: read error: %w", err)
	}

	content := stripHTML(string(body))
	content = strings.TrimSpace(content)

	truncated := ""
	if len(body) >= maxWebBytes {
		truncated = "\n[content truncated at 50 KB]"
	}

	return fmt.Sprintf("URL: %s\nStatus: %d\n\n%s%s", url, resp.StatusCode, content, truncated), nil
}

// stripHTML removes HTML tags and collapses whitespace.
func stripHTML(s string) string {
	// Remove script and style blocks entirely
	scriptRe := regexp.MustCompile(`(?is)<(script|style)[^>]*>.*?</(script|style)>`)
	s = scriptRe.ReplaceAllString(s, "")

	// Remove all HTML tags
	tagRe := regexp.MustCompile(`<[^>]+>`)
	s = tagRe.ReplaceAllString(s, " ")

	// Decode common HTML entities
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&nbsp;", " ")

	// Collapse whitespace
	wsRe := regexp.MustCompile(`[ \t]+`)
	s = wsRe.ReplaceAllString(s, " ")
	lineRe := regexp.MustCompile(`\n{3,}`)
	s = lineRe.ReplaceAllString(s, "\n\n")

	return s
}
