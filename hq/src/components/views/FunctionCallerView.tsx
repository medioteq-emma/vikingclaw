import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Zap, Play, Clock, CheckCircle, XCircle, Loader, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolInfo {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

interface RunHistoryEntry {
  id: string;
  tool: string;
  params: Record<string, string>;
  output: string;
  error?: string;
  duration: string;
  ok: boolean;
  ts: Date;
}

// Fallback built-in tool definitions when server is offline
const BUILTIN_TOOLS: ToolInfo[] = [
  {
    name: 'shell',
    description: 'Execute shell commands',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command to run' } },
      required: ['command'],
    },
  },
  {
    name: 'filesystem',
    description: 'Read or write files in the workspace',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'read | write | list | delete' },
        path: { type: 'string', description: 'File path (relative to workspace)' },
        content: { type: 'string', description: 'Content to write (write action only)' },
      },
      required: ['action', 'path'],
    },
  },
  {
    name: 'web',
    description: 'Fetch content from a URL',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL to fetch' } },
      required: ['url'],
    },
  },
];

export function FunctionCallerView() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selected, setSelected] = useState<ToolInfo | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    api.getToolsList()
      .then((r) => {
        const list: ToolInfo[] = r.tools ?? [];
        setTools(list.length > 0 ? list : BUILTIN_TOOLS);
      })
      .catch(() => setTools(BUILTIN_TOOLS));
  }, []);

  useEffect(() => {
    if (tools.length > 0 && !selected) {
      setSelected(tools[0]);
      setParamValues({});
    }
  }, [tools]);

  useEffect(() => {
    if (selected) setParamValues({});
  }, [selected]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const properties = selected?.parameters?.properties ?? {};
  const required = selected?.parameters?.required ?? [];

  const handleRun = async () => {
    if (!selected) return;
    setRunning(true);
    setOutput('⏳ Executing...\n');
    try {
      const r = await api.executeTools(selected.name, paramValues);
      const out = r.ok ? r.output : `Error: ${r.error}`;
      setOutput(out || '(no output)');
      const entry: RunHistoryEntry = {
        id: crypto.randomUUID(),
        tool: selected.name,
        params: { ...paramValues },
        output: out ?? '',
        error: r.error,
        duration: r.duration ?? '',
        ok: !!r.ok,
        ts: new Date(),
      };
      setHistory(h => [entry, ...h].slice(0, 30));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const loadFromHistory = (entry: RunHistoryEntry) => {
    const tool = tools.find(t => t.name === entry.tool);
    if (tool) {
      setSelected(tool);
      setParamValues(entry.params);
      setOutput(entry.output);
    }
  };

  return (
    <div className="flex h-[calc(100vh-52px)] animate-fade-in">
      {/* Left: tool list */}
      <div className="w-48 border-r border-border bg-card flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <h2 className="font-display text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-frost" /> TOOLS
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tools.map(tool => (
            <button
              key={tool.name}
              onClick={() => setSelected(tool)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm transition-colors border-l-2',
                selected?.name === tool.name
                  ? 'bg-primary/10 text-frost border-frost'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              )}
            >
              <span className="font-body">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: params + terminal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tool header */}
        {selected && (
          <div className="px-5 py-4 border-b border-border bg-card/50">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning" />
                  {selected.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selected.description}</p>
              </div>
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 text-sm font-display font-bold rounded bg-frost text-primary-foreground hover:bg-frost/90 disabled:opacity-50 transition-colors"
              >
                {running
                  ? <Loader className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4" />
                }
                EXECUTE
              </button>
            </div>
          </div>
        )}

        {/* Params */}
        {selected && Object.keys(properties).length > 0 && (
          <div className="px-5 py-4 border-b border-border bg-background/30 space-y-3">
            {Object.entries(properties).map(([name, schema]) => (
              <div key={name}>
                <label className="block text-xs font-display font-bold text-muted-foreground mb-1">
                  {name.toUpperCase()}
                  {required.includes(name) && <span className="text-destructive ml-1">*</span>}
                  <span className="text-muted-foreground/50 ml-2 font-normal">{schema.description}</span>
                </label>
                {name === 'command' || name === 'content' || name === 'url' ? (
                  <textarea
                    rows={name === 'content' ? 4 : 2}
                    value={paramValues[name] ?? ''}
                    onChange={e => setParamValues(v => ({ ...v, [name]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleRun(); }}
                    className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-frost/50 transition-colors resize-none"
                    placeholder={`Enter ${name}…`}
                  />
                ) : (
                  <input
                    type="text"
                    value={paramValues[name] ?? ''}
                    onChange={e => setParamValues(v => ({ ...v, [name]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleRun(); }}
                    className="w-full bg-background/50 border border-border rounded px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-frost/50 transition-colors"
                    placeholder={`Enter ${name}…`}
                  />
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground/50 font-display">Ctrl+Enter to run</p>
          </div>
        )}

        {/* Output terminal */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0e1a]">
          <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2">
            <ChevronRight className="w-3 h-3 text-frost" />
            <span className="text-xs font-display text-muted-foreground">OUTPUT TERMINAL</span>
            {output && (
              <button onClick={() => setOutput('')} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                CLEAR
              </button>
            )}
          </div>
          <pre
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 text-xs font-mono text-green-400 leading-relaxed whitespace-pre-wrap"
          >
            {output || <span className="text-muted-foreground">Select a tool and press EXECUTE to run it…</span>}
          </pre>
        </div>
      </div>

      {/* Right: run history */}
      <div className="w-64 border-l border-border bg-card flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-frost" /> RUN HISTORY
          </h2>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground font-display text-center py-8 px-3">
              No runs yet
            </p>
          ) : (
            history.map(entry => (
              <button
                key={entry.id}
                onClick={() => loadFromHistory(entry)}
                className="w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {entry.ok
                    ? <CheckCircle className="w-3 h-3 text-success shrink-0" />
                    : <XCircle className="w-3 h-3 text-destructive shrink-0" />
                  }
                  <span className="text-xs font-display font-bold text-foreground truncate">{entry.tool}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">{entry.duration}</span>
                </div>
                {Object.entries(entry.params).slice(0, 1).map(([k, v]) => (
                  <p key={k} className="text-xs font-mono text-muted-foreground truncate pl-5">
                    {k}: {String(v).slice(0, 30)}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground/50 font-display pl-5 mt-0.5">
                  {entry.ts.toLocaleTimeString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
