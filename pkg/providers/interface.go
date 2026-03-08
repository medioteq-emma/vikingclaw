package providers

import "context"

// Provider is the common interface for all LLM backends.
type Provider interface {
	// Chat sends a request and returns a response.
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)
	// Available returns true if this provider is reachable right now.
	Available() bool
	// Name returns the provider identifier.
	Name() string
}

// Message is a single chat turn.
type Message struct {
	Role       string     `json:"role"`                  // system | user | assistant | tool
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

// ToolCall represents a function call requested by the model.
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ChatRequest is the input to a chat completion.
type ChatRequest struct {
	Messages    []Message        `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	Temperature float64          `json:"temperature"`
	MaxTokens   int              `json:"max_tokens"`
}

// ChatResponse is the model's reply.
type ChatResponse struct {
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	TokensUsed int        `json:"tokens_used"`
	Provider   string     `json:"provider"`
}

// ToolDefinition describes a callable tool to the LLM.
type ToolDefinition struct {
	Type     string         `json:"type"` // always "function"
	Function FunctionSchema `json:"function"`
}

// FunctionSchema is the JSON Schema of a tool function.
type FunctionSchema struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}
