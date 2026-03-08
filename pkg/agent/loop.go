package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/medioteq/vikingclaw/pkg/config"
	"github.com/medioteq/vikingclaw/pkg/memory"
	"github.com/medioteq/vikingclaw/pkg/providers"
	"github.com/medioteq/vikingclaw/pkg/security"
	"github.com/medioteq/vikingclaw/pkg/tools"
	"github.com/rs/zerolog/log"
)

// StreamEvent is an incremental progress event emitted by ProcessStream.
type StreamEvent struct {
	Type     string `json:"type"`               // chunk | tool_start | tool_done | done | error
	Content  string `json:"content,omitempty"`  // for chunk
	Tool     string `json:"tool,omitempty"`     // for tool_start / tool_done
	Args     string `json:"args,omitempty"`     // for tool_start (JSON string)
	Result   string `json:"result,omitempty"`   // for tool_done
	Message  string `json:"message,omitempty"`  // for error
	Provider string `json:"provider,omitempty"` // for done — which backend answered
}

// AgentLoop is the core reasoning and tool-use engine.
type AgentLoop struct {
	provider providers.Provider
	memory   *memory.MemoryStore
	tools    *tools.Registry
	policy   *security.SecurityPolicy
	config   *config.AgentConfig
}

// NewLoop constructs an AgentLoop.
func NewLoop(
	provider providers.Provider,
	mem *memory.MemoryStore,
	toolReg *tools.Registry,
	policy *security.SecurityPolicy,
	cfg *config.AgentConfig,
) *AgentLoop {
	return &AgentLoop{
		provider: provider,
		memory:   mem,
		tools:    toolReg,
		policy:   policy,
		config:   cfg,
	}
}

