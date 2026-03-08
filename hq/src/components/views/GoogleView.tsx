import { useState, useEffect } from 'react';
import { Mail, Calendar, FolderOpen, FileText, ExternalLink, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const API = 'http://localhost:7070';

interface GoogleStatus {
  connected: boolean;
  has_credentials: boolean;
  setup_url: string;
  token_path: string;
  secret_path: string;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function SetupGuide({ status }: { status: GoogleStatus }) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <GoogleIcon className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Connect Google Workspace</h2>
        <p className="text-muted-foreground text-sm">
          Connect Gmail, Drive, Calendar, and Docs to VikingClaw. Everything runs locally — your data never leaves your machine.
        </p>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
          {status.has_credentials ? (
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <div>
            <div className="text-xs font-medium">OAuth Credentials</div>
            <div className="text-xs text-muted-foreground">{status.has_credentials ? 'Found' : 'Missing'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
          {status.connected ? (
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <div>
            <div className="text-xs font-medium">Auth Token</div>
            <div className="text-xs text-muted-foreground">{status.connected ? 'Valid' : 'Not authorized'}</div>
          </div>
        </div>
      </div>

      {/* Setup steps */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground">Setup in 3 steps:</h3>

        <div className="flex gap-4 p-4 rounded-xl bg-card border border-border">
          <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">1</span>
          <div className="space-y-1">
            <div className="text-sm font-medium">Create OAuth 2.0 credentials</div>
            <p className="text-xs text-muted-foreground">
              Go to{' '}
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
                 className="text-blue-400 underline inline-flex items-center gap-1">
                console.cloud.google.com <ExternalLink className="w-3 h-3" />
              </a>
              {' '}→ APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID (Desktop app) → Download JSON
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 rounded-xl bg-card border border-border">
          <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">2</span>
          <div className="space-y-1">
            <div className="text-sm font-medium">Save the credentials file</div>
            <p className="text-xs text-muted-foreground">Save the downloaded JSON as:</p>
            <code className="block text-xs text-green-400 bg-black/30 rounded px-2 py-1 font-mono mt-1">
              {status.secret_path}
            </code>
          </div>
        </div>

        <div className="flex gap-4 p-4 rounded-xl bg-card border border-border">
          <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">3</span>
          <div className="space-y-1">
            <div className="text-sm font-medium">Authorize the connection</div>
            <p className="text-xs text-muted-foreground">Run this command in your terminal:</p>
            <code className="block text-xs text-green-400 bg-black/30 rounded px-2 py-1 font-mono mt-1">
              gws auth login -s drive,gmail,calendar,docs,sheets
            </code>
          </div>
        </div>
      </div>

      {/* Services list */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        {[
          { icon: '📧', name: 'Gmail', desc: 'Read emails, send replies' },
          { icon: '📅', name: 'Calendar', desc: 'Events and scheduling' },
          { icon: '📁', name: 'Drive', desc: 'Files and documents' },
          { icon: '📄', name: 'Docs & Sheets', desc: 'Read and edit documents' },
        ].map(s => (
          <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-xl">{s.icon}</span>
            <div>
              <div className="text-xs font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = 'gmail' | 'calendar' | 'drive';

function GmailTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/google/gmail`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading emails...</div>;
  if (data?.error) return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {data.error}
    </div>
  );

  const messages = data?.messages || [];
  if (messages.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No unread messages 🎉</div>
  );

  return (
    <div className="space-y-2">
      {messages.map((msg: any) => (
        <div key={msg.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{msg.snippet || msg.id}</div>
              <div className="text-xs text-muted-foreground mt-0.5">ID: {msg.id}</div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{msg.threadId?.slice(0, 8)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/google/calendar`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading calendar...</div>;
  if (data?.error) return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {data.error}
    </div>
  );

  const items = data?.items || [];
  if (items.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No upcoming events today 🗓️</div>
  );

  return (
    <div className="space-y-2">
      {items.map((evt: any) => {
        const start = evt.start?.dateTime || evt.start?.date || '';
        const startTime = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return (
          <div key={evt.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{evt.summary || '(No title)'}</div>
                {evt.location && <div className="text-xs text-muted-foreground mt-0.5 truncate">📍 {evt.location}</div>}
              </div>
              {startTime && <span className="text-xs text-primary shrink-0">{startTime}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DriveTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/google/drive`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading files...</div>;
  if (data?.error) return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {data.error}
    </div>
  );

  const files = data?.files || [];
  if (files.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No recent files found</div>
  );

  function mimeIcon(mime: string) {
    if (mime?.includes('document')) return '📄';
    if (mime?.includes('spreadsheet')) return '📊';
    if (mime?.includes('presentation')) return '📽️';
    if (mime?.includes('folder')) return '📁';
    if (mime?.includes('image')) return '🖼️';
    if (mime?.includes('pdf')) return '📕';
    return '📄';
  }

  return (
    <div className="space-y-2">
      {files.map((file: any) => {
        const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';
        return (
          <div key={file.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg shrink-0">{mimeIcon(file.mimeType)}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">Modified {modified}</div>
                </div>
              </div>
              {file.size && <span className="text-xs text-muted-foreground shrink-0">{Math.round(file.size / 1024)}KB</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GoogleView() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('gmail');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`${API}/api/google/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, has_credentials: false, setup_url: '', token_path: '', secret_path: '' }));
  }, [refreshKey]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'gmail', label: 'Gmail', icon: Mail },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'drive', label: 'Drive', icon: FolderOpen },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GoogleIcon className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Google Workspace</h1>
            <p className="text-xs text-muted-foreground">Local processing · No cloud sync</p>
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Connection status banner */}
      {status && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
          status.connected
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
        }`}>
          {status.connected ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {status.connected
            ? 'Connected — Google Workspace active. All data stays on your device.'
            : 'Not connected — Follow the setup guide below to connect your Google account.'}
        </div>
      )}

      {/* Not connected: show setup guide */}
      {status && !status.connected && (
        <SetupGuide status={status} />
      )}

      {/* Connected: show tabs */}
      {status?.connected && (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/30 border border-border mb-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="min-h-[300px]">
            {activeTab === 'gmail' && <GmailTab key={`gmail-${refreshKey}`} />}
            {activeTab === 'calendar' && <CalendarTab key={`cal-${refreshKey}`} />}
            {activeTab === 'drive' && <DriveTab key={`drive-${refreshKey}`} />}
          </div>
        </div>
      )}
    </div>
  );
}
