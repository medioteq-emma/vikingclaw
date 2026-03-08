package bus

import "time"

// EventType identifies the kind of event.
type EventType string

const (
	EventMessage    EventType = "message"
	EventToolCall   EventType = "tool_call"
	EventToolResult EventType = "tool_result"
	EventError      EventType = "error"
	EventShutdown   EventType = "shutdown"
)

// Event is a message on the internal event bus.
type Event struct {
	Type      EventType   `json:"type"`
	Source    string      `json:"source"`    // e.g. "telegram", "agent", "tool"
	SessionID string      `json:"session_id"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// MessagePayload carries a chat message.
type MessagePayload struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	UserID  string `json:"user_id,omitempty"`
}

// ToolCallPayload carries a tool invocation.
type ToolCallPayload struct {
	ToolName  string                 `json:"tool_name"`
	Arguments map[string]interface{} `json:"arguments"`
	Result    string                 `json:"result,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

// ErrorPayload carries an error.
type ErrorPayload struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}
