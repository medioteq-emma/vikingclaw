package security

import "regexp"

// credentialPattern matches common credential key=value pairs.
var credentialPattern = regexp.MustCompile(
	`(?i)(token|api[_\-]?key|password|secret|bearer|credential|auth)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{8,})["']?`,
)

// Scrub replaces credential values with [REDACTED] in output strings.
func Scrub(input string) string {
	return credentialPattern.ReplaceAllStringFunc(input, func(match string) string {
		parts := credentialPattern.FindStringSubmatch(match)
		if len(parts) >= 2 {
			return parts[1] + "=[REDACTED]"
		}
		return "[REDACTED]"
	})
}
