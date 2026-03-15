# Getting Started with VikingClaw ⚔️

Your personal AI that runs on your computer. Private. Free. No internet needed after setup.

---

## What you need
- Windows, Mac, or Linux computer
- 8GB RAM minimum (16GB recommended)
- 5GB free disk space

---

## Quick Install

### Windows
Open **PowerShell** (press Windows key, type "PowerShell", press Enter) and paste:
```
irm https://vikingclaw.com/install.ps1 | iex
```

### Mac / Linux
Open **Terminal** and paste:
```
curl -fsSL https://vikingclaw.com/install.sh | sh
```

---

## Add an AI Model (required)

Pick one option:

### Option A — LM Studio (easiest, no command line needed)
1. Go to **https://lmstudio.ai** and download
2. Open LM Studio → search **"Qwen 2.5 7B"** → click Download
3. After download → click **Local Server** on the left → click **Start Server**

### Option B — Ollama (lightweight)
1. Go to **https://ollama.ai** and download
2. Open Terminal/PowerShell and run: `ollama pull qwen2.5:7b`

---

## Start VikingClaw

```
vikingclaw start
```

Then open your browser: **http://localhost:7070**

---

## Tour of the Dashboard

**💬 Chat** — Talk to your AI. Ask anything.

**🧠 System & Models** — See what AI models your PC can run. Download with one click.

**🔒 Security** — Shows what your AI has access to.

**🧠 Memory** — Your AI remembers conversations here.

**📧 Google** — Connect Gmail, Calendar, Drive to your AI.

**🌐 Browser** — Your AI can browse the web for you.

**⚡ Automation** — Schedule tasks to run automatically.

---

## Common Fixes

| Problem | Fix |
|---------|-----|
| "vikingclaw not found" | Close and reopen terminal, try again |
| AI not responding | Start LM Studio or Ollama first |
| Can't open dashboard | Run `vikingclaw start` first |

---

*Free and open source. Your data stays on your computer.*

📖 Full docs: https://github.com/medioteq-emma/vikingclaw
