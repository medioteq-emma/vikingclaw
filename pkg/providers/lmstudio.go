package providers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// LMStudioProvider wraps OpenAIProvider for LM Studio's local OpenAI-compatible API.
// LM Studio runs at http://localhost:1234/v1 and accepts any API key.
type LMStudioProvider struct {
	inner   *OpenAIProvider
	baseURL string // e.g. "http://localhost:1234"
	client  *http.Client
}

// NewLMStudio constructs an LMStudio provider.
// baseURL should NOT include /v1 (the OpenAI provider appends it).
func NewLMStudio(baseURL, apiKey string, timeoutSecs int) *LMStudioProvider {
	if timeoutSecs <= 0 {
		timeoutSecs = 120
	}
	if apiKey == "" {
		apiKey = "lm-studio"
	}
	inner := NewOpenAI(baseURL, apiKey, "", timeoutSecs) // empty model = LM Studio uses whatever is loaded
	return &LMStudioProvider{
		inner:   inner,
		baseURL: baseURL,
		client:  &http.Client{Timeout: time.Duration(timeoutSecs) * time.Second},
	}
}

func (l *LMStudioProvider) Name() string { return "lmstudio" }

// Available pings the LM Studio /v1/models endpoint.
func (l *LMStudioProvider) Available() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, l.baseURL+"/v1/models", nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer lm-studio")
	resp, err := l.client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Chat sends a request to LM Studio (OpenAI-compatible).
func (l *LMStudioProvider) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	// Inject the active model name if we can get it quickly
	if l.inner.model == "" {
		if m := l.GetLoadedModel(); m != "" {
			l.inner.model = m
		}
	}
	resp, err := l.inner.Chat(ctx, req)
	if err != nil {
		return resp, err
	}
	resp.Provider = "lmstudio"
	return resp, nil
}

// GetLoadedModel fetches the first model from LM Studio's /v1/models list.
// Returns empty string if unavailable.
func (l *LMStudioProvider) GetLoadedModel() string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, l.baseURL+"/v1/models", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer lm-studio")
	resp, err := l.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ""
	}
	if len(result.Data) > 0 {
		return result.Data[0].ID
	}
	return ""
}

// GetAllModels returns all models from LM Studio.
func (l *LMStudioProvider) GetAllModels() []map[string]interface{} {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, l.baseURL+"/v1/models", nil)
	if err != nil {
		return nil
	}
	req.Header.Set("Authorization", "Bearer lm-studio")
	resp, err := l.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}
	return result.Data
}
