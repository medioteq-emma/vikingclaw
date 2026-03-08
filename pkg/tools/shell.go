package tools

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"time"

	"github.com/medioteq/vikingclaw/pkg/security"
)

const maxOutputBytes = 10 * 1024 // 10 KB

// ShellTool executes shell commands inside the workspace.
type ShellTool struct {
	policy    *security.SecurityPolicy
	workspace string
}

// NewShellTool creates a ShellTool.
func NewShellTool(policy *security.SecurityPolicy, workspace string) *ShellTool {
	return &ShellTool{policy: policy, workspace: workspace}
}

func (t *ShellTool) Name() string { return "shell" }

func (t *ShellTool) Description() string {
	return "Execute a shell command in the workspace directory. Output is truncated to 10 KB."
}

func (t *ShellTool) Parameters() map[string]ToolParam {
	return map[string]ToolParam{
		"command": {
			Type:        "string",
			Description: "The shell command to execute.",
			Required:    true,
		},
	}
}

// Execute runs the command with a 30-second timeout.
func (t *ShellTool) Execute(ctx context.Context, params map[string]interface{}) (string, error) {
	cmd, _ := params["command"].(string)
	if cmd == "" {
		return "", fmt.Errorf("command is required")
	}

	if err := t.policy.CheckCommand(cmd); err != nil {
		return "", fmt.Errorf("security: %w", err)
	}
	if err := t.policy.CheckRateLimit(); err != nil {
		return "", fmt.Errorf("rate limit: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var c *exec.Cmd
	if runtime.GOOS == "windows" {
		c = exec.CommandContext(ctx, "cmd", "/C", cmd)
	} else {
		c = exec.CommandContext(ctx, "sh", "-c", cmd)
	}
	c.Dir = t.workspace

	out, err := c.CombinedOutput()

	result := string(out)
	if len(result) > maxOutputBytes {
		result = result[:maxOutputBytes] + "\n[output truncated]"
	}

	if err != nil {
		// Return output + error so the LLM can see what happened
		if result != "" {
			return result, fmt.Errorf("command failed: %w", err)
		}
		return "", fmt.Errorf("command failed: %w", err)
	}
	return result, nil
}
