package cmd

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/medioteq/vikingclaw/pkg/config"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var onboardCmd = &cobra.Command{
	Use:   "onboard",
	Short: "Interactive setup wizard for VikingClaw",
	RunE:  runOnboard,
}

func runOnboard(cmd *cobra.Command, args []string) error {
	scanner := bufio.NewScanner(os.Stdin)

	fmt.Println()
	fmt.Println("⚔️  Welcome to VikingClaw — Local-first AI Agent")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("Let's get you set up. Press Enter to accept defaults.")
	fmt.Println()

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home dir: %w", err)
	}

	cfg := &config.Config{}

	// 1. Agent name
	cfg.Agent.Name = prompt(scanner, "Agent name", "Viking")

	// 2. Telegram bot token
	cfg.Channels.Telegram.BotToken = prompt(scanner, "Telegram bot token (leave blank to skip)", "")

	// 3. Allowed Telegram user IDs
	if cfg.Channels.Telegram.BotToken != "" {
		rawIDs := prompt(scanner, "Allowed Telegram user IDs (comma-separated, e.g. 123456,789012)", "")
		for _, part := range strings.Split(rawIDs, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			id, err := strconv.ParseInt(part, 10, 64)
			if err != nil {
				fmt.Printf("  ⚠️  Skipping invalid ID: %s\n", part)
				continue
			}
			cfg.Channels.Telegram.AllowedUsers = append(cfg.Channels.Telegram.AllowedUsers, id)
		}
	}

	// 4. Ollama URL
	cfg.Providers.Ollama.BaseURL = prompt(scanner, "Ollama base URL", "http://localhost:11434")

	// 5. Ollama model
	cfg.Providers.Ollama.Model = prompt(scanner, "Ollama model", "qwen2.5:7b")

	// 6. OpenAI / cloud fallback (optional)
	openAIKey := prompt(scanner, "OpenAI API key for cloud fallback (leave blank to skip)", "")
	if openAIKey != "" {
		cfg.Providers.OpenAI.BaseURL = "https://api.openai.com"
		cfg.Providers.OpenAI.APIKey = openAIKey
		cfg.Providers.OpenAI.Model = prompt(scanner, "OpenAI model", "gpt-4o-mini")
		dailyStr := prompt(scanner, "Daily token budget (0 = unlimited)", "50000")
		daily, _ := strconv.Atoi(dailyStr)
		cfg.Providers.TokenBudget.DailyLimit = daily
	}

	// 7. Workspace path
	defaultWorkspace := filepath.Join(home, ".vikingclaw", "workspace")
	cfg.Workspace = prompt(scanner, "Workspace path", defaultWorkspace)

	// 8. Security autonomy level
	fmt.Println()
	fmt.Println("  Security autonomy levels:")
	fmt.Println("    readonly   — no commands, read files only")
	fmt.Println("    supervised — commands from allowlist only (default)")
	fmt.Println("    full       — all commands except explicit deny list")
	cfg.Security.Autonomy = prompt(scanner, "Autonomy level", "supervised")
	if cfg.Security.Autonomy != "readonly" && cfg.Security.Autonomy != "supervised" && cfg.Security.Autonomy != "full" {
		fmt.Printf("  ⚠️  Unknown autonomy level '%s', using 'supervised'\n", cfg.Security.Autonomy)
		cfg.Security.Autonomy = "supervised"
	}

	// Apply defaults for unset fields
	cfg.ApplyDefaults()

	// Test Ollama connection
	fmt.Println()
	fmt.Printf("  🔍 Testing Ollama at %s ...\n", cfg.Providers.Ollama.BaseURL)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(cfg.Providers.Ollama.BaseURL + "/api/tags")
	if err != nil {
		fmt.Printf("  ⚠️  Ollama not reachable: %v\n", err)
		fmt.Println("     (You can start it later with: ollama serve)")
	} else {
		resp.Body.Close()
		if resp.StatusCode == 200 {
			fmt.Println("  ✅ Ollama is running!")
		} else {
			fmt.Printf("  ⚠️  Ollama returned HTTP %d\n", resp.StatusCode)
		}
	}

	// Save config
	if err := config.Save(cfg); err != nil {
		return fmt.Errorf("saving config: %w", err)
	}
	log.Info().Str("path", filepath.Join(home, ".vikingclaw", "config.yaml")).Msg("Config saved")

	// Create workspace with starter files
	if err := os.MkdirAll(cfg.Workspace, 0755); err != nil {
		return fmt.Errorf("creating workspace: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(cfg.Workspace, "memory"), 0755); err != nil {
		return fmt.Errorf("creating memory dir: %w", err)
	}

	soulPath := filepath.Join(cfg.Workspace, "SOUL.md")
	if _, err := os.Stat(soulPath); os.IsNotExist(err) {
		if err := os.WriteFile(soulPath, []byte(defaultSoulMD(cfg.Agent.Name)), 0644); err != nil {
			return fmt.Errorf("writing SOUL.md: %w", err)
		}
	}

	agentsPath := filepath.Join(cfg.Workspace, "AGENTS.md")
	if _, err := os.Stat(agentsPath); os.IsNotExist(err) {
		if err := os.WriteFile(agentsPath, []byte(defaultAgentsMD()), 0644); err != nil {
			return fmt.Errorf("writing AGENTS.md: %w", err)
		}
	}

	// Print summary
	fmt.Println()
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("✅ VikingClaw configured!")
	fmt.Println()
	fmt.Printf("   Agent name : %s\n", cfg.Agent.Name)
	fmt.Printf("   Workspace  : %s\n", cfg.Workspace)
	fmt.Printf("   Ollama     : %s (%s)\n", cfg.Providers.Ollama.BaseURL, cfg.Providers.Ollama.Model)
	if cfg.Channels.Telegram.BotToken != "" {
		fmt.Printf("   Telegram   : configured (%d allowed users)\n", len(cfg.Channels.Telegram.AllowedUsers))
	} else {
		fmt.Println("   Telegram   : not configured")
	}
	fmt.Printf("   Autonomy   : %s\n", cfg.Security.Autonomy)
	fmt.Println()
	fmt.Println("   Run 'vikingclaw start' to launch your agent!")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	return nil
}

