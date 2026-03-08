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

// OpenAIProvider is compatible with OpenAI, Groq, and any OpenAI-compat API.
type OpenAIProvider struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
}

// NewOpenAI constructs an OpenAIProvider.
func NewOpenAI(baseURL, apiKey, model string, timeoutSecs int) *OpenAIProvider {
	if timeoutSecs <= 0 {
		timeoutSecs = 60
	}
	return &OpenAIProvider{
		baseURL: baseURL,
		apiKey:  apiKey,
		model:   model,
		client:  &http.Client{Timeout: time.Duration(timeoutSecs) * time.Second},
	}
}

func (o *OpenAIProvider) Name() string { return "openai" }

// Available checks if the API is reachable (does not consume tokens).
func (o *OpenAIProvider) Available() bool {
	if o.apiKey == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.baseURL+"/v1/models", nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	resp, err := o.client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// --- request/response types ---

type openAIChatRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	Temperature float64         `json:"temperature"`
	MaxTokens   int             `json:"max_tokens"`
}

type openAIMessage struct {
	Role       string             `json:"role"`
	Content    string             `json:"content"`
	ToolCalls  []openAIToolCall   `json:"tool_calls,omitempty"`
	ToolCallID string             `json:"tool_call_id,omitempty"`
}

type openAIToolCall struct {
	ID       string              `json:"id"`
	Type     string              `json:"type"` // "function"
	Function openAIToolCallFunc  `json:"function"`
}

type openAIToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

type openAIChatResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Chat sends a completion request to the OpenAI-compatible endpoint.
func (o *OpenAIProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	msgs := make([]openAIMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		om := openAIMessage{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
		for _, tc := range m.ToolCalls {
			argBytes, _ := json.Marshal(tc.Arguments)
			om.ToolCalls = append(om.ToolCalls, openAIToolCall{
				ID:   tc.ID,
				Type: "function",
				Function: openAIToolCallFunc{
					Name:      tc.Name,
					Arguments: string(argBytes),
				},
			})
		}
		msgs = append(msgs, om)
	}

	body := openAIChatRequest{
		Model:       o.model,
		Messages:    msgs,
		Tools:       req.Tools,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return ChatResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+"/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return ChatResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.client.Do(httpReq)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("openai read: %w", err)
	}

	var raw openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		return ChatResponse{}, fmt.Errorf("openai decode: %w", err)
	}

	if raw.Error != nil {
		return ChatResponse{}, fmt.Errorf("openai API error: %s", raw.Error.Message)
	}

	if len(raw.Choices) == 0 {
		return ChatResponse{}, fmt.Errorf("openai: empty response")
	}

	msg := raw.Choices[0].Message
	chatResp := ChatResponse{
		Content:    msg.Content,
		TokensUsed: raw.Usage.TotalTokens,
		Provider:   "openai",
	}

	// Convert tool calls — parse Arguments JSON string back to map
	for _, tc := range msg.ToolCalls {
		var args map[string]interface{}
		if tc.Function.Arguments != "" {
			_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
		}
		chatResp.ToolCalls = append(chatResp.ToolCalls, ToolCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: args,
		})
	}

	return chatResp, nil
}
