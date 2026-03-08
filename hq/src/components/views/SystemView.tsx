import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ChevronRight, CheckCircle, Download, X, Zap, Cpu, HardDrive, Monitor } from 'lucide-react';

const BASE = 'http://localhost:7070';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HardwareSpecs {
  os: string;
  arch: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  ram_gb: number;
  ram_free_gb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  has_gpu: boolean;
  gpu_model?: string;
  gpu_vram_gb?: number;
  is_wsl: boolean;
  tier: 'low' | 'mid' | 'high' | 'ultra';
}

interface ModelRec {
  name: string;
  tag: string;
  size_gb: number;
  role: string;
  description: string;
  reason: string;
  performance: 'fast' | 'balanced' | 'smart' | 'genius';
  compatible: boolean;
  installed: boolean;
  recommended: boolean;
  ram_required_gb: number;
  tags: string[];
}

interface DownloadState {
  tag: string;
  friendlyName: string;
  percent: number;
  doneMB: number;
  totalMB: number;
  status: string;
  done: boolean;
  error: string | null;
}

// ─── Friendly name mappings ───────────────────────────────────────────────────

const FRIENDLY_NAMES: Record<string, string> = {
  'phi3:mini':           'Quick Helper (Microsoft)',
  'gemma2:2b':           'Tiny Helper (Google)',
  'qwen2.5:3b':          'Pocket Assistant (Alibaba)',
  'qwen2.5:7b':          'Smart Assistant (Alibaba)',
  'qwen2.5:14b':         'Advanced Assistant (Alibaba)',
  'llama3.2:latest':     'General Helper (Meta)',
  'llama3.1:8b':         'General Helper (Meta)',
  'llama3.1:70b':        'Mega Helper (Meta)',
  'mistral:7b':          'Fast Talker (Mistral)',
  'deepseek-r1:7b':      'Deep Thinker (DeepSeek)',
  'deepseek-r1:14b':     'Expert Thinker (DeepSeek)',
  'deepseek-r1:32b':     'Master Thinker (DeepSeek)',
  'qwq:32b':             'Grand Reasoner (QwQ)',
  'qwen2.5-coder:7b':    'Code Writer (Alibaba)',
  'qwen2.5-coder:14b':   'Pro Code Writer (Alibaba)',
  'codestral:22b':       'Code Expert (Mistral)',
  'devstral:24b':        'Software Engineer AI (Mistral)',
  'llava:7b':            'Image Reader (LLaVA)',
  'qwen2.5vl:7b':        'Vision Pro (Alibaba)',
  'minicpm-v:8b':        'Picture Helper (MiniCPM)',
  'nomic-embed-text':    'Memory Search Engine',
  'mxbai-embed-large':   'Smart Memory Search',
  'gemma2:27b':          'Power Assistant (Google)',
};

const ROLE_EMOJI: Record<string, string> = {
  chat:       '💬',
  reasoning:  '🧠',
  coding:     '💻',
  vision:     '👁️',
  embeddings: '🔍',
  routing:    '⚡',
};

const ROLE_LABEL: Record<string, string> = {
  chat:       'Chat & Writing',
  reasoning:  'Deep Thinking',
  coding:     'Code Writing',
  vision:     'Image Reading',
  embeddings: 'Memory Search',
  routing:    'Quick Tasks',
};

const PERF_ANIMAL: Record<string, string> = {
  fast:     '🐇 Fast',
  balanced: '🦊 Balanced',
  smart:    '🦅 Smart',
  genius:   '🦁 Powerful',
};

const TIER_INFO: Record<string, { headline: string; body: string; color: string; bg: string; badge: string }> = {
  low: {
    headline: 'Your PC can run Basic AI',
    body: 'You can run lightweight AI assistants that handle everyday tasks quickly — all on your device, no internet needed.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    badge: 'Basic AI — fast and lightweight',
  },
  mid: {
    headline: 'Your PC can run Medium AI models',
    body: "You can run smart AI assistants that rival ChatGPT — all on your device, no internet needed.",
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    badge: 'Medium AI — smart and capable',
  },
  high: {
    headline: 'Your PC can run Powerful AI models',
    body: 'You can run very intelligent AI assistants that match premium cloud services — completely offline.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    badge: 'Powerful AI — very smart models',
  },
  ultra: {
    headline: 'Your PC can run Expert AI models',
    body: "You have a powerhouse machine. You can run the world's best open AI models locally — no limits.",
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    badge: 'Expert AI — top models available',
  },
};