// Process handles a single user message and returns the agent's response.
func (a *AgentLoop) Process(ctx context.Context, userMsg string, sessionID string) (string, error) {
	// 1. Load memory context
	memCtx := a.memory.LoadContext(userMsg)

	// 2. Build initial messages
	messages := []providers.Message{
		{Role: "system", Content: a.buildSystemPrompt(memCtx)},
		{Role: "user", Content: userMsg},
	}

	log.Debug().
		Str("session", sessionID).
		Str("msg", truncate(userMsg, 80)).
		Msg("agent processing")

	// 3. Tool-use loop
	for i := 0; i < a.config.MaxIter; i++ {
		req := providers.ChatRequest{
			Messages:    messages,
			Tools:       a.tools.ToDefinitions(),
			Temperature: a.config.Temperature,
			MaxTokens:   a.config.MaxTokens,
		}

		resp, err := a.provider.Chat(ctx, req)
		if err != nil {
			return "", fmt.Errorf("provider error: %w", err)
		}

		log.Debug().
			Int("iteration", i+1).
			Int("tool_calls", len(resp.ToolCalls)).
			Str("provider", resp.Provider).
			Msg("agent iteration")

		// No tool calls → this is the final answer
		if len(resp.ToolCalls) == 0 {
			// Persist to history asynchronously
			go func() {
				summary := fmt.Sprintf("[%s] [%s] User: %s | Agent: %s",
					time.Now().Format("2006-01-02 15:04"),
					sessionID,
					truncate(userMsg, 120),
					truncate(resp.Content, 200),
				)
				_ = a.memory.AppendHistory(summary)
			}()
			return resp.Content, nil
		}

		// Append assistant message with tool calls
		messages = append(messages, providers.Message{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		// Execute each tool call and append results
		for _, tc := range resp.ToolCalls {
			log.Info().
				Str("tool", tc.Name).
				Interface("args", tc.Arguments).
				Msg("executing tool")

			result, err := a.tools.Execute(ctx, tc.Name, tc.Arguments)
			if err != nil {
				result = fmt.Sprintf("error: %s", err)
				log.Warn().Str("tool", tc.Name).Err(err).Msg("tool error")
			}

			messages = append(messages, providers.Message{
				Role:       "tool",
				Content:    result,
				ToolCallID: tc.ID,
			})
		}
	}

	return "", fmt.Errorf("max iterations (%d) reached without a final response", a.config.MaxIter)
}

// buildSystemPrompt combines SOUL.md + memory context + timestamp.
func (a *AgentLoop) buildSystemPrompt(memCtx string) string {
	soul := a.memory.ReadSoul()
	var sb strings.Builder

	if soul != "" {
		sb.WriteString(soul)
		sb.WriteString("\n\n")
	}

	if memCtx != "" {
		sb.WriteString("## Memory\n")
		sb.WriteString(memCtx)
		sb.WriteString("\n\n")
	}

	sb.WriteString(fmt.Sprintf("Current time: %s\n", time.Now().Format("Monday, January 2, 2006 3:04 PM MST")))
	sb.WriteString(fmt.Sprintf("Agent: %s\n", a.config.Name))

	return sb.String()
}

// ProcessStream runs the agent loop and emits incremental SSE-style events on the
// returned channel. The channel is closed when processing finishes (or ctx is done).
// Tool calls emit tool_start / tool_done events; the final reply is emitted as a
// series of chunk events (word-by-word) followed by a done event.
func (a *AgentLoop) ProcessStream(ctx context.Context, userMsg string, sessionID string, events chan<- StreamEvent) {
	defer close(events)

	send := func(e StreamEvent) bool {
		select {
		case events <- e:
			return true
		case <-ctx.Done():
			return false
		}
	}

	// 1. Load memory context
	memCtx := a.memory.LoadContext(userMsg)

	// 2. Build initial messages
	messages := []providers.Message{
		{Role: "system", Content: a.buildSystemPrompt(memCtx)},
		{Role: "user", Content: userMsg},
	}

	log.Debug().
		Str("session", sessionID).
		Str("msg", truncate(userMsg, 80)).
		Msg("agent processing (stream)")

	// 3. Tool-use loop
	for i := 0; i < a.config.MaxIter; i++ {
		req := providers.ChatRequest{
			Messages:    messages,
			Tools:       a.tools.ToDefinitions(),
			Temperature: a.config.Temperature,
			MaxTokens:   a.config.MaxTokens,
		}

		resp, err := a.provider.Chat(ctx, req)
		if err != nil {
			send(StreamEvent{Type: "error", Message: err.Error()})
			return
		}

		log.Debug().
			Int("iteration", i+1).
			Int("tool_calls", len(resp.ToolCalls)).
			Msg("agent stream iteration")

		// No tool calls → stream final answer word-by-word
		if len(resp.ToolCalls) == 0 {
			words := strings.Fields(resp.Content)
			for j, word := range words {
				chunk := word
				if j < len(words)-1 {
					chunk += " "
				}
				if !send(StreamEvent{Type: "chunk", Content: chunk}) {
					return
				}
				time.Sleep(20 * time.Millisecond) // natural pacing
			}
			// Persist to history asynchronously
			go func() {
				summary := fmt.Sprintf("[%s] [%s] User: %s | Agent: %s",
					time.Now().Format("2006-01-02 15:04"),
					sessionID,
					truncate(userMsg, 120),
					truncate(resp.Content, 200),
				)
				_ = a.memory.AppendHistory(summary)
			}()
			send(StreamEvent{Type: "done", Provider: resp.Provider})
			return
		}

		// Append assistant message with tool calls
		messages = append(messages, providers.Message{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		// Execute each tool call
		for _, tc := range resp.ToolCalls {
			argsJSON, _ := json.Marshal(tc.Arguments)
			if !send(StreamEvent{Type: "tool_start", Tool: tc.Name, Args: string(argsJSON)}) {
				return
			}

			log.Info().
				Str("tool", tc.Name).
				Interface("args", tc.Arguments).
				Msg("executing tool (stream)")

			result, execErr := a.tools.Execute(ctx, tc.Name, tc.Arguments)
			if execErr != nil {
				result = fmt.Sprintf("error: %s", execErr)
				log.Warn().Str("tool", tc.Name).Err(execErr).Msg("tool error")
			}

			if !send(StreamEvent{Type: "tool_done", Tool: tc.Name, Result: truncate(result, 300)}) {
				return
			}

			messages = append(messages, providers.Message{
				Role:       "tool",
				Content:    result,
				ToolCallID: tc.ID,
			})
		}
	}

	send(StreamEvent{Type: "error", Message: fmt.Sprintf("max iterations (%d) reached without a final response", a.config.MaxIter)})
}

// truncate shortens s to max runes with an ellipsis.
func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "…"
}
