import { StatusBadge } from '@/components/viking/StatusBadge';
import { Bot, Activity, Cpu, MemoryStick, Zap } from 'lucide-react';
import { api, useWebSocket } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';

interface AgentInfo {
  id: string;
  name: string;
  status: string;
  uptime: string;
  task?: string;
  progress?: number;
}

interface SystemStats {
  alloc_mb: number;
  sys_mb: number;
  heap_mb: number;
  goroutines: number;
  uptime: string;
  gc_runs: number;
}

interface AgentsData { agents: AgentInfo[] }
interface WSMessage { type: string; ts: string }

export function AgentsView() {
  const [agentsData, setAgentsData] = useState<AgentsData | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [wsMessages, setWsMessages] = useState<WSMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api.getAgents().then((d: AgentsData) => setAgentsData(d)).catch(() => {});
    const loadSys = () => api.getSystem().then((d: SystemStats) => setSysStats(d)).catch(() => {});
    loadSys();
    const t = setInterval(loadSys, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ws = useWebSocket((msg: unknown) => {
      const message = msg as WSMessage;
      if (message.type === 'connected') setWsConnected(true);
      if (message.type === 'heartbeat') {
        setWsMessages(prev => [message, ...prev].slice(0, 20));
      }
    });
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    return () => { ws.close(); };
  }, []);

  const agents = agentsData?.agents ?? [];

  const ramPct = sysStats ? Math.min((sysStats.heap_mb / Math.max(sysStats.sys_mb, 1)) * 100, 100) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* System stats row */}
      {sysStats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Heap Used', value: `${sysStats.heap_mb} MB`, icon: MemoryStick, color: 'text-frost' },
            { label: 'Sys Memory', value: `${sysStats.sys_mb} MB`, icon: Cpu, color: 'text-warning' },
            { label: 'Goroutines', value: String(sysStats.goroutines), icon: Zap, color: 'text-success' },
            { label: 'Uptime', value: sysStats.uptime, icon: Activity, color: 'text-purple-400' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="frost-card scanlines relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs font-display text-muted-foreground">{stat.label}</span>
                </div>
                <p className={`font-display text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* RAM bar */}
      {sysStats && (
        <div className="frost-card scanlines relative p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-display text-muted-foreground">HEAP / SYS MEMORY RATIO</span>
            <span className="text-xs font-display text-frost">{ramPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${ramPct > 80 ? 'bg-destructive' : ramPct > 60 ? 'bg-warning' : 'bg-frost'}`}
              style={{ width: `${ramPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground font-display mt-1">
            GC runs: {sysStats.gc_runs} · Heap: {sysStats.heap_mb} MB · Sys: {sysStats.sys_mb} MB
          </p>
        </div>
      )}

      {/* WebSocket Status */}
      <div className="frost-card scanlines relative p-3 flex items-center gap-3 text-xs font-display">
        <Activity className="w-3 h-3 text-frost" />
        <span className="text-muted-foreground">Live Stream:</span>
        {wsConnected
          ? <span className="text-success">● CONNECTED (heartbeat every 5s)</span>
          : <span className="text-destructive">● DISCONNECTED — start Go backend</span>}
        {wsMessages.length > 0 && (
          <span className="text-muted-foreground ml-auto">
            Last ping: {new Date(wsMessages[0]?.ts).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-3 gap-4">
        {agents.map(agent => (
          <div key={agent.id} className="frost-card scanlines relative p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-frost" />
                <span className="font-display text-sm font-bold text-foreground">
                  AGENT: {agent.name.toUpperCase()}
                </span>
              </div>
              <StatusBadge status={agent.status.toUpperCase()} />
            </div>
            <div className="space-y-1 text-xs font-display text-muted-foreground">
              <p>ID: <span className="text-foreground">{agent.id}</span></p>
              <p>Uptime: <span className="text-foreground">{agent.uptime}</span></p>
              {agent.task ? (
                <>
                  <p>Task: <span className="text-foreground">{agent.task}</span></p>
                  {agent.progress != null && (
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-frost rounded-full" style={{ width: `${agent.progress}%` }} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Listening for messages…</p>
              )}
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="col-span-3 frost-card scanlines relative p-8 text-center">
            <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-sm text-muted-foreground">
              No agents running. Start the VikingClaw backend.
            </p>
          </div>
        )}
      </div>

      {/* WebSocket Heartbeat Feed */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-frost" /> LIVE STREAM
          {wsConnected && <StatusBadge status="LIVE" pulse />}
        </h2>
        <div className="space-y-1 max-h-[200px] overflow-y-auto font-mono text-xs">
          {wsMessages.length === 0 ? (
            <p className="text-muted-foreground font-display py-4 text-center">
              {wsConnected ? 'Waiting for messages…' : 'WebSocket not connected'}
            </p>
          ) : (
            wsMessages.map((msg, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-l-2 border-l-frost/30">
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {new Date(msg.ts).toLocaleTimeString()}
                </span>
                <span className="text-frost">[{msg.type}]</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
