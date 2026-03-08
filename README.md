# ⚔️ VikingClaw

**Local-first AI agent framework. Zero cloud by default. Runs on any hardware.**

VikingClaw is a self-hosted AI agent that runs your own models locally via [Ollama](https://ollama.com), falls back to cloud (OpenAI/Groq) only when needed, and is reachable over Telegram.

---

## Features

- 🏠 **Local-first** — Ollama integration, cloud only as explicit fallback
- 💬 **Telegram channel** — chat with your agent from anywhere
- 🛠️ **Tool use** — shell commands, filesystem, web fetch
- 🧠 **3-layer memory** — long-term MEMORY.md, daily logs, grep-searchable history
- 🔒 **Security sandbox** — allowlist/denylist, path traversal protection, rate limiting
- 📋 **Tamper-evident audit log** — SHA-256 chained entries
- 💰 **Token budget** — hard daily limit on cloud API usage

---

## Quick Start

### 1. Install Go 1.21+

```bash
# Ubuntu/WSL
wget https://go.dev/dl/go1.22.3.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.22.3.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### 2. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b
```

### 3. Build VikingClaw

```bash
cd /path/to/vikingclaw
go mod tidy
go build -o vikingclaw .
```

### 4. Onboard (interactive setup)

```bash
./vikingclaw onboard
```

This wizard will:
- Ask for your agent name, Telegram bot token, allowed user IDs
- Test Ollama connectivity
- Write `~/.vikingclaw/config.yaml`
- Create your workspace with `SOUL.md` and `AGENTS.md`

### 5. Start the agent

```bash
./vikingclaw start
```

---

## Configuration

Config lives at `~/.vikingclaw/config.yaml`:

```yaml
agent:
  name: Viking
  max_iter: 10
  temperature: 0.1
  max_tokens: 4096

providers:
  ollama:
    base_url: http://localhost:11434
    model: qwen2.5:7b
  openai:
    base_url: https://api.openai.com
    api_key: sk-...          # optional cloud fallback
    model: gpt-4o-mini
  token_budget:
    daily_limit: 50000       # 0 = unlimited

channels:
  telegram:
    bot_token: "123456:ABC..."
    allowed_users: [12345678]

security:
  autonomy: supervised       # readonly | supervised | full
  max_actions_per_hour: 100

workspace: ~/.vikingclaw/workspace
```

---

## Security Autonomy Levels

| Level | Shell Commands | File Writes |
|-------|---------------|-------------|
| `readonly` | ❌ Disabled | ❌ Disabled |
| `supervised` | ✅ Allowlist only | ✅ Workspace only |
| `full` | ✅ All except denylist | ✅ Workspace only |

---

## Project Structure

```
vikingclaw/
├── main.go
├── cmd/             # CLI commands (start, onboard)
├── pkg/
│   ├── agent/       # Core reasoning loop
│   ├── channels/    # Telegram channel
│   ├── config/      # Config schema + loader
│   ├── memory/      # 3-layer memory system
│   ├── providers/   # Ollama + OpenAI + Router
│   ├── security/    # Sandbox, scrubber, audit log
│   ├── tools/       # Shell, filesystem, web
│   └── bus/         # Internal event bus
└── workspace/       # Default workspace starter files
```

---

## License

MIT
