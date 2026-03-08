package agent

import (
	"strings"
	"unicode/utf8"

	"github.com/medioteq/vikingclaw/pkg/providers"
)

const (
	// Rough token estimate: 1 token ≈ 4 chars for English text
	charsPerToken = 4
	// Leave headroom for response
	systemPromptTokenBudget = 2048
)

// EstimateTokens gives a rough token count for a string.
func EstimateTokens(s string) int {
	return utf8.RuneCountInString(s) / charsPerToken
}

// TruncateToTokens truncates s to approximately maxTokens tokens.
func TruncateToTokens(s string, maxTokens int) string {
	maxChars := maxTokens * charsPerToken
	runes := []rune(s)
	if len(runes) <= maxChars {
		return s
	}
	return string(runes[:maxChars]) + "\n[truncated]"
}

// MessagesToText converts messages to a flat text representation for token counting.
func MessagesToText(messages []providers.Message) string {
	var sb strings.Builder
	for _, m := range messages {
		sb.WriteString(m.Role)
		sb.WriteString(": ")
		sb.WriteString(m.Content)
		sb.WriteString("\n")
	}
	return sb.String()
}

// TrimContextToFit trims the oldest non-system messages to stay within a token budget.
func TrimContextToFit(messages []providers.Message, maxTokens int) []providers.Message {
	if len(messages) <= 2 {
		return messages
	}

	for {
		text := MessagesToText(messages)
		if EstimateTokens(text) <= maxTokens || len(messages) <= 2 {
			break
		}
		// Remove the oldest non-system message (index 1, after system prompt)
		if len(messages) > 2 {
			messages = append(messages[:1], messages[2:]...)
		}
	}
	return messages
}

// SplitMessage splits a long message into chunks of at most maxLen runes.
// Used when sending responses to channels with message size limits (e.g. Telegram 4096).
func SplitMessage(text string, maxLen int) []string {
	runes := []rune(text)
	if len(runes) <= maxLen {
		return []string{text}
	}

	var chunks []string
	for len(runes) > 0 {
		end := maxLen
		if end > len(runes) {
			end = len(runes)
		}
		// Try to break at a newline
		if end < len(runes) {
			for i := end; i > end-200 && i > 0; i-- {
				if runes[i] == '\n' {
					end = i + 1
					break
				}
			}
		}
		chunks = append(chunks, string(runes[:end]))
		runes = runes[end:]
	}
	return chunks
}
