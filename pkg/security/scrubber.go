package security

import "regexp"

// sensitivePatterns covers a wide range of credential and PII patterns.
var sensitivePatterns = []*regexp.Regexp{
	// Generic credential key=value pairs
	regexp.MustCompile(`(?i)(token|api[_\-]?key|password|secret|bearer|credential|auth)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{8,})["']?`),
	// OpenAI keys
	regexp.MustCompile(`sk-[a-zA-Z0-9]{20,}`),
	// GitHub Personal Access Tokens
	regexp.MustCompile(`ghp_[a-zA-Z0-9]{36}`),
	// GitHub fine-grained PAT
	regexp.MustCompile(`github_pat_[a-zA-Z0-9_]{82}`),
	// Bearer tokens in Authorization headers
	regexp.MustCompile(`(?i)Bearer\s+[a-zA-Z0-9\-._~+/]+=*`),
	// AWS keys
	regexp.MustCompile(`AKIA[0-9A-Z]{16}`),
	// Stripe keys
	regexp.MustCompile(`sk_live_[a-zA-Z0-9]{24,}`),
	// Norwegian personnummer (11-digit national ID)
	regexp.MustCompile(`\b\d{6}\s?\d{5}\b`),
	// Credit card numbers (Visa, MC, Amex, Discover patterns)
	regexp.MustCompile(`\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b`),
	// Private key blocks
	regexp.MustCompile(`-----BEGIN [A-Z ]+PRIVATE KEY-----`),
}

// ScrubberPatternCount returns the number of active scrubber patterns.
func ScrubberPatternCount() int {
	return len(sensitivePatterns)
}

// Scrub replaces sensitive values with [REDACTED] in output strings.
func Scrub(input string) string {
	result := input
	for _, pat := range sensitivePatterns {
		result = pat.ReplaceAllStringFunc(result, func(match string) string {
			// For key=value patterns, preserve the key
			parts := pat.FindStringSubmatch(match)
			if len(parts) >= 2 && parts[1] != "" {
				return parts[1] + "=[REDACTED]"
			}
			return "[REDACTED]"
		})
	}
	return result
}
