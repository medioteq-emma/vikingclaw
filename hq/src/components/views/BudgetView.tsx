import { api } from '@/lib/api';
import { useCountUp } from '@/hooks/useCountUp';
import { DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface ProviderStats { tokens: number; cost: number }
interface BudgetData {
  dailyLimit: number;
  usedToday: number;
  savedByLocal: number;
  providers: { ollama: ProviderStats; anthropic: ProviderStats };
}
interface AgentCfg {
  model: string;
  ollama_url: string;
  daily_limit: number;
  has_openai_key: boolean;
}
interface SystemStats { uptime: string; goroutines: number; heap_mb: number }

export function BudgetView() {
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [cfg, setCfg] = useState<AgentCfg | null>(null);
  const [sys, setSys] = useState<SystemStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled([api.getBudget(), api.getAgentConfig(), api.getSystem()])
      .then(([br, cr, sr]) => {
        if (br.status === 'fulfilled') setBudget(br.value as BudgetData);
        if (cr.status === 'fulfilled') setCfg(cr.value as AgentCfg);
        if (sr.status === 'fulfilled') setSys(sr.value as SystemStats);
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const usedTokens = budget?.usedToday ?? 0;
  const dailyLimit = cfg?.daily_limit ?? budget?.dailyLimit ?? 10000;
  const pct = dailyLimit > 0 ? usedTokens / dailyLimit : 0;
  const costPerToken = 0.000003;
  const usedCost = usedTokens * costPerToken;
  const animatedCost = useCountUp(usedCost, 800, 4);

  const size = 200;
  const strokeW = 12;
  const radius = (size - strokeW) / 2;
  const circ = 2 * Math.PI * radius;
  const arcLength = circ * 0.75;
  const offset = arcLength * (1 - Math.min(pct, 1));
  const color = pct < 0.5 ? 'hsl(var(--success))' : pct < 0.8 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  const ollamaTokens = budget?.providers?.ollama?.tokens ?? 0;
  const anthropicTokens = budget?.providers?.anthropic?.tokens ?? 0;
  const anthropicCost = budget?.providers?.anthropic?.cost ?? 0;
  const savedByLocal = budget?.savedByLocal ?? (cfg?.has_openai_key === false ? 100 : 80);

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="frost-card scanlines relative p-3 flex items-center justify-between text-xs font-display">
        <div className="flex items-center gap-4 text-muted-foreground">
          {cfg && <span>Model: <span className="text-frost">{cfg.model}</span></span>}
          {cfg && <span>Ollama: <span className="text-success">{cfg.ollama_url}</span></span>}
          {sys && <span>Uptime: <span className="text-foreground">{sys.uptime}</span></span>}
          {sys && <span>Goroutines: <span className="text-foreground">{sys.goroutines}</span></span>}
        </div>
        <button onClick={loadAll} disabled={refreshing} className="p-1 rounded hover:bg-muted/50">
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Hero Gauge */}
      <div className="flex justify-center">
        <div className="frost-card scanlines relative p-8 flex flex-col items-center" style={{ position: 'relative' }}>
          <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.85}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))"
              strokeWidth={strokeW} strokeDasharray={`${arcLength} ${circ}`} strokeDashoffset={0}
              strokeLinecap="round" transform={`rotate(135 ${size / 2} ${size / 2})`} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
              strokeWidth={strokeW} strokeDasharray={`${arcLength} ${circ}`} strokeDashoffset={offset}
              strokeLinecap="round" transform={`rotate(135 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -30%)', textAlign: 'center' }}>
            <p className="font-display text-3xl font-bold text-foreground">{usedTokens.toLocaleString()}</p>
            <p className="font-display text-sm text-muted-foreground">tokens today</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2 font-display">
            USED: {usedTokens.toLocaleString()} / {dailyLimit.toLocaleString()} limit
            {' · '}
            <span className="text-success">~${animatedCost} spent ✅</span>
          </p>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-frost" /> COST BREAKDOWN
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-display text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="text-left py-2 px-3">Provider</th>
              <th className="text-right py-2 px-3">Tokens</th>
              <th className="text-right py-2 px-3">Cost</th>
              <th className="text-right py-2 px-3">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2.5 px-3 font-display text-foreground">
                Ollama (Local) {cfg && <span className="text-xs text-muted-foreground">— {cfg.model}</span>}
              </td>
              <td className="py-2.5 px-3 font-display text-muted-foreground text-right">{ollamaTokens.toLocaleString()}</td>
              <td className="py-2.5 px-3 font-display text-right"><span className="text-success">$0.00 🆓</span></td>
              <td className="py-2.5 px-3 font-display text-right text-success text-xs">LOCAL</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2.5 px-3 font-display text-foreground">
                Cloud API {cfg && !cfg.has_openai_key && <span className="text-xs text-muted-foreground">(no key configured)</span>}
              </td>
              <td className="py-2.5 px-3 font-display text-muted-foreground text-right">{anthropicTokens.toLocaleString()}</td>
              <td className="py-2.5 px-3 font-display text-right">${anthropicCost.toFixed(4)}</td>
              <td className="py-2.5 px-3 font-display text-right text-muted-foreground text-xs">CLOUD</td>
            </tr>
            <tr className="border-t border-border font-bold">
              <td className="py-2.5 px-3 font-display text-foreground">TOTAL</td>
              <td className="py-2.5 px-3 font-display text-foreground text-right">
                {(ollamaTokens + anthropicTokens).toLocaleString()}
              </td>
              <td className="py-2.5 px-3 font-display text-frost text-right">${anthropicCost.toFixed(4)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Savings */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-frost" /> LOCAL AI SAVINGS
        </h2>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-success">{savedByLocal}%</p>
            <p className="font-display text-xs text-muted-foreground mt-1">Requests served locally</p>
          </div>
          <div className="flex-1">
            <div className="w-full h-3 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all duration-1000" style={{ width: `${Math.min(savedByLocal, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground font-display">
              <span>Local (free)</span>
              <span>Cloud (paid)</span>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-success/10 rounded text-xs font-display text-success">
          ✅ Local-first routing active — Ollama handles free inference when available
        </div>
      </div>

      {/* Budget Settings */}
      <div className="frost-card scanlines relative p-5">
        <h2 className="font-display text-sm font-bold text-foreground mb-4">BUDGET SETTINGS</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-display text-muted-foreground uppercase tracking-wider">Daily Token Limit</label>
            <div className="w-full mt-1 bg-muted/50 border border-border rounded px-3 py-2 text-sm font-display text-foreground">
              {dailyLimit > 0 ? `${dailyLimit.toLocaleString()} tokens` : 'Unlimited'}
            </div>
          </div>
          <div>
            <label className="text-xs font-display text-muted-foreground uppercase tracking-wider">Used Today</label>
            <div className="w-full mt-1 bg-muted/50 border border-border rounded px-3 py-2 text-sm font-display text-foreground">
              {usedTokens.toLocaleString()} tokens ({(pct * 100).toFixed(1)}%)
            </div>
          </div>
          {sys && (
            <>
              <div>
                <label className="text-xs font-display text-muted-foreground uppercase tracking-wider">Process Heap</label>
                <div className="w-full mt-1 bg-muted/50 border border-border rounded px-3 py-2 text-sm font-display text-foreground">
                  {sys.heap_mb} MB
                </div>
              </div>
              <div>
                <label className="text-xs font-display text-muted-foreground uppercase tracking-wider">Active Goroutines</label>
                <div className="w-full mt-1 bg-muted/50 border border-border rounded px-3 py-2 text-sm font-display text-foreground">
                  {sys.goroutines}
                </div>
              </div>
            </>
          )}
          {[
            { label: 'Hard stop at limit', on: dailyLimit > 0 },
            { label: 'Local-first routing', on: true },
            { label: 'Cloud fallback', on: cfg?.has_openai_key ?? false },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between bg-muted/30 px-3 py-2 rounded">
              <span className="text-sm font-body text-foreground">{s.label}</span>
              <span className={`font-display text-xs ${s.on ? 'text-success' : 'text-muted-foreground'}`}>
                ● {s.on ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
