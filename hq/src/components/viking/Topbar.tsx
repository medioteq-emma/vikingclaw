import { Settings, Activity, WifiOff } from 'lucide-react';
import { TrustScoreRing } from './TrustScoreRing';
import { useClock } from '@/hooks/useClock';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LMStudioStatus {
  running: boolean;
  model: string;
}

interface OllamaStatus {
  running: boolean;
}

interface SandboxStatus {
  active: boolean;
  forbidden_paths: number;
  forbidden_commands: number;
  scrubber_patterns: number;
}

interface StatusData {
  status: string;
  version: string;
  uptime: string;
  agentName: string;
  timestamp: string;
  lmstudio?: LMStudioStatus;
  ollama?: OllamaStatus & { model?: string };
  active_provider?: string;
  sandbox?: SandboxStatus;
}

function ProviderBadge({ status }: { status: StatusData | null }) {
  if (!status) return null;

  const lm = status.lmstudio;
  const ol = status.ollama;

  if (lm?.running) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-display font-bold text-emerald-400 tracking-wide">
          LM Studio
          {lm.model ? `: ${lm.model.length > 20 ? lm.model.slice(0, 20) + '…' : lm.model}` : ''}
        </span>
      </div>
    );
  }

  if (ol?.running) {
    const modelName = ol.model ? (ol.model.length > 18 ? ol.model.slice(0, 18) + '…' : ol.model) : '';
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-900/40 border border-yellow-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        <span className="text-[11px] font-display font-bold text-yellow-400 tracking-wide">
          Ollama{modelName ? `: ${modelName}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-900/40 border border-red-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      <span className="text-[11px] font-display font-bold text-red-400 tracking-wide">⚠ No Local AI</span>
    </div>
  );
}

export function Topbar() {
  const clock = useClock();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [connected, setConnected] = useState(false);

  const fetchStatus = () => {
    api.getStatus()
      .then((data: StatusData) => { setStatus(data); setConnected(true); })
      .catch(() => setConnected(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-[52px] bg-card border-b border-border flex items-center justify-between px-4 shrink-0 gap-3">
      {/* Left: branding */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg">⚔️</span>
        <span className="font-display font-bold text-frost text-sm tracking-wider">
          {status?.agentName ? `${status.agentName.toUpperCase()} HQ` : 'VIKINGCLAW HQ'}
        </span>
        {connected ? (
          <span className="text-xs font-display text-success ml-1">● LIVE</span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-display text-destructive ml-1">
            <WifiOff className="w-3 h-3" /> OFFLINE
          </span>
        )}
      </div>

      {/* Center: provider badge */}
      <div className="flex-1 flex justify-center">
        <ProviderBadge status={status} />
      </div>

      {/* Right: trust, uptime, clock, settings */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Sandbox badge */}
        {status?.sandbox?.active && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/30 border border-green-700/40">
            <span className="text-[10px]">🛡️</span>
            <span className="text-[10px] font-display font-bold text-green-400 tracking-wide">Sandbox ON</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded">
          <span className="text-xs font-display text-muted-foreground uppercase tracking-wide">Trust</span>
          <TrustScoreRing score={94} />
        </div>

        {status && (
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xs text-muted-foreground">UP</span>
            <span className="font-display text-xs text-foreground">{status.uptime}</span>
          </div>
        )}

        <div className={cn('flex items-center gap-1.5')}>
          <Activity className="w-3 h-3 text-success" />
          <span className="font-display text-xs text-foreground">
            <span className="text-muted-foreground">BACKEND</span> {connected ? '🟢' : '🔴'}
          </span>
        </div>

        <span className="font-display text-xs text-frost tabular-nums">{clock}</span>

        <button className="p-1.5 rounded hover:bg-muted transition-colors">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
