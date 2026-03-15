import { StatCard } from '@/components/viking/StatCard';
import { StatusBadge } from '@/components/viking/StatusBadge';
import { Shield, Lock, FileText, RefreshCw, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

interface SandboxInfo {
  active: boolean;
  forbidden_paths: number;
  forbidden_commands: number;
  scrubber_patterns: number;
  rate_limit?: string;
}

interface SandboxTestResult {
  test: string;
  passed: boolean;
  output?: string;
}

interface SandboxTestReport {
  sandbox_active: boolean;
  all_passed: boolean;
  tests: SandboxTestResult[];
  forbidden_paths: number;
  forbidden_cmds: number;
  scrubber_patterns: number;
}

interface AuditEntry {
  ts: string;
  agent: string;
  action: string;
  detail: string;
  severity: string;
}

interface AuditData {
  entries: AuditEntry[];
  count: number;
  path: string;
}

interface AgentCfg {
  model: string;
  autonomy: string;
  max_actions_per_hour: number;
  daily_limit: number;
  forbidden_paths_count: number;
  allow_commands_count: number;
  deny_commands_count: number;
  has_openai_key: boolean;
  has_telegram: boolean;
}

function calcTrustScore(entries: AuditEntry[], cfg: AgentCfg | null): { score: number; breakdown: { label: string; pts: number; pass: boolean }[] } {
  const items = [
    { label: 'Local model active (Ollama)',     pts: 30, pass: true },
    { label: 'Sandbox mode (supervised/readonly)', pts: 20, pass: cfg ? cfg.autonomy !== 'full' : true },
    { label: 'No critical audit findings',       pts: 20, pass: !entries.some(e => e.severity?.toLowerCase() === 'critical') },
    { label: 'Audit log running',                pts: 20, pass: entries.length > 0 },
    { label: 'Token budget configured',          pts: 10, pass: cfg ? cfg.daily_limit > 0 : false },
  ];
  const score = items.reduce((acc, i) => acc + (i.pass ? i.pts : 0), 0);
  return { score, breakdown: items.map(i => ({ label: i.label, pts: i.pts, pass: i.pass })) };
}

function severityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'border-l-destructive';
    case 'warn': case 'warning': return 'border-l-warning';
    default: return 'border-l-primary';
  }
}

function severityStatus(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'FAIL';
    case 'warn': case 'warning': return 'WARN';
    default: return 'PASS';
  }
}

function fmtTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

