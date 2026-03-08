package tools

import (
	"context"
	"fmt"

	"github.com/medioteq/vikingclaw/pkg/providers"
	"github.com/medioteq/vikingclaw/pkg/security"
)

// Tool is the interface every VikingClaw tool must implement.
type Tool interface {
	Name() string
	Description() string
	Parameters() map[string]ToolParam
	Execute(ctx context.Context, params map[string]interface{}) (string, error)
}

// ToolParam describes a single parameter for a tool.
type ToolParam struct {
	Type        string
	Description string
	Required    bool
}

// Registry holds all registered tools.
type Registry struct {
	tools     map[string]Tool
	policy    *security.SecurityPolicy
	workspace string
}

// NewRegistry creates a Registry and registers the built-in tools.
func NewRegistry(policy *security.SecurityPolicy, workspace string) *Registry {
	r := &Registry{
		tools:     make(map[string]Tool),
		policy:    policy,
		workspace: workspace,
	}
	r.Register(NewShellTool(policy, workspace))
	r.Register(NewFSTool(policy, workspace))
	r.Register(NewWebTool())
	return r
}

// Register adds a tool to the registry.
func (r *Registry) Register(t Tool) {
	r.tools[t.Name()] = t
}

// Get returns a tool by name.
func (r *Registry) Get(name string) (Tool, bool) {
	t, ok := r.tools[name]
	return t, ok
}

// List returns all registered tool names.
func (r *Registry) List() []string {
	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	return names
}

// ToDefinitions converts all registered tools to LLM tool definitions.
func (r *Registry) ToDefinitions() []providers.ToolDefinition {
	defs := make([]providers.ToolDefinition, 0, len(r.tools))
	for _, t := range r.tools {
		params := map[string]interface{}{
			"type":       "object",
			"properties": buildProperties(t.Parameters()),
			"required":   buildRequired(t.Parameters()),
		}
		defs = append(defs, providers.ToolDefinition{
			Type: "function",
			Function: providers.FunctionSchema{
				Name:        t.Name(),
				Description: t.Description(),
				Parameters:  params,
			},
		})
	}
	return defs
}

// Execute runs a tool by name, scrubbing credentials from the output.
func (r *Registry) Execute(ctx context.Context, name string, params map[string]interface{}) (string, error) {
	t, ok := r.tools[name]
	if !ok {
		return "", fmt.Errorf("unknown tool: %s (available: %v)", name, r.List())
	}
	result, err := t.Execute(ctx, params)
	if err != nil {
		return "", err
	}
	return security.Scrub(result), nil
}

func buildProperties(params map[string]ToolParam) map[string]interface{} {
	props := make(map[string]interface{})
	for name, p := range params {
		props[name] = map[string]interface{}{
			"type":        p.Type,
			"description": p.Description,
		}
	}
	return props
}

func buildRequired(params map[string]ToolParam) []string {
	var required []string
	for name, p := range params {
		if p.Required {
			required = append(required, name)
		}
	}
	return required
}
