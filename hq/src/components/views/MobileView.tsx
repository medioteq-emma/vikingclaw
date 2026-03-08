import { syncFeed } from '@/data/mockData';
import { StatusBadge } from '@/components/viking/StatusBadge';
import { Smartphone, RefreshCw, QrCode, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileView() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Connected Device */}
      <div className="frost-card scanlines relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-frost" />
            <span className="font-display text-sm font-bold text-foreground">📱 Hassan's iPhone 15 Pro</span>
          </div>
          <StatusBadge status="SYNCED" />
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
          <span>Last sync: <span className="text-foreground font-display">2 min ago</span></span>
          <span>Pending: <span className="text-foreground font-display">12 items</span></span>
          <span>Memories: <span className="text-foreground font-display">47 synced</span></span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Models: <span className="font-display text-frost">phi3:mini</span> (on device)</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm font-display rounded bg-frost text-primary-foreground hover:bg-frost/90 transition-colors flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> SYNC NOW
          </button>
          <button className="px-4 py-2 text-sm font-display rounded bg-primary/10 text-frost border border-frost/20 hover:bg-primary/20 transition-colors">
            DETAILS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Sync Feed */}
        <div className="frost-card scanlines relative p-5">
          <h2 className="font-display text-sm font-bold text-foreground mb-4">SYNC STATUS</h2>
          <div className="space-y-2">
            {syncFeed.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-sm slide-in-top" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="font-display text-xs text-muted-foreground tabular-nums">{entry.time}</span>
                {entry.direction === 'up' && <ArrowUp className="w-3 h-3 text-frost" />}
                {entry.direction === 'down' && <ArrowDown className="w-3 h-3 text-success" />}
                {entry.direction === 'sync' && <RefreshCw className="w-3 h-3 text-warning" />}
                <span className="text-muted-foreground">{entry.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phone Mockup */}
        <div className="frost-card scanlines relative p-5">
          <h2 className="font-display text-sm font-bold text-foreground mb-4">MOBILE APP STATUS</h2>
          <div className="mx-auto w-40 bg-background rounded-2xl border-2 border-border p-2 relative">
            {/* Notch */}
            <div className="w-16 h-3 bg-border rounded-full mx-auto mb-2" />
            {/* Screen */}
            <div className="bg-card rounded-lg p-3 space-y-2 min-h-[180px]">
              <div className="h-4 bg-muted/50 rounded w-3/4" />
              <div className="h-8 bg-frost/10 rounded border border-frost/20 flex items-center px-2">
                <span className="text-[8px] text-frost font-display">How can I help?</span>
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-muted/30 rounded w-full" />
                <div className="h-3 bg-muted/30 rounded w-2/3" />
              </div>
              <div className="h-6 bg-frost/10 rounded border border-frost/20 flex items-center px-2">
                <span className="text-[7px] text-muted-foreground font-display">phi3:mini ● running</span>
              </div>
            </div>
            {/* Bottom bar */}
            <div className="flex justify-center gap-4 mt-2 text-[7px] text-muted-foreground font-display">
              <span>🔋 87%</span>
              <span>RAM: 2.1GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pairing Panel */}
      <div className="frost-card scanlines relative p-5">
        <h2 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-frost" /> PAIR NEW DEVICE
        </h2>
        <div className="flex gap-8 items-center">
          {/* QR Code placeholder */}
          <div className="w-32 h-32 grid grid-cols-8 grid-rows-8 gap-0.5 p-2 bg-foreground rounded">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className={cn('rounded-sm', Math.random() > 0.4 ? 'bg-background' : 'bg-foreground')} />
            ))}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-3">Or enter pairing code manually:</p>
            <p className="font-display text-2xl font-bold text-frost tracking-widest mb-2">VIKNG-7X4K-9M2P</p>
            <p className="text-xs text-muted-foreground">Expires in: <span className="font-display text-warning">04:32</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
