package system

import "fmt"

// ModelRecommendation describes a model and its compatibility with the current system.
type ModelRecommendation struct {
	Name        string   `json:"name"`
	Tag         string   `json:"tag"`
	SizeGB      float64  `json:"size_gb"`
	Role        string   `json:"role"`
	Description string   `json:"description"`
	Reason      string   `json:"reason"`
	Performance string   `json:"performance"` // "fast" | "balanced" | "smart" | "genius"
	Compatible  bool     `json:"compatible"`
	Installed   bool     `json:"installed"`
	Recommended bool     `json:"recommended"`
	RAMRequired float64  `json:"ram_required_gb"`
	Tags        []string `json:"tags"`
}

var modelCatalog = []ModelRecommendation{
	// Tiny / routing
	{Name: "phi3:mini", Tag: "phi3:mini", SizeGB: 2.2, Role: "routing", Performance: "fast", RAMRequired: 4, Description: "Microsoft Phi-3 Mini — ultra fast routing & summaries", Tags: []string{"fast", "routing", "summaries"}},
	{Name: "gemma2:2b", Tag: "gemma2:2b", SizeGB: 1.6, Role: "routing", Performance: "fast", RAMRequired: 3, Description: "Google Gemma2 2B — fastest responses", Tags: []string{"fast", "tiny"}},
	{Name: "qwen2.5:3b", Tag: "qwen2.5:3b", SizeGB: 1.9, Role: "chat", Performance: "fast", RAMRequired: 4, Description: "Qwen 2.5 3B — lightweight chat", Tags: []string{"fast", "chat"}},

	// 7B general
	{Name: "qwen2.5:7b", Tag: "qwen2.5:7b", SizeGB: 4.7, Role: "chat", Performance: "balanced", RAMRequired: 8, Description: "Qwen 2.5 7B — excellent general assistant", Tags: []string{"chat", "general"}, Recommended: true},
	{Name: "llama3.2:latest", Tag: "llama3.2:latest", SizeGB: 2.0, Role: "chat", Performance: "balanced", RAMRequired: 6, Description: "Meta Llama 3.2 — fast and capable", Tags: []string{"chat", "meta"}},
	{Name: "mistral:7b", Tag: "mistral:7b", SizeGB: 4.1, Role: "chat", Performance: "balanced", RAMRequired: 8, Description: "Mistral 7B — great for structured tasks", Tags: []string{"chat", "structured"}},
	{Name: "llama3.1:8b", Tag: "llama3.1:8b", SizeGB: 4.7, Role: "chat", Performance: "balanced", RAMRequired: 8, Description: "Meta Llama 3.1 8B — solid all-rounder", Tags: []string{"chat", "general"}},

	// Reasoning
	{Name: "deepseek-r1:7b", Tag: "deepseek-r1:7b", SizeGB: 4.7, Role: "reasoning", Performance: "smart", RAMRequired: 8, Description: "DeepSeek R1 7B — built-in chain-of-thought reasoning", Tags: []string{"reasoning", "thinking"}, Recommended: true},
	{Name: "deepseek-r1:14b", Tag: "deepseek-r1:14b", SizeGB: 9.0, Role: "reasoning", Performance: "genius", RAMRequired: 16, Description: "DeepSeek R1 14B — near GPT-4 reasoning, fully local", Tags: []string{"reasoning", "thinking", "powerful"}},
	{Name: "deepseek-r1:32b", Tag: "deepseek-r1:32b", SizeGB: 19.0, Role: "reasoning", Performance: "genius", RAMRequired: 32, Description: "DeepSeek R1 32B — exceptional reasoning", Tags: []string{"reasoning", "heavy"}},
	{Name: "qwq:32b", Tag: "qwq:32b", SizeGB: 19.0, Role: "reasoning", Performance: "genius", RAMRequired: 32, Description: "QwQ 32B — deep thinking model", Tags: []string{"reasoning", "thinking"}},

	// Coding
	{Name: "qwen2.5-coder:7b", Tag: "qwen2.5-coder:7b", SizeGB: 4.7, Role: "coding", Performance: "balanced", RAMRequired: 8, Description: "Qwen 2.5 Coder 7B — excellent code generation", Tags: []string{"coding", "completion"}, Recommended: true},
	{Name: "qwen2.5-coder:14b", Tag: "qwen2.5-coder:14b", SizeGB: 9.0, Role: "coding", Performance: "smart", RAMRequired: 16, Description: "Qwen 2.5 Coder 14B — replace GitHub Copilot", Tags: []string{"coding", "completion", "powerful"}},
	{Name: "codestral:22b", Tag: "codestral:22b", SizeGB: 13.0, Role: "coding", Performance: "genius", RAMRequired: 24, Description: "Codestral 22B — Mistral's best code model", Tags: []string{"coding", "heavy"}},
	{Name: "devstral:24b", Tag: "devstral:24b", SizeGB: 14.0, Role: "coding", Performance: "genius", RAMRequired: 24, Description: "DevStral 24B — agentic software engineering", Tags: []string{"coding", "agentic"}},

	// Vision
	{Name: "llava:7b", Tag: "llava:7b", SizeGB: 4.7, Role: "vision", Performance: "balanced", RAMRequired: 8, Description: "LLaVA 7B — see and understand images", Tags: []string{"vision", "multimodal"}},
	{Name: "qwen2.5vl:7b", Tag: "qwen2.5vl:7b", SizeGB: 5.5, Role: "vision", Performance: "smart", RAMRequired: 10, Description: "Qwen 2.5 VL 7B — best open vision model", Tags: []string{"vision", "multimodal"}},
	{Name: "minicpm-v:8b", Tag: "minicpm-v:8b", SizeGB: 5.5, Role: "vision", Performance: "smart", RAMRequired: 10, Description: "MiniCPM-V — efficient vision model", Tags: []string{"vision", "efficient"}},

	// Embeddings
	{Name: "nomic-embed-text", Tag: "nomic-embed-text", SizeGB: 0.3, Role: "embeddings", Performance: "fast", RAMRequired: 1, Description: "Nomic Embed — fast text embeddings for memory search", Tags: []string{"embeddings", "memory"}},
	{Name: "mxbai-embed-large", Tag: "mxbai-embed-large", SizeGB: 0.7, Role: "embeddings", Performance: "smart", RAMRequired: 2, Description: "MXBai Embed Large — high-quality embeddings", Tags: []string{"embeddings", "memory"}},

	// Large models
	{Name: "qwen2.5:14b", Tag: "qwen2.5:14b", SizeGB: 9.0, Role: "chat", Performance: "smart", RAMRequired: 16, Description: "Qwen 2.5 14B — significantly smarter than 7B", Tags: []string{"chat", "powerful"}},
	{Name: "gemma2:27b", Tag: "gemma2:27b", SizeGB: 16.0, Role: "chat", Performance: "genius", RAMRequired: 32, Description: "Google Gemma2 27B — Google's best open model", Tags: []string{"chat", "powerful"}},
	{Name: "llama3.1:70b", Tag: "llama3.1:70b", SizeGB: 40.0, Role: "chat", Performance: "genius", RAMRequired: 64, Description: "Meta Llama 3.1 70B — near GPT-4 quality", Tags: []string{"chat", "ultra"}},
}