const ASSIGN_ROLES = [
  { id: 'default',    label: 'Main AI',        desc: 'Used for most conversations',             emoji: '🤖' },
  { id: 'reasoning',  label: 'Problem Solver',  desc: 'For complex questions and deep thinking',  emoji: '🧠' },
  { id: 'coding',     label: 'Code Helper',     desc: 'Helps you write and fix code',             emoji: '💻' },
  { id: 'vision',     label: 'Image Reader',    desc: 'Understands and describes images',          emoji: '👁️' },
  { id: 'embeddings', label: 'Memory Search',   desc: 'Powers search through your memories',      emoji: '🔍' },
  { id: 'routing',    label: 'Quick Router',    desc: 'Fast decisions and simple classifications', emoji: '⚡' },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function friendlyName(tag: string) {
  return FRIENDLY_NAMES[tag] ?? tag;
}

function friendlySize(gb: number) {
  return gb < 1 ? `${(gb * 1024).toFixed(0)} MB` : `${gb.toFixed(1)} GB`;
}

function friendlyRAM(gb: number) {
  return `${gb} gigabytes`;
}

function memoryLabel(gb: number) {
  if (gb >= 64) return { text: 'Excellent — handles the biggest models', color: 'text-purple-400' };
  if (gb >= 32) return { text: 'Great — runs powerful AI models', color: 'text-emerald-400' };
  if (gb >= 16) return { text: 'Good — handles most AI models', color: 'text-blue-400' };
  if (gb >= 8)  return { text: 'Decent — runs lightweight models well', color: 'text-amber-400' };
  return { text: 'Limited — best for small, fast models', color: 'text-red-400' };
}

function diskLabel(freeGB: number) {
  if (freeGB >= 100) return { text: 'Plenty of space', color: 'text-emerald-400' };
  if (freeGB >= 50)  return { text: 'Good amount of space', color: 'text-blue-400' };
  if (freeGB >= 20)  return { text: 'Some space — plan ahead', color: 'text-amber-400' };
  return { text: 'Running low — free up space soon', color: 'text-red-400' };
}

function cpuFriendly(model: string) {
  // Strip long Intel/AMD model strings to just the key part
  const clean = model
    .replace(/@.*/, '')
    .replace(/\(R\)|\(TM\)|CPU|Processor/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || model;
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ─── Download Overlay ─────────────────────────────────────────────────────────

function DownloadOverlay({ dl, onClose }: { dl: DownloadState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-md shadow-2xl mx-4">
        {dl.done && !dl.error ? (
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">✅</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Ready to use!</h2>
            <p className="text-muted-foreground mb-6">{dl.friendlyName} has been downloaded and is ready.</p>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors"
            >
              Awesome! 🎉
            </button>
          </div>
        ) : dl.error ? (
          <div className="text-center">
            <div className="text-5xl mb-4">😕</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">Please try again in a moment.</p>
            <button onClick={onClose} className="px-6 py-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold transition-colors">
              Close
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Downloading</p>
                <h2 className="text-xl font-bold text-foreground">{dl.friendlyName}</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground font-semibold">{dl.percent.toFixed(0)}%</span>
                <span className="text-muted-foreground">
                  {dl.totalMB > 0
                    ? `${(dl.doneMB / 1024).toFixed(1)} GB of ${(dl.totalMB / 1024).toFixed(1)} GB`
                    : dl.status}
                </span>
              </div>
              <ProgressBar pct={dl.percent} color="bg-blue-500" />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {dl.percent === 0 ? 'Starting download…' : 'This may take a few minutes depending on your internet speed'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 1 — Hardware ─────────────────────────────────────────────────────────

function HardwareTab({ specs, onGoToRecs }: { specs: HardwareSpecs | null; onGoToRecs: () => void }) {
  if (!specs) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🔍</div>
          <p>Scanning your PC…</p>
        </div>
      </div>
    );
  }

  const tier = TIER_INFO[specs.tier] ?? TIER_INFO.mid;
  const ramUsed = specs.ram_gb - specs.ram_free_gb;
  const ramPct = (ramUsed / specs.ram_gb) * 100;
  const diskUsed = specs.disk_total_gb - specs.disk_free_gb;
  const diskPct = (diskUsed / specs.disk_total_gb) * 100;
  const ramInfo = memoryLabel(specs.ram_gb);
  const diskInfo = diskLabel(specs.disk_free_gb);

  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Memory */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🧠</span>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Memory</p>
              <p className="text-lg font-bold text-foreground">{Math.round(specs.ram_gb)} GB</p>
            </div>
          </div>
          <p className={cn('text-sm font-medium mb-2', ramInfo.color)}>{ramInfo.text}</p>
          <ProgressBar
            pct={ramPct}
            color={ramPct > 80 ? 'bg-red-500' : ramPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {Math.round(specs.ram_free_gb)} GB free of {Math.round(specs.ram_gb)} GB
          </p>
        </div>

        {/* Processor */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Processor</p>
              <p className="text-lg font-bold text-foreground">{specs.cpu_threads} threads</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">{cpuFriendly(specs.cpu_model)}</p>
          {specs.is_wsl && (
            <span className="mt-2 inline-block text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
              Running via WSL
            </span>
          )}
        </div>

        {/* Storage */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">💾</span>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Free Storage</p>
              <p className="text-lg font-bold text-foreground">{Math.round(specs.disk_free_gb)} GB free</p>
            </div>
          </div>
          <p className={cn('text-sm font-medium mb-2', diskInfo.color)}>{diskInfo.text}</p>
          <ProgressBar
            pct={diskPct}
            color={diskPct > 90 ? 'bg-red-500' : diskPct > 70 ? 'bg-amber-500' : 'bg-blue-500'}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {Math.round(specs.disk_free_gb)} GB available of {Math.round(specs.disk_total_gb)} GB
          </p>
        </div>

        {/* GPU */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎮</span>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Graphics Card</p>
              <p className="text-lg font-bold text-foreground">
                {specs.has_gpu ? (specs.gpu_vram_gb ? `${Math.round(specs.gpu_vram_gb)} GB VRAM` : 'Detected') : 'No GPU'}
              </p>
            </div>
          </div>
          {specs.has_gpu ? (
            <p className="text-sm text-emerald-400 font-medium">
              {specs.gpu_model ? cpuFriendly(specs.gpu_model) : 'GPU detected — AI runs faster'}
            </p>
          ) : (
            <>
              <p className="text-sm text-amber-400 font-medium">No GPU detected</p>
              <p className="text-xs text-muted-foreground mt-1">Using processor instead — still works great</p>
            </>
          )}
        </div>
      </div>

      {/* Big verdict card */}
      <div className={cn('border rounded-2xl p-6', tier.bg)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏆</span>
              <span className={cn('text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10', tier.color)}>
                {tier.badge}
              </span>
            </div>
            <h2 className={cn('text-xl font-bold mt-2 mb-2', tier.color)}>{tier.headline}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{tier.body}</p>
          </div>
        </div>
        <button
          onClick={onGoToRecs}
          className={cn(
            'mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
            'bg-white/10 hover:bg-white/20 text-foreground'
          )}
        >
          See recommended models
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Tab 2 — Recommendations ──────────────────────────────────────────────────

const ROLE_ORDER = ['chat', 'reasoning', 'coding', 'vision', 'embeddings', 'routing'];

function RecsTab({
  specs,
  recs,
  onDownload,
}: {
  specs: HardwareSpecs | null;
  recs: ModelRec[];
  onDownload: (rec: ModelRec) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(true);

  const roles = ROLE_ORDER.filter(r => recs.some(m => m.role === r));
  const filtered = recs.filter(m => {
    if (filter !== 'all' && m.role !== filter) return false;
    if (showCompatibleOnly && !m.compatible) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filter === 'all' ? 'bg-primary/20 text-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
          )}
        >
          All
        </button>
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === r ? 'bg-primary/20 text-foreground' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {ROLE_EMOJI[r]} {ROLE_LABEL[r]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCompatibleOnly}
            onChange={e => setShowCompatibleOnly(e.target.checked)}
            className="rounded"
          />
          Compatible only
        </label>
      </div>

      {/* Model cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🤷</p>
          <p>No models match this filter.</p>
          <button onClick={() => setShowCompatibleOnly(false)} className="mt-2 text-sm text-blue-400 hover:underline">
            Show all (including incompatible)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(m => (
            <ModelCard key={m.tag} model={m} specs={specs} onDownload={onDownload} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelCard({
  model: m,
  specs,
  onDownload,
}: {
  model: ModelRec;
  specs: HardwareSpecs | null;
  onDownload: (rec: ModelRec) => void;
}) {
  const name = friendlyName(m.tag);
  const emoji = ROLE_EMOJI[m.role] ?? '🤖';

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all',
        m.installed
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : m.compatible
          ? 'border-border hover:border-border/80'
          : 'border-border/40 opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground text-sm leading-tight">{name}</p>
              {m.recommended && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                  ⭐ Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABEL[m.role]}</p>
          </div>
        </div>
        <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-lg shrink-0">
          {friendlySize(m.size_gb)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-snug">{m.description}</p>

      {/* Speed + RAM row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="bg-muted/50 px-2 py-1 rounded-full text-muted-foreground">
          {PERF_ANIMAL[m.performance]}
        </span>
        <span className="text-muted-foreground">Needs {m.ram_required_gb} GB memory</span>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground/80">{m.reason}</p>

      {/* Action button */}
      {m.installed ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-semibold">
          <CheckCircle className="w-4 h-4" />
          Installed ✓
        </div>
      ) : m.compatible ? (
        <button
          onClick={() => onDownload(m)}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
        >
          <Download className="w-4 h-4" />
          Download {friendlySize(m.size_gb)}
        </button>
      ) : (
        <div className="px-3 py-2 rounded-lg bg-muted/30 text-muted-foreground text-sm text-center">
          Needs more memory
        </div>
      )}
    </div>
  );
}

// ─── Tab 3 — Role Assignment ──────────────────────────────────────────────────

function AssignTab({
  installedModels,
  assignments,
  runningModels,
  onSave,
}: {
  installedModels: string[];
  assignments: Record<string, string>;
  runningModels: string[];
  onSave: (role: string, model: string) => Promise<void>;
}) {
  const [local, setLocal] = useState<Record<string, string>>(assignments);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocal(assignments);
  }, [assignments]);

  const handleSave = async (roleId: string) => {
    setSaving(s => ({ ...s, [roleId]: true }));
    await onSave(roleId, local[roleId] ?? '');
    setSaving(s => ({ ...s, [roleId]: false }));
    setSaved(s => ({ ...s, [roleId]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [roleId]: false })), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose which AI model handles each type of task. You can only pick from models you have installed.
      </p>

      {ASSIGN_ROLES.map(role => {
        const current = local[role.id] ?? '';
        const isRunning = runningModels.includes(current);
        const changed = current !== (assignments[role.id] ?? '');

        return (
          <div key={role.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{role.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{role.label}</p>
                    {isRunning && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Running
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{role.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={current}
                  onChange={e => setLocal(l => ({ ...l, [role.id]: e.target.value }))}
                  className="text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[180px]"
                >
                  <option value="">— Not assigned —</option>
                  {installedModels.map(m => (
                    <option key={m} value={m}>{friendlyName(m)}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleSave(role.id)}
                  disabled={!changed && !saving[role.id]}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                    saved[role.id]
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : changed
                      ? 'bg-blue-500 hover:bg-blue-400 text-white'
                      : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {saving[role.id] ? '…' : saved[role.id] ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {installedModels.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-sm">No models installed yet.</p>
          <p className="text-xs mt-1">Head to the Recommendations tab to download your first model.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type Tab = 'hardware' | 'recommendations' | 'assign';

export function SystemView() {
  const [tab, setTab] = useState<Tab>('hardware');
  const [specs, setSpecs] = useState<HardwareSpecs | null>(null);
  const [recs, setRecs] = useState<ModelRec[]>([]);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [runningModels, setRunningModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [download, setDownload] = useState<DownloadState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [specsRes, recsRes, assignRes, runRes] = await Promise.allSettled([
        fetch(`${BASE}/api/system/specs`).then(r => r.json()),
        fetch(`${BASE}/api/system/recommendations`).then(r => r.json()),
        fetch(`${BASE}/api/models/assignments`).then(r => r.json()),
        fetch(`${BASE}/api/models/running`).then(r => r.json()),
      ]);

      if (specsRes.status === 'fulfilled') setSpecs(specsRes.value);
      if (recsRes.status === 'fulfilled') {
        const d = recsRes.value;
        setRecs(d.recommendations ?? []);
        const inst = (d.recommendations ?? []).filter((m: ModelRec) => m.installed).map((m: ModelRec) => m.tag);
        setInstalledModels(inst);
      }
      if (assignRes.status === 'fulfilled') setAssignments(assignRes.value ?? {});
      if (runRes.status === 'fulfilled') {
        const running = runRes.value?.models ?? [];
        setRunningModels(running.map((m: { name: string }) => m.name));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Download handler
  const handleDownload = useCallback((rec: ModelRec) => {
    const name = friendlyName(rec.tag);
    const dl: DownloadState = {
      tag: rec.tag,
      friendlyName: name,
      percent: 0,
      doneMB: 0,
      totalMB: 0,
      status: 'Starting…',
      done: false,
      error: null,
    };
    setDownload({ ...dl });

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(`${BASE}/api/models/pull/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: rec.tag }),
      signal: ctrl.signal,
    }).then(async res => {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            setDownload(prev => prev ? {
              ...prev,
              percent: evt.percent ?? prev.percent,
              doneMB: evt.done_bytes ? evt.done_bytes / 1e6 : prev.doneMB,
              totalMB: evt.total_bytes ? evt.total_bytes / 1e6 : prev.totalMB,
              status: evt.status ?? prev.status,
              done: !!(evt.done || evt.status === 'success' || evt.status === 'complete'),
              error: evt.error ?? null,
            } : prev);
          } catch { /* ignore parse errors */ }
        }
      }
      // Mark done + reload
      setDownload(prev => prev ? { ...prev, done: true } : prev);
      loadData();
    }).catch(err => {
      if (err.name !== 'AbortError') {
        setDownload(prev => prev ? { ...prev, error: 'Download failed', done: false } : prev);
      }
    });
  }, [loadData]);

  const handleCloseDownload = useCallback(() => {
    abortRef.current?.abort();
    setDownload(null);
  }, []);

  const handleAssignSave = useCallback(async (role: string, model: string) => {
    await fetch(`${BASE}/api/models/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, model }),
    });
    setAssignments(a => ({ ...a, [role]: model }));
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'hardware',        label: 'My PC',          icon: '🖥️' },
    { id: 'recommendations', label: 'AI Models',       icon: '🤖' },
    { id: 'assign',          label: 'Role Setup',      icon: '⚙️' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="text-3xl">🖥️</span> System & AI Models
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Understand what your PC can do and find the right AI model for you
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'hardware' && (
        <HardwareTab
          specs={loading && !specs ? null : specs}
          onGoToRecs={() => setTab('recommendations')}
        />
      )}
      {tab === 'recommendations' && (
        <RecsTab
          specs={specs}
          recs={recs}
          onDownload={handleDownload}
        />
      )}
      {tab === 'assign' && (
        <AssignTab
          installedModels={installedModels}
          assignments={assignments}
          runningModels={runningModels}
          onSave={handleAssignSave}
        />
      )}

      {/* Download overlay */}
      {download && <DownloadOverlay dl={download} onClose={handleCloseDownload} />}
    </div>
  );
}
