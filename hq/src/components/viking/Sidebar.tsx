import { Shield, Bot, Brain, Cpu, Globe, Workflow, DollarSign, Smartphone, User, MessageSquare, Map, Zap, Monitor, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewId =
  | 'security'
  | 'agents'
  | 'memory'
  | 'models'
  | 'system'
  | 'browser'
  | 'automation'
  | 'budget'
  | 'mobile'
  | 'chat'
  | 'mindmap'
  | 'functions'
  | 'google';

const navItems: { id: ViewId; label: string; icon: React.ElementType; separator?: boolean }[] = [
  { id: 'chat',       label: 'Chat',       icon: MessageSquare },
  { id: 'mindmap',    label: 'Mind Map',   icon: Map },
  { id: 'functions',  label: 'Functions',  icon: Zap, separator: true },
  { id: 'security',   label: 'Security',   icon: Shield },
  { id: 'agents',     label: 'Agents',     icon: Bot },
  { id: 'memory',     label: 'Memory',     icon: Brain },
  { id: 'models',     label: 'Models',     icon: Cpu },
  { id: 'system',     label: 'System & AI',icon: Monitor },
  { id: 'browser',    label: 'Browser',    icon: Globe },
  { id: 'automation', label: 'Automation', icon: Workflow },
  { id: 'budget',     label: 'Budget',     icon: DollarSign },
  { id: 'mobile',     label: 'Mobile',     icon: Smartphone },
  { id: 'google',     label: 'Google',     icon: Mail },
];

interface SidebarProps {
  active: ViewId;
  onChange: (id: ViewId) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ active, onChange, expanded, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'h-full bg-card border-r border-border flex flex-col justify-between shrink-0 transition-all duration-200 sidebar-frost-line',
        expanded ? 'w-[200px]' : 'w-16'
      )}
      onMouseEnter={onToggle}
      onMouseLeave={onToggle}
    >
      <nav className="flex flex-col gap-0.5 mt-2 px-2">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const isNew = ['chat', 'mindmap', 'functions'].includes(item.id);
          return (
            <div key={item.id}>
              {item.separator && <div className="my-1.5 mx-1 border-t border-border/50" />}
              <button
                onClick={() => onChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 relative',
                  isActive
                    ? 'bg-primary/10 text-frost border-l-2 border-frost'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent'
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isNew && !isActive && 'text-frost/70')} />
                {expanded && (
                  <span className="font-body text-sm truncate flex items-center gap-1.5">
                    {item.label}
                    {isNew && (
                      <span className="text-[9px] font-display font-bold text-frost/60 bg-frost/10 px-1 rounded">NEW</span>
                    )}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="px-2 pb-3">
        <div className={cn('flex items-center gap-2 px-3 py-2', expanded ? '' : 'justify-center')}>
          <div className="relative">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-success rounded-full pulse-dot" />
          </div>
          {expanded && <span className="font-display text-xs text-muted-foreground">hassan</span>}
        </div>
      </div>
    </aside>
  );
}