// GetRecommendations returns all catalog models annotated with compatibility and install status.
func GetRecommendations(specs HardwareSpecs, installed map[string]bool) []ModelRecommendation {
	result := make([]ModelRecommendation, 0, len(modelCatalog))
	for _, m := range modelCatalog {
		m.Compatible = m.RAMRequired <= specs.RAMGB
		if specs.HasGPU && specs.GPUVRAMGB > 0 {
			m.Compatible = m.RAMRequired <= (specs.RAMGB + specs.GPUVRAMGB)
		}
		m.Installed = installed[m.Tag]
		m.Reason = buildReason(m, specs)
		result = append(result, m)
	}
	return result
}

func buildReason(m ModelRecommendation, specs HardwareSpecs) string {
	if !m.Compatible {
		return fmt.Sprintf("Needs %.0fGB RAM, you have %.0fGB", m.RAMRequired, specs.RAMGB)
	}
	switch specs.Tier {
	case "low":
		if m.RAMRequired <= 4 {
			return "✅ Perfect for your hardware — runs smoothly"
		}
		if m.RAMRequired <= 6 {
			return "⚡ Works but will use most RAM"
		}
	case "mid":
		if m.RAMRequired <= 8 {
			return "✅ Great fit — runs smoothly with room to spare"
		}
		if m.RAMRequired <= 12 {
			return "⚡ Works well, moderate RAM usage"
		}
	case "high":
		if m.RAMRequired <= 16 {
			return "✅ Excellent fit for your hardware"
		}
	case "ultra":
		return "✅ Your hardware handles this easily"
	}
	return "⚠️ Compatible but close to RAM limit"
}
