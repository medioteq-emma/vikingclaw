package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OllamaProvider talks to a local Ollama instance.
type OllamaProvider struct {
	baseURL string
	model   string
	client  *http.Client
}

// NewOllama constructs an OllamaProvider.
func NewOllama(baseURL, model string, timeoutSecs int) *OllamaProvider {
	if timeoutSecs <= 0 {
		timeoutSecs = 120
	}
	return &OllamaProvider{
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: time.Duration(timeoutSecs) * time.Second},
	}
}

func (o *OllamaProvider) Name() string { return "ollama" }

// Available pings the Ollama /api/tags endpoint.
func (o *OllamaProvider) Available() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.baseURL+"/api/tags", nil)
	if err != nil {
		return false
	}
	resp, err := o.client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// ollamaChatRequest is sent to /api/chat.
type ollamaChatRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
	Tools    []ToolDefinition `json:"tools,omitempty"`
	Options  map[string]interface{} `json:"options,omitempty"`
}

type ollamaMessage struct {
	Role      string             `json:"role"`
	Content   string             `json:"content"`
	ToolCalls []ollamaToolCall   `json:"tool_calls,omitempty"`
}

type ollamaToolCall struct {
	Function ollamaToolCallFunc `json:"function"`
}

type ollamaToolCallFunc struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ollamaChatResponse handles both Ollama-native and OpenAI-compat formats.
type ollamaChatResponse struct {
	// Ollama native
	Message *ollamaMessage `json:"message,omitempty"`
	// OpenAI-compat
	Choices []struct {
		Message ollamaMessage `json:"message"`
	} `json:"choices,omitempty"`
	// Usage
	PromptEvalCount int `json:"prompt_eval_count"`
	EvalCount       int `json:"eval_count"`
}

// Chat sends a completion request to Ollama.
func (o *OllamaProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	msgs := make([]ollamaMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		om := ollamaMessage{Role: m.Role, Content: m.Content}
		for _, tc := range m.ToolCalls {
			om.ToolCalls = append(om.ToolCalls, ollamaToolCall{
				Function: ollamaToolCallFunc{Name: tc.Name, Arguments: tc.Arguments},
			})
		}
		msgs = append(msgs, om)
	}

	body := ollamaChatRequest{
		Model:    o.model,
		Messages: msgs,
		Stream:   false,
		Tools:    req.Tools,
		Options: map[string]interface{}{
			"temperature": req.Temperature,
		},
	}

	data, err := json.Marshal(body)
	if err != nil {
		return ChatResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+"/api/chat", bytes.NewReader(data))
	if err != nil {
		return ChatResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := o.client.Do(httpReq)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return ChatResponse{}, fmt.Errorf("ollama HTTP %d: %s", resp.StatusCode, string(body))
	}

	var raw ollamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return ChatResponse{}, fmt.Errorf("ollama decode: %w", err)
	}

	// Extract message — try Ollama native first, then OpenAI-compat
	var msg ollamaMessage
	if raw.Message != nil {
		msg = *raw.Message
	} else if len(raw.Choices) > 0 {
		msg = raw.Choices[0].Message
	} else {
		return ChatResponse{}, fmt.Errorf("ollama: empty response")
	}

	chatResp := ChatResponse{
		Content:    msg.Content,
		TokensUsed: raw.PromptEvalCount + raw.EvalCount,
		Provider:   "ollama",
	}

	// Convert tool calls
	for i, tc := range msg.ToolCalls {
		chatResp.ToolCalls = append(chatResp.ToolCalls, ToolCall{
			ID:        fmt.Sprintf("call_%d", i),
			Name:      tc.Function.Name,
			Arguments: tc.Function.Arguments,
		})
	}

	return chatResp, nil
}
