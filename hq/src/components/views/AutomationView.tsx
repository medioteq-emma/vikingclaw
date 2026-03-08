import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Workflow, Plus, Play, Trash2, ToggleLeft, ToggleRight, Clock, RefreshCw, CheckCircle, XCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { type: string; schedule?: string };
  actions: { type: string; params: Record<string, string> }[];
  last_run?: string;
  last_status?: string;
  run_count: number;
  created_at: string;
}

interface RunEntry {
  rule_id: string;
  rule_name: string;
  started_at: string;
  status: string;
  output?: string;
  error?: string;
}

const emptyRule = () => ({
  name: '',
  trigger_type: 'cron',
  schedule: '0 8 * * *',
  action_type: 'message',
  action_param: '',
});

export function AutomationView() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [selected, setSelected] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRule());
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ruleRes, runRes] = await Promise.all([
        api.getAutomationRules(),
        api.getAutomationRuns(),
      ]);
      const ruleList: Rule[] = ruleRes.rules ?? [];
      const runList: RunEntry[] = runRes.runs ?? [];
      setRules(ruleList);
      setRuns(runList);
      if (ruleList.length > 0 && !selected) setSelected(ruleList[0]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const handleToggle = async (id: string) => {
    await api.toggleAutomationRule(id);
    await loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await api.deleteAutomationRule(id);
    if (selected?.id === id) setSelected(null);
    await loadAll();
  };

  const handleRun = async (id: string) => {
    await api.runAutomationRule(id);
    setTimeout(loadAll, 1000);
  };

  const handleAddRule = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await api.addAutomationRule({
      name: form.name,
      trigger: { type: form.trigger_type, schedule: form.schedule },
      actions: [{ type: form.action_type, params: { command: form.action_param, message: form.action_param, url: form.action_param } }],
    });
    setForm(emptyRule());
    setShowForm(false);
    await loadAll();
    setSaving(false);
  };

  const runsForSelected = selected
    ? runs.filter(r => r.rule_id === selected.id).slice(-5).reverse()
    : runs.slice(-5).reverse();

  const statusIcon = (status?: string) => {
    if (status === 'success') return <CheckCircle className="w-3 h-3 text-success" />;
    if (status === 'error' || status === 'failed') return <XCircle className="w-3 h-3 text-destructive" />;
    if (status === 'running') return <Loader className="w-3 h-3 text-warning animate-spin" />;
    return <Clock className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="p-6 animate-fade-in flex gap-4 h-[calc(100vh-52px)]">
      {/* Rule List */}
      <div className="w-[38%] frost-card scanlines relative p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <Workflow className="w-4 h-4 text-frost" /> AUTOMATION RULES
          </h2>
          <button onClick={loadAll} className="p-1 rounded hover:bg-muted/50 transition-colors">
            <RefreshCw className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader className="w-5 h-5 text-frost animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-display text-center">
              No rules yet.<br />Create one below.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-1 overflow-y-auto">
            {rules.map(rule => (
              <button
                key={rule.id}
                onClick={() => setSelected(rule)}
                className={cn(
                  'w-full text-left px-3 py-3 rounded transition-colors',
                  selected?.id === rule.id ? 'bg-primary/10 border border-frost/20' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', rule.enabled ? 'bg-success' : 'bg-muted-foreground')} />
                  <span className="text-sm font-body text-foreground truncate">{rule.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-display ml-4">
                  <span className="uppercase">{rule.trigger.type}</span>
                  {rule.trigger.schedule && <span className="font-mono">{rule.trigger.schedule}</span>}
                  <span className="ml-auto">×{rule.run_count}</span>
                  {statusIcon(rule.last_status)}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="mt-3 w-full py-2 text-sm font-display rounded bg-primary/10 text-frost border border-frost/20 hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> NEW RULE
        </button>

        {/* Add Rule Form */}
        {showForm && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <input
              placeholder="Rule name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm font-body text-foreground outline-none focus:border-frost/50"
            />
            <div className="flex gap-2">
              <select
                value={form.trigger_type}
                onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}
                className="flex-1 bg-background/50 border border-border rounded px-2 py-1.5 text-xs font-display text-foreground outline-none"
              >
                <option value="cron">CRON</option>
                <option value="manual">MANUAL</option>
              </select>
              {form.trigger_type === 'cron' && (
                <input
                  placeholder="0 8 * * *"
                  value={form.schedule}
                  onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                  className="flex-1 bg-background/50 border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground outline-none"
                />
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={form.action_type}
                onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                className="flex-1 bg-background/50 border border-border rounded px-2 py-1.5 text-xs font-display text-foreground outline-none"
              >
                <option value="message">MESSAGE</option>
                <option value="shell">SHELL</option>
                <option value="browser">BROWSER</option>
                <option value="ai">AI</option>
              </select>
            </div>
            <input
              placeholder={form.action_type === 'shell' ? 'echo hello' : form.action_type === 'browser' ? 'https://...' : 'message or prompt'}
              value={form.action_param}
              onChange={e => setForm(f => ({ ...f, action_param: e.target.value }))}
              className="w-full bg-background/50 border border-border rounded px-2 py-1.5 text-sm font-mono text-foreground outline-none"
            />
            <button
              onClick={handleAddRule}
              disabled={saving || !form.name.trim()}
              className="w-full py-1.5 text-xs font-display font-bold rounded bg-frost text-primary-foreground hover:bg-frost/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'SAVING...' : '+ ADD RULE'}
            </button>
          </div>
        )}
      </div>

      {/* Rule Detail + Run History */}
      <div className="flex-1 flex flex-col gap-4">
        {selected ? (
          <div className="frost-card scanlines relative p-5 flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-sm font-bold text-foreground">{selected.name}</h2>
                <p className="text-xs text-muted-foreground mt-1 font-display">
                  {selected.trigger.type.toUpperCase()}
                  {selected.trigger.schedule && ` · ${selected.trigger.schedule}`}
                  &nbsp;·&nbsp; {selected.run_count} runs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRun(selected.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-display rounded bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                >
                  <Play className="w-3 h-3" /> RUN NOW
                </button>
                <button
                  onClick={() => handleToggle(selected.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-display rounded bg-primary/10 text-frost border border-frost/20 hover:bg-primary/20 transition-colors"
                >
                  {selected.enabled
                    ? <><ToggleRight className="w-3 h-3 text-success" /> DISABLE</>
                    : <><ToggleLeft className="w-3 h-3" /> ENABLE</>
                  }
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-display rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> DELETE
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mb-4">
              <p className="text-xs font-display text-muted-foreground mb-2">ACTIONS</p>
              <div className="flex flex-col gap-2">
                {selected.actions?.map((action, i) => (
                  <div key={i} className="frost-card p-3 flex items-start gap-3">
                    <span className="text-xs font-display text-frost font-bold uppercase">{action.type}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {Object.values(action.params).filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Last run info */}
            {selected.last_run && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-display">
                {statusIcon(selected.last_status)}
                Last run: {new Date(selected.last_run).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="frost-card scanlines relative p-5 flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-display">Select a rule to view details</p>
          </div>
        )}

        {/* Run History */}
        <div className="frost-card scanlines relative p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">
            RUN HISTORY {selected && <span className="text-muted-foreground font-normal text-xs">— {selected.name}</span>}
          </h2>
          {runsForSelected.length === 0 ? (
            <p className="text-xs text-muted-foreground font-display">No runs recorded yet</p>
          ) : (
            <div className="space-y-1">
              {runsForSelected.map((run, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  {statusIcon(run.status)}
                  <span className="font-display text-muted-foreground">
                    {new Date(run.started_at).toLocaleTimeString()}
                  </span>
                  <span className={cn(
                    'font-display font-bold uppercase',
                    run.status === 'success' ? 'text-success' : run.status === 'error' ? 'text-destructive' : 'text-warning'
                  )}>{run.status}</span>
                  {run.output && <span className="text-muted-foreground truncate max-w-xs font-mono">{run.output.trim()}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
