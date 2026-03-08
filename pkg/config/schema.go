package config

// Config is the top-level VikingClaw configuration.
type Config struct {
	Agent     AgentConfig     `yaml:"agent"`
	Providers ProvidersConfig `yaml:"providers"`
	Channels  ChannelsConfig  `yaml:"channels"`
	Security  SecurityConfig  `yaml:"security"`
	Workspace string          `yaml:"workspace"`
}

// AgentConfig controls agent behaviour.
type AgentConfig struct {
	Name        string  `yaml:"name"`
	MaxIter     int     `yaml:"max_iter"`
	Temperature float64 `yaml:"temperature"`
	MaxTokens   int     `yaml:"max_tokens"`
}

// ProvidersConfig holds all LLM provider settings.
type ProvidersConfig struct {
	LMStudio    LMStudioConfig    `yaml:"lmstudio"`
	Ollama      OllamaConfig      `yaml:"ollama"`
	OpenAI      OpenAIConfig      `yaml:"openai"`
	TokenBudget TokenBudgetConfig `yaml:"token_budget"`
}

// LMStudioConfig is the LM Studio local provider (OpenAI-compatible API).
type LMStudioConfig struct {
	BaseURL string `yaml:"base_url"`
	APIKey  string `yaml:"api_key"` // any value works; defaults to "lm-studio"
	Timeout int    `yaml:"timeout"` // seconds
}

// OllamaConfig is the local Ollama provider.
type OllamaConfig struct {
	BaseURL string `yaml:"base_url"`
	Model   string `yaml:"model"`
	Timeout int    `yaml:"timeout"` // seconds
}

// OpenAIConfig covers OpenAI-compatible cloud providers.
type OpenAIConfig struct {
	BaseURL string `yaml:"base_url"`
	APIKey  string `yaml:"api_key"`
	Model   string `yaml:"model"`
	Timeout int    `yaml:"timeout"` // seconds
}

// TokenBudgetConfig limits cloud API spend.
type TokenBudgetConfig struct {
	DailyLimit int `yaml:"daily_limit"` // 0 = unlimited
}

// ChannelsConfig holds all messaging channel configurations.
type ChannelsConfig struct {
	Telegram TelegramConfig `yaml:"telegram"`
}

// TelegramConfig is the Telegram bot channel.
type TelegramConfig struct {
	BotToken     string  `yaml:"bot_token"`
	AllowedUsers []int64 `yaml:"allowed_users"`
}

// SecurityConfig defines the agent's security posture.
type SecurityConfig struct {
	Autonomy          string   `yaml:"autonomy"`           // readonly | supervised | full
	AllowCommands     []string `yaml:"allow_commands"`     // allowlist for supervised mode
	DenyCommands      []string `yaml:"deny_commands"`      // always-denied commands
	ForbiddenPaths    []string `yaml:"forbidden_paths"`    // paths never accessible
	MaxActionsPerHour int      `yaml:"max_actions_per_hour"`
}
