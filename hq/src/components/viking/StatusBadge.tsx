import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

const variantMap: Record<string, BadgeVariant> = {
  pass: 'success', PASS: 'success', APPROVED: 'success', active: 'success', ACTIVE: 'success', 
  ONLINE: 'success', loaded: 'success', success: 'success', SYNCED: 'success',
  warn: 'warning', WARN: 'warning', PENDING: 'warning', paused: 'warning', MEDIUM: 'warning',
  running: 'warning',
  fail: 'danger', FAIL: 'danger', DENIED: 'danger', HIGH: 'danger', failed: 'danger',
  'AUTO-OK': 'info', info: 'info', idle: 'info', ready: 'info', unloaded: 'info',
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
};

interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse, className }: StatusBadgeProps) {
  const variant = variantMap[status] || 'info';
  const shouldPulse = pulse ?? (variant === 'warning' || variant === 'danger');

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-display font-medium uppercase tracking-wide', variantStyles[variant], className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full bg-current', shouldPulse && 'pulse-dot')} />
      {status}
    </span>
  );
}
