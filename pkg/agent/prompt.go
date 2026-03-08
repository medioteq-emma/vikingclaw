package agent

import (
	"fmt"
	"strings"
	"time"
)

// PromptBuilder assembles system prompts from components.
type PromptBuilder struct {
	parts []string
}

// NewPromptBuilder creates a PromptBuilder.
func NewPromptBuilder() *PromptBuilder {
	return &PromptBuilder{}
}

// AddSection adds a named section to the prompt.
func (b *PromptBuilder) AddSection(title, content string) *PromptBuilder {
	if content == "" {
		return b
	}
	b.parts = append(b.parts, fmt.Sprintf("## %s\n%s", title, strings.TrimSpace(content)))
	return b
}

// AddRaw adds raw text without a header.
func (b *PromptBuilder) AddRaw(content string) *PromptBuilder {
	if content = strings.TrimSpace(content); content != "" {
		b.parts = append(b.parts, content)
	}
	return b
}

// AddTimestamp adds a current-time line.
func (b *PromptBuilder) AddTimestamp() *PromptBuilder {
	b.parts = append(b.parts, fmt.Sprintf(
		"Current time: %s",
		time.Now().Format("Monday, January 2, 2006 3:04 PM MST"),
	))
	return b
}

// Build assembles the prompt with double-newline separators.
func (b *PromptBuilder) Build() string {
	return strings.Join(b.parts, "\n\n")
}
