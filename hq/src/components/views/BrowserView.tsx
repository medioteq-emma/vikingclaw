import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Globe, Square, Camera, Terminal, ChevronRight, CheckCircle, XCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserStatus {
  active: boolean;
  current_url: string;
  has_screenshot: boolean;
  nav_history: string[];
}

export function BrowserView() {
  const [url, setUrl] = useState('https://example.com');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jsScript, setJsScript] = useState('document.title');
  const [jsResult, setJsResult] = useState<string | null>(null);
  const [jsRunning, setJsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = async () => {
    try {
      const s = await api.getBrowserStatus();
      setStatus(s);
    } catch {
      // backend might not be running yet
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Auto-refresh screenshot every 3s when browser is active
  useEffect(() => {
    if (status?.active) {
      intervalRef.current = setInterval(async () => {
        try {
          const r = await api.browserScreenshot();
          if (r.screenshot) setScreenshot(r.screenshot);
        } catch { /* ignore */ }
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status?.active]);

  const handleNavigate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const trimmed = url.startsWith('http') ? url : `https://${url}`;
      const r = await api.browserNavigate(trimmed);
      if (r.error) { setError(r.error); }
      else {
        if (r.screenshot) setScreenshot(r.screenshot);
        await loadStatus();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleScreenshot = async () => {
    try {
      const r = await api.browserScreenshot();
      if (r.screenshot) setScreenshot(r.screenshot);
      if (r.error) setError(r.error);
    } catch { /* ignore */ }
  };

  const handleStop = async () => {
    await api.browserStop();
    setScreenshot(null);
    await loadStatus();
  };

  const handleRunJS = async () => {
    setJsRunning(true);
    setJsResult(null);
    try {
      const r = await api.browserExecute(jsScript);
      setJsResult(r.error ? `Error: ${r.error}` : r.result);
    } catch (e: unknown) {
      setJsResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setJsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Status Bar */}
      <div className="frost-card scanlines relative p-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          {status?.active
            ? <><CheckCircle className="w-4 h-4 text-success" /><span className="font-display text-success font-bold">BROWSER ACTIVE</span></>
            : <><XCircle className="w-4 h-4 text-muted-foreground" /><span className="font-display text-muted-foreground font-bold">BROWSER STOPPED</span></>
          }
        </div>
        {status?.current_url && (
          <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">{status.current_url}</span>
        )}
        {status?.active && (
          <button
            onClick={handleStop}
            className="ml-auto flex items-center gap-1 px-3 py-1 text-xs font-display rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
          >
            <Square className="w-3 h-3" /> STOP BROWSER
          </button>
        )}
      </div>

      {/* URL Bar */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <Globe className="w-3 h-3 text-frost" /> NAVIGATE
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNavigate()}
            placeholder="https://example.com"
            className="flex-1 bg-background/50 border border-border rounded px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-frost/50 transition-colors"
          />
          <button
            onClick={handleNavigate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-display font-bold rounded bg-frost text-primary-foreground hover:bg-frost/90 disabled:opacity-50 transition-colors"
          >
            {isLoading
              ? <Loader className="w-4 h-4 animate-spin" />
              : <ChevronRight className="w-4 h-4" />
            }
            GO
          </button>
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-display rounded bg-primary/10 text-frost border border-frost/20 hover:bg-primary/20 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-destructive font-mono">{error}</p>
        )}
      </div>

      {/* Screenshot Panel */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <Camera className="w-3 h-3 text-frost" /> BROWSER VIEW
          {status?.active && <span className="text-frost/60 text-xs ml-auto">● live refresh every 3s</span>}
        </h2>
        <div className={cn(
          'w-full rounded border border-border overflow-hidden flex items-center justify-center',
          screenshot ? 'bg-transparent' : 'bg-muted/20 h-64'
        )}>
          {screenshot
            ? <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Browser screenshot"
                className="w-full h-auto object-contain max-h-[500px]"
              />
            : <span className="text-sm text-muted-foreground font-display">
                {status?.active ? 'Waiting for screenshot...' : 'Navigate to a URL to start'}
              </span>
          }
        </div>
      </div>

      {/* JS Execution Panel */}
      <div className="frost-card scanlines relative p-4">
        <h2 className="font-display text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <Terminal className="w-3 h-3 text-frost" /> JAVASCRIPT CONSOLE
        </h2>
        <div className="flex gap-2 mb-2">
          <textarea
            value={jsScript}
            onChange={e => setJsScript(e.target.value)}
            rows={2}
            className="flex-1 bg-background/50 border border-border rounded px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-frost/50 transition-colors resize-none"
            placeholder="document.title"
          />
          <button
            onClick={handleRunJS}
            disabled={jsRunning || !status?.active}
            className="px-4 py-2 text-sm font-display font-bold rounded bg-primary/10 text-frost border border-frost/20 hover:bg-primary/20 disabled:opacity-40 transition-colors"
          >
            {jsRunning ? <Loader className="w-4 h-4 animate-spin" /> : '▶ RUN'}
          </button>
        </div>
        {jsResult !== null && (
          <div className="bg-background/50 border border-border rounded px-3 py-2">
            <p className="text-xs text-muted-foreground font-display mb-1">RESULT:</p>
            <pre className="text-xs font-mono text-success whitespace-pre-wrap">{jsResult}</pre>
          </div>
        )}
      </div>

      {/* Nav History */}
      {status?.nav_history && status.nav_history.length > 0 && (
        <div className="frost-card scanlines relative p-4">
          <h2 className="font-display text-xs font-bold text-muted-foreground mb-3">NAVIGATION HISTORY</h2>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...status.nav_history].reverse().map((h, i) => (
              <button
                key={i}
                onClick={() => { setUrl(h); }}
                className="w-full text-left text-xs font-mono text-muted-foreground hover:text-frost transition-colors truncate block"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
