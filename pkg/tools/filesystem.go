package tools

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/medioteq/vikingclaw/pkg/security"
)

// FSTool provides filesystem read/write operations within the workspace.
type FSTool struct {
	policy    *security.SecurityPolicy
	workspace string
}

// NewFSTool creates an FSTool.
func NewFSTool(policy *security.SecurityPolicy, workspace string) *FSTool {
	return &FSTool{policy: policy, workspace: workspace}
}

func (t *FSTool) Name() string { return "filesystem" }

func (t *FSTool) Description() string {
	return "Read, write, edit, or list files within the workspace. Operations: read_file, write_file, edit_file, list_dir."
}

func (t *FSTool) Parameters() map[string]ToolParam {
	return map[string]ToolParam{
		"operation": {
			Type:        "string",
			Description: "Operation: read_file | write_file | edit_file | list_dir",
			Required:    true,
		},
		"path": {
			Type:        "string",
			Description: "File or directory path (relative to workspace, or absolute).",
			Required:    true,
		},
		"content": {
			Type:        "string",
			Description: "Content for write_file.",
			Required:    false,
		},
		"old_text": {
			Type:        "string",
			Description: "Exact text to find for edit_file.",
			Required:    false,
		},
		"new_text": {
			Type:        "string",
			Description: "Replacement text for edit_file.",
			Required:    false,
		},
	}
}

func (t *FSTool) Execute(ctx context.Context, params map[string]interface{}) (string, error) {
	op, _ := params["operation"].(string)
	rawPath, _ := params["path"].(string)

	if op == "" {
		return "", fmt.Errorf("operation is required")
	}
	if rawPath == "" {
		return "", fmt.Errorf("path is required")
	}

	// Resolve relative paths against workspace
	absPath := rawPath
	if !filepath.IsAbs(rawPath) {
		absPath = filepath.Join(t.workspace, rawPath)
	}

	switch op {
	case "read_file":
		return t.readFile(absPath)
	case "write_file":
		content, _ := params["content"].(string)
		return t.writeFile(absPath, content)
	case "edit_file":
		oldText, _ := params["old_text"].(string)
		newText, _ := params["new_text"].(string)
		return t.editFile(absPath, oldText, newText)
	case "list_dir":
		return t.listDir(absPath)
	default:
		return "", fmt.Errorf("unknown operation: %s", op)
	}
}

func (t *FSTool) readFile(path string) (string, error) {
	if err := t.policy.CheckPath(path, t.workspace); err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read_file: %w", err)
	}
	content := string(data)
	if len(content) > 50*1024 {
		content = content[:50*1024] + "\n[file truncated at 50 KB]"
	}
	return content, nil
}

func (t *FSTool) writeFile(path, content string) (string, error) {
	if err := t.policy.CheckPathWrite(path, t.workspace); err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return "", fmt.Errorf("write_file mkdir: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("write_file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return "", fmt.Errorf("write_file rename: %w", err)
	}
	return fmt.Sprintf("wrote %d bytes to %s", len(content), path), nil
}

func (t *FSTool) editFile(path, oldText, newText string) (string, error) {
	if err := t.policy.CheckPathWrite(path, t.workspace); err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("edit_file read: %w", err)
	}
	original := string(data)
	if !strings.Contains(original, oldText) {
		return "", fmt.Errorf("edit_file: old_text not found in %s", path)
	}
	updated := strings.Replace(original, oldText, newText, 1)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(updated), 0644); err != nil {
		return "", fmt.Errorf("edit_file write: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return "", fmt.Errorf("edit_file rename: %w", err)
	}
	return fmt.Sprintf("edited %s (replaced %d bytes with %d bytes)", path, len(oldText), len(newText)), nil
}

func (t *FSTool) listDir(path string) (string, error) {
	if err := t.policy.CheckPath(path, t.workspace); err != nil {
		return "", err
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return "", fmt.Errorf("list_dir: %w", err)
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Contents of %s:\n", path))
	for _, e := range entries {
		info, _ := e.Info()
		if e.IsDir() {
			sb.WriteString(fmt.Sprintf("  [DIR]  %s\n", e.Name()))
		} else if info != nil {
			sb.WriteString(fmt.Sprintf("  [FILE] %s  (%d bytes)\n", e.Name(), info.Size()))
		} else {
			sb.WriteString(fmt.Sprintf("  [FILE] %s\n", e.Name()))
		}
	}
	return sb.String(), nil
}