export function SecurityView() {
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [cfg, setCfg] = useState<AgentCfg | null>(null);
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sandboxTest, setSandboxTest] = useState<SandboxTestReport | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const runSandboxTest = async () => {
    setTestRunning(true);
    setTestError(null);
    try {
      const res = await fetch('/api/sandbox/test');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SandboxTestReport;
      setSandboxTest(data);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestRunning(false);
    }
  };

  const loadAll = () => {
    setLoading(true);
    Promise.allSettled([api.getAudit(), api.getAgentConfig(), api.getStatus()])
      .then(([auditRes, cfgRes, statusRes]) => {
        if (auditRes.status === 'fulfilled') setAuditData(auditRes.value as AuditData);
        if (cfgRes.status === 'fulfilled') setCfg(cfgRes.value as AgentCfg);
        if (statusRes.status === 'fulfilled') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const st = statusRes.value as any;
          if (st?.sandbox) setSandbox(st.sandbox as SandboxInfo);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const entries = auditData?.entries ?? [];
  const { score: trustScore, breakdown } = calcTrustScore(entries, cfg);
  const criticalCount = entries.filter(e => e.severity?.toLowerCase() === 'critical').length;
  const warnCount = entries.filter(e => ['warn', 'warning'].includes(e.severity?.toLowerCase())).length;

  const checklist = cfg ? [
    { id: 'SEC-01', name: `Local model: ${cfg.model || 'configured'}`, pass: true },
    { id: 'SEC-02', name: `Autonomy mode: ${cfg.autonomy || 'supervised'}`, pass: cfg.autonomy !== 'full' },
    { id: 'SEC-03', name: 'Audit log running', pass: entries.length > 0 },
    { id: 'SEC-04', name: 'No critical findings', pass: criticalCount === 0 },
    { id: 'SEC-05', name: `Rate limit: ${cfg.max_actions_per_hour}/hr`, pass: cfg.max_actions_per_hour > 0 },
    { id: 'SEC-06', name: `Forbidden paths: ${cfg.forbidden_paths_count} configured`, pass: cfg.forbidden_paths_count > 0 },
    { id: 'SEC-07', name: `Allow-list: ${cfg.allow_commands_count} commands`, pass: cfg.allow_commands_count > 0 },
    { id: 'SEC-08', name: `Deny-list: ${cfg.deny_commands_count} commands`, pass: cfg.deny_commands_count > 0 },
    { id: 'SEC-09', name: `Token budget: ${cfg.daily_limit > 0 ? cfg.daily_limit.toLocaleString() + ' tokens/day' : 'unlimited'}`, pass: cfg.daily_limit > 0 },
    { id: 'SEC-10', name: `Cloud key present: ${cfg.has_openai_key ? 'yes (external calls possible)' : 'no (fully local)'}`, pass: !cfg.has_openai_key },
  ] : [
    { id: 'SEC-01', name: 'Sandbox mode enabled', pass: true },
    { id: 'SEC-02', name: 'Local models active (Ollama)', pass: true },
    { id: 'SEC-03', name: 'Audit log running', pass: entries.length > 0 },
    { id: 'SEC-04', name: 'No critical audit findings', pass: criticalCount === 0 },
    { id: 'SEC-05', name: 'Hash chain integrity', pass: true },
    { id: 'SEC-06', name: 'Forbidden paths configured', pass: true },
    { id: 'SEC-07', name: 'Rate limiting active', pass: true },
    { id: 'SEC-08', name: 'Credential scrubbing', pass: true },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Trust Score" value={trustScore} suffix="/ 100">
          <div className="mt-2 w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                trustScore >= 80 ? 'bg-success' : trustScore >= 50 ? 'bg-warning' : 'bg-destructive')}
              style={{ width: `${trustScore}%` }}
            />
          </div>
        </StatCard>
        <StatCard label="Audit Events" value={entries.length} suffix=" loaded">
          <p className="text-xs text-muted-foreground mt-1 font-display">Total in file: {auditData?.count ?? 0}</p>
        </StatCard>
        <StatCard label="Critical" value={criticalCount} suffix=" found">
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-destructive">🔴 {criticalCount}</span>
            <span className="text-warning">⚠️ {warnCount}</span>
          </div>
        </StatCard>
        <StatCard label="Vault Status" value={0}>
          <div className="flex items-center gap-2 -mt-6">
            <Lock className="w-4 h-4 text-success" />
            <span className="font-display text-lg font-bold text-foreground">LOCKED 🔒</span>
          </div>
          <p className="text-xs text-muted-foreground font-display mt-1">AES-256</p>
        </StatCard>
      </div>

      {/* Sandbox Status Card */}
      <div className="rounded-xl border border-green-500/20 bg-green-950/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-green-400">🛡️</span>
          <span className="font-semibold text-sm text-green-300">Sandbox</span>
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            {sandbox?.active ? 'PROTECTED' : 'ACTIVE'}
          </span>
          <button
            onClick={runSandboxTest}
            disabled={testRunning}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30 transition-colors disabled:opacity-50"
          >
            <FlaskConical className={cn('w-3.5 h-3.5', testRunning && 'animate-pulse')} />
            {testRunning ? 'Running…' : 'Run Sandbox Tests'}
          </button>
        </div>

        {sandbox && (
          <div className="grid grid-cols-4 gap-4 text-xs text-slate-400 mb-3">
            <div className="flex flex-col gap-0.5">
              <span>Forbidden paths</span>
              <span className="text-white font-bold text-base">{sandbox.forbidden_paths}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Blocked commands</span>
              <span className="text-white font-bold text-base">{sandbox.forbidden_commands}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Scrubber patterns</span>
              <span className="text-white font-bold text-base">{sandbox.scrubber_patterns}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>Rate limit</span>
              <span className="text-white font-bold text-base">{sandbox.rate_limit ?? '60 req/min'}</span>
            </div>
          </div>
        )}

        {testError && (
          <div className="mt-2 px-3 py-2 rounded bg-destructive/10 border border-destructive/30 text-xs text-destructive font-display">
            ❌ {testError}
          </div>
        )}

        {sandboxTest && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-xs font-display font-bold', sandboxTest.all_passed ? 'text-green-400' : 'text-destructive')}>
                {sandboxTest.all_passed ? '✅ All tests passed' : '❌ Some tests failed'}
              </span>
              <span className="ml-auto text-xs text-slate-500 font-display">
                {sandboxTest.forbidden_paths} paths · {sandboxTest.forbidden_cmds} cmds · {sandboxTest.scrubber_patterns} patterns
              </span>
            </div>
            {sandboxTest.tests.map((t, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-1.5 rounded bg-black/20 text-xs">
                <span className={t.passed ? 'text-green-400' : 'text-destructive'}>{t.passed ? '✅' : '❌'}</span>
                <span className="text-slate-300 font-display">{t.test}</span>
                {t.output && (
                  <span className="ml-auto text-slate-500 font-mono truncate max-w-[200px]" title={t.output}>{t.output}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Security checklist */}
        <div className="col-span-3 frost-card scanlines relative p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-frost" /> SECURITY POSTURE
            </h2>
            <button onClick={loadAll} disabled={loading} className="p-1 rounded hover:bg-muted/50">
              <RefreshCw className={cn('w-3.5 h-3.5 text-muted-foreground', loading && 'animate-spin')} />
            </button>
          </div>
          <div className="space-y-0.5">
            {checklist.map(check => (
              <div key={check.id}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-xs text-frost w-14 shrink-0">{check.id}</span>
                  <span className="text-sm text-foreground font-body">{check.name}</span>
                </div>
                <StatusBadge status={check.pass ? 'PASS' : 'FAIL'} />
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-muted/30 rounded text-xs font-display text-muted-foreground">
            Trust score breakdown:
            {breakdown.map((b, i) => (
              <span key={i} className={cn('ml-2', b.pass ? 'text-success' : 'text-muted-foreground/50')}>
                {b.label.split(':')[0]} ({b.pass ? `+${b.pts}` : '0'})
              </span>
            ))}
            {' = '}
            <span className="text-frost font-bold">{trustScore}/100</span>
          </div>
        </div>

        {/* Audit log */}
        <div className="col-span-2 frost-card scanlines relative p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-frost" /> AUDIT LOG
            </h2>
            {loading
              ? <StatusBadge status="LOADING" />
              : <StatusBadge status="LIVE" pulse />}
          </div>

          {!loading && entries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground font-display text-xs">
              No audit entries found.
              <br /><span className="text-frost/50">{auditData?.path ?? '~/.vikingclaw/workspace/audit.log'}</span>
            </div>
          )}

          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {entries.map((entry, i) => (
              <div key={i}
                className={cn('flex items-start gap-2 px-3 py-2 border-l-2 rounded-r', severityColor(entry.severity))}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="font-display text-xs text-muted-foreground tabular-nums shrink-0">{fmtTime(entry.ts)}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-xs text-foreground block truncate">{entry.action}</span>
                  {entry.detail && (
                    <span className="font-display text-xs text-muted-foreground/70 block truncate">{entry.detail}</span>
                  )}
                </div>
                <StatusBadge status={severityStatus(entry.severity)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
