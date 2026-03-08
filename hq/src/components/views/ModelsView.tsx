import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Cpu, RefreshCw, Download, Loader, Trash2, Star, MonitorSpeaker, Zap, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE = 'http://localhost:7070';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

interface RunningModel {
  name: string;
  size_vram: number;
  expires_at: string;
}

interface LMStudioModel {
  id: string;
  object?: string;
  owned_by?: string;
}

interface LMStudioStatusData {
  running: boolean;
  model: string;
  models: LMStudioModel[];
}

const POPULAR_MODELS = [
  { name: 'llama3.2:3b', desc: '3B · fast, lightweight' },
  { name: 'llama3.1:8b', desc: '8B · great balance' },
  { name: 'mistral:7b', desc: '7B · strong reasoning' },
  { name: 'gemma2:9b', desc: '9B · Google, efficient' },
  { name: 'deepseek-r1:14b', desc: '14B · deep reasoning' },
  { name: 'qwen2.5:14b', desc: '14B · multilingual' },
  { name: 'codestral:22b', desc: '22B · code specialist' },
  { name: 'phi4:14b', desc: '14B · Microsoft phi4' },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

function formatVRAM(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / 1e9).toFixed(1)} GB VRAM`;
}

interface PullEvent {
  status: string;
  percent?: number;
  total_bytes?: number;
  done_bytes?: number;
  done?: boolean;
  error?: string;
  model?: string;
}

export function ModelsView() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [running, setRunning] = useState<RunningModel[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [lmStudio, setLMStudio] = useState<LMStudioStatusData | null>(null);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [pullInput, setPullInput] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullEvent | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [modelsRes, runningRes, cfgRes, lmRes] = await Promise.allSettled([
        api.getModels(),
        api.getRunningModels(),
        api.getAgentConfig(),
        api.getLMStudioStatus(),
      ]);
      if (modelsRes.status === 'fulfilled') {
        const d = modelsRes.value;
        setOllamaStatus(d.status === 'offline' || d.error ? 'offline' : 'online');
        setModels(d.models ?? []);
      } else {
        setOllamaStatus('offline');
      }
      if (runningRes.status === 'fulfilled') {
        setRunning(runningRes.value.models ?? []);
      }
      if (cfgRes.status === 'fulfilled') {
        setDefaultModel(cfgRes.value.model ?? '');
      }
      if (lmRes.status === 'fulfilled') {
        setLMStudio(lmRes.value as LMStudioStatusData);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh running models every 10s
  useEffect(() => {
    const t = setInterval(() => {
      api.getRunningModels().then(r => setRunning(r.models ?? [])).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete model "${name}"? This cannot be undone.`)) return;
    setActionMsg(`Deleting ${name}…`);
    try {
      const r = await api.deleteModel(name);
      setActionMsg(r.ok ? `✅ Deleted ${name}` : `❌ ${r.error}`);
      if (r.ok) await loadAll();
    } catch (e: unknown) {
      setActionMsg(`❌ ${e instanceof Error ? e.message : String(e)}`);
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handleSetDefault = async (name: string) => {
    setActionMsg(`Setting ${name} as default…`);
    try {
      const r = await api.setDefaultModel(name);
      if (r.ok) {
        setDefaultModel(name);
        setActionMsg(`✅ Default model → ${name}`);
      } else {
        setActionMsg(`❌ ${r.error}`);
      }
    } catch (e: unknown) {
      setActionMsg(`❌ ${e instanceof Error ? e.message : String(e)}`);
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const handlePull = async (modelName: string) => {
    if (pulling) return;
    const name = modelName || pullInput.trim();
    if (!name) return;

    setPulling(true);
    setPullProgress({ status: 'Starting pull…' });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${BASE}/api/models/pull/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt: PullEvent = JSON.parse(line.slice(6));
            setPullProgress(evt);
            if (evt.done) break;
          } catch { /* ignore */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        setPullProgress({ status: `Error: ${e instanceof Error ? e.message : String(e)}`, done: true, error: 'failed' });
      }
    } finally {
      setPulling(false);
      abortRef.current = null;
      // Refresh model list after pull
      setTimeout(() => { loadAll(); setPullProgress(null); }, 1500);
    }
  };

  const runningNames = new Set(running.map(m => m.name));

  return (
    <div className="p-6 space-y-5 animate-fade-in">

      {/* Status bar */}
      <div className="frost-card scanlines relative p-3 flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <MonitorSpeaker className="w-4 h-4 text-frost" />
          <span className={cn('font-display font-bold', ollamaStatus === 'online' ? 'text-success' : ollamaStatus === 'offline' ? 'text-destructive' : 'text-muted-foreground')}>
            OLLAMA {ollamaStatus === 'online' ? '● ONLINE' : ollamaStatus === 'offline' ? '● OFFLINE' : '● …'}
          </span>
        </div>
        <span className="text-muted-foreground font-display">
          {models.length} installed · {running.length} loaded in RAM
        </span>
        {defaultModel && (
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-display text-warning">Default: {defaultModel}</span>
          </div>
        )}
        {actionMsg && (
          <span className="ml-auto text-xs font-display text-frost animate-pulse">{actionMsg}</span>
        )}
        <button
          onClick={loadAll}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-display rounded bg-primary/10 text-frost hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} /> REFRESH
        </button>
      </div>

      {/* LM Studio section */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" /> LM STUDIO
          <span className={cn(
            'ml-auto text-xs font-display px-2 py-0.5 rounded-full border',
            lmStudio?.running
              ? 'text-emerald-400 border-emerald-700/50 bg-emerald-900/20'
              : 'text-muted-foreground border-border'
          )}>
            {lmStudio?.running ? '● ONLINE' : '○ OFFLINE'}
          </span>
        </h2>

        {lmStudio?.running ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-display">
              Primary AI provider — OpenAI-compatible API at{' '}
              <code className="text-frost bg-muted/50 px-1 rounded">localhost:1234</code>
            </p>
            {lmStudio.model && (
              <div className="flex items-center gap-2 p-2.5 rounded border border-emerald-700/30 bg-emerald-900/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-display font-bold text-emerald-300">{lmStudio.model}</span>
                <span className="text-xs text-emerald-400/60 ml-auto font-display">ACTIVE</span>
              </div>
            )}
            {lmStudio.models && lmStudio.models.length > 1 && (
              <div className="space-y-1">
                <p className="text-[11px] font-display text-muted-foreground">ALL LOADED MODELS:</p>
                {lmStudio.models.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/20 text-xs font-mono text-muted-foreground">
                    <Zap className="w-3 h-3 text-emerald-400/60 shrink-0" />
                    {m.id}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-3 space-y-2">
            <p className="text-xs text-muted-foreground font-display">
              LM Studio is not running. Start it and load a model to use it as your primary AI.
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded border border-border bg-muted/10">
              <span className="text-xs font-display text-muted-foreground">Expected at:</span>
              <code className="text-xs text-frost bg-muted/50 px-1.5 py-0.5 rounded">http://localhost:1234/v1</code>
            </div>
            <p className="text-[11px] text-muted-foreground/60 font-display">
              When LM Studio is running, VikingClaw will automatically use it as the primary provider over Ollama.
            </p>
          </div>
        )}
      </div>

      {/* Installed models table */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-frost" /> INSTALLED MODELS
        </h2>

        {ollamaStatus === 'offline' && (
          <div className="text-center py-8 text-destructive font-display text-sm">
            ⚠️ Cannot connect to Ollama at localhost:11434 — run: <code className="bg-muted/50 px-2 py-0.5 rounded text-xs">ollama serve</code>
          </div>
        )}
        {ollamaStatus === 'online' && models.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-display text-sm">
            No models installed. Pull one below.
          </div>
        )}

        {models.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-display text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 px-2">Model</th>
                  <th className="text-left py-2 px-2">Size</th>
                  <th className="text-left py-2 px-2">Params</th>
                  <th className="text-left py-2 px-2">Quant</th>
                  <th className="text-left py-2 px-2">Family</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  const isRunning = runningNames.has(model.name);
                  const isDefault = model.name === defaultModel;
                  const runInfo = running.find(r => r.name === model.name);
                  return (
                    <tr key={model.name} className={cn(
                      'border-b border-border/50 transition-colors',
                      isRunning ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-primary/5'
                    )}>
                      <td className="py-2.5 px-2 font-display text-foreground">
                        <div className="flex items-center gap-2">
                          {isDefault && <Star className="w-3 h-3 text-warning shrink-0" title="Default model" />}
                          <span className="truncate max-w-[200px]">{model.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-display text-muted-foreground whitespace-nowrap">{formatBytes(model.size)}</td>
                      <td className="py-2.5 px-2 font-display text-muted-foreground">{model.details?.parameter_size ?? '—'}</td>
                      <td className="py-2.5 px-2 font-display text-muted-foreground text-xs">{model.details?.quantization_level ?? '—'}</td>
                      <td className="py-2.5 px-2 font-display text-muted-foreground text-xs">{model.details?.family ?? '—'}</td>
                      <td className="py-2.5 px-2">
                        {isRunning ? (
                          <div>
                            <span className="text-xs font-display text-success font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                              LOADED
                            </span>
                            {runInfo?.size_vram ? (
                              <span className="text-[10px] text-success/70 font-display block">{formatVRAM(runInfo.size_vram)}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs font-display text-muted-foreground">idle</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleSetDefault(model.name)}
                            disabled={isDefault}
                            title={isDefault ? 'Already default' : 'Set as default'}
                            className="p-1.5 rounded hover:bg-warning/10 text-muted-foreground hover:text-warning disabled:opacity-30 transition-colors"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(model.name)}
                            title="Delete model"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pull new model */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-frost" /> PULL NEW MODEL
        </h2>

        {/* Custom input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={pullInput}
            onChange={e => setPullInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePull(pullInput.trim())}
            placeholder="e.g. llama3.2:3b, mistral:7b, qwen2.5:14b"
            className="flex-1 bg-background/50 border border-border rounded px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-frost/50 transition-colors"
          />
          <button
            onClick={() => handlePull(pullInput.trim())}
            disabled={pulling || !pullInput.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-display font-bold rounded bg-frost text-primary-foreground hover:bg-frost/90 disabled:opacity-50 transition-colors"
          >
            {pulling ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PULL
          </button>
        </div>

        {/* Popular model quick-pick */}
        <p className="text-xs font-display text-muted-foreground mb-2">POPULAR MODELS — click to pull:</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {POPULAR_MODELS.map(m => {
            const installed = models.some(im => im.name === m.name);
            return (
              <button
                key={m.name}
                onClick={() => handlePull(m.name)}
                disabled={pulling || installed}
                className={cn(
                  'text-left p-2.5 rounded border transition-colors',
                  installed
                    ? 'border-success/30 bg-success/5 cursor-default'
                    : 'border-border hover:border-frost/30 hover:bg-primary/5 cursor-pointer'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {installed
                    ? <span className="text-success text-xs">✅</span>
                    : <Download className="w-3 h-3 text-muted-foreground" />}
                  <span className="font-display text-xs font-bold text-foreground">{m.name.split(':')[0]}</span>
                  <span className="font-display text-[10px] text-muted-foreground">{m.name.split(':')[1]}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-body">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Pull progress */}
        {pullProgress && (
          <div className="border border-border rounded p-3 bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              {pulling ? <Loader className="w-3.5 h-3.5 text-frost animate-spin" /> : <Zap className="w-3.5 h-3.5 text-success" />}
              <span className="text-xs font-display text-foreground">{pullProgress.status}</span>
              {pullProgress.percent !== undefined && (
                <span className="ml-auto text-xs font-display text-frost font-bold">{pullProgress.percent}%</span>
              )}
            </div>
            {pullProgress.percent !== undefined && (
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-frost rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pullProgress.percent, 100)}%` }}
                />
              </div>
            )}
            {pullProgress.total_bytes && pullProgress.done_bytes ? (
              <p className="text-[10px] text-muted-foreground font-display mt-1">
                {formatBytes(pullProgress.done_bytes)} / {formatBytes(pullProgress.total_bytes)}
              </p>
            ) : null}
            {pullProgress.error && (
              <p className="text-xs text-destructive font-display mt-1">❌ {pullProgress.error}</p>
            )}
            {pullProgress.done && !pullProgress.error && (
              <p className="text-xs text-success font-display mt-1">✅ Done!</p>
            )}
          </div>
        )}
      </div>

      {/* Smart Router visualization */}
      <div className="frost-card scanlines relative p-5">
        <h2 className="font-display text-sm font-bold text-foreground mb-4">SMART ROUTER — PRIORITY ORDER</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="frost-card px-3 py-2 text-xs font-display text-center">USER TASK</div>
          <div className="text-muted-foreground">→</div>
          <div className="frost-card px-3 py-2 text-xs font-display frost-glow text-frost font-bold text-center">ROUTER</div>
          <div className="text-muted-foreground">→</div>
          <div className="flex flex-wrap gap-2">
            {/* LM Studio — primary */}
            <div className={cn(
              'frost-card px-3 py-2 text-xs font-display text-center border',
              lmStudio?.running
                ? 'border-emerald-700/50 bg-emerald-900/20'
                : 'border-border opacity-50'
            )}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', lmStudio?.running ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground')} />
                <span className={lmStudio?.running ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                  LM Studio
                </span>
                <span className="text-[10px] text-muted-foreground/60">#1</span>
              </div>
              <div className="text-[10px] text-muted-foreground">localhost:1234</div>
            </div>
            {/* Ollama — secondary */}
            <div className={cn(
              'frost-card px-3 py-2 text-xs font-display text-center border',
              ollamaStatus === 'online' ? 'border-yellow-700/40 bg-yellow-900/10' : 'border-border opacity-50'
            )}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', ollamaStatus === 'online' ? 'bg-yellow-400 animate-pulse' : 'bg-muted-foreground')} />
                <span className={ollamaStatus === 'online' ? 'text-yellow-400' : 'text-muted-foreground'}>
                  Ollama
                </span>
                <span className="text-[10px] text-muted-foreground/60">#2</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{models.length} models</div>
            </div>
            {/* Cloud */}
            <div className="frost-card px-3 py-2 text-xs font-display text-center text-muted-foreground border border-border opacity-60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-muted-foreground">☁️ Cloud</span>
                <span className="text-[10px] text-muted-foreground/60">#3</span>
              </div>
              <div className="text-[10px] text-muted-foreground">overflow</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