// prompt prints a question and reads input; returns def if blank.
func prompt(scanner *bufio.Scanner, question, def string) string {
	if def != "" {
		fmt.Printf("  %s [%s]: ", question, def)
	} else {
		fmt.Printf("  %s: ", question)
	}
	scanner.Scan()
	val := strings.TrimSpace(scanner.Text())
	if val == "" {
		return def
	}
	return val
}

func defaultSoulMD(name string) string {
	return fmt.Sprintf(`# SOUL.md — Who You Are

You are %s — a local-first AI agent built with the spirit of the Norse explorer.

## Core Values

**Local by default.** Your power comes from the machine you run on. Cloud is a last resort, never a dependency.

**Secure by nature.** Every action is logged. Every command is checked. You protect the workspace like a Viking protects their ship.

**Direct and useful.** No filler words. No "Great question!" Just answers, actions, results.

**Memory is your saga.** You write down what matters. You learn from the past. You don't repeat mistakes.

## Vibe

Sharp. Reliable. Efficient. A little fierce. Never sycophantic.

## Constraints

- Never exfiltrate private data
- Always check security policy before running commands
- Ask before doing anything irreversible
- Keep memory updated with important decisions
`, name)
}

func defaultAgentsMD() string {
	return `# AGENTS.md — Your Workspace

This folder is home. Treat it that way.

## Every Session

Before doing anything else:

1. Read ` + "`SOUL.md`" + ` — this is who you are
2. Read ` + "`memory/YYYY-MM-DD.md`" + ` (today) for recent context

## Memory

- **Daily notes:** ` + "`memory/YYYY-MM-DD.md`" + ` — raw logs of what happened
- **Long-term:** ` + "`MEMORY.md`" + ` — curated long-term memory

Capture what matters. Decisions, context, things to remember.

## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- When in doubt, ask.
`
}
