package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Load reads the config from ~/.vikingclaw/config.yaml.
func Load() (*Config, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, ".vikingclaw", "config.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config not found at %s — run 'vikingclaw onboard' first", path)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	cfg.ApplyDefaults()
	return &cfg, nil
}

// Save writes the config to ~/.vikingclaw/config.yaml (mode 0600).
func Save(cfg *Config) error {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".vikingclaw")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	path := filepath.Join(dir, "config.yaml")
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

// ApplyDefaults fills in zero values with sensible defaults.
func (c *Config) ApplyDefaults() {
	if c.Agent.Name == "" {
		c.Agent.Name = "Viking"
	}
	if c.Agent.MaxIter == 0 {
		c.Agent.MaxIter = 10
	}
	if c.Agent.Temperature == 0 {
		c.Agent.Temperature = 0.1
	}
	if c.Agent.MaxTokens == 0 {
		c.Agent.MaxTokens = 4096
	}
	if c.Providers.LMStudio.BaseURL == "" {
		c.Providers.LMStudio.BaseURL = "http://localhost:1234"
	}
	if c.Providers.LMStudio.APIKey == "" {
		c.Providers.LMStudio.APIKey = "lm-studio"
	}
	if c.Providers.LMStudio.Timeout == 0 {
		c.Providers.LMStudio.Timeout = 120
	}
	if c.Providers.Ollama.BaseURL == "" {
		c.Providers.Ollama.BaseURL = "http://localhost:11434"
	}
	if c.Providers.Ollama.Model == "" {
		c.Providers.Ollama.Model = "qwen2.5:7b"
	}
	if c.Providers.Ollama.Timeout == 0 {
		c.Providers.Ollama.Timeout = 120
	}
	if c.Providers.OpenAI.BaseURL == "" {
		c.Providers.OpenAI.BaseURL = "https://api.openai.com"
	}
	if c.Providers.OpenAI.Model == "" {
		c.Providers.OpenAI.Model = "gpt-4o-mini"
	}
	if c.Providers.OpenAI.Timeout == 0 {
		c.Providers.OpenAI.Timeout = 60
	}
	if c.Security.Autonomy == "" {
		c.Security.Autonomy = "supervised"
	}
	if c.Security.MaxActionsPerHour == 0 {
		c.Security.MaxActionsPerHour = 100
	}
	if c.Workspace == "" {
		home, _ := os.UserHomeDir()
		c.Workspace = filepath.Join(home, ".vikingclaw", "workspace")
	}
	if len(c.Security.ForbiddenPaths) == 0 {
		c.Security.ForbiddenPaths = []string{
			"/etc", "/root/.ssh", "/boot",
			"C:\\Windows", "C:\\Users",
		}
	}
	if len(c.Security.AllowCommands) == 0 {
		c.Security.AllowCommands = []string{
			"ls", "cat", "echo", "pwd", "find", "grep",
			"git", "go", "python3", "node",
			"curl", "wget", "docker", "wsl",
			"head", "tail", "wc", "sort", "uniq",
			"mkdir", "cp", "mv", "touch",
		}
	}
	if len(c.Security.DenyCommands) == 0 {
		c.Security.DenyCommands = []string{
			"rm", "rmdir", "dd", "mkfs", "fdisk",
			"shutdown", "reboot", "halt",
			"passwd", "su", "sudo",
			"nc", "netcat", "ncat",
		}
	}
}
