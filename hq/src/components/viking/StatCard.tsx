import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  children?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, suffix, decimals = 0, children, className }: StatCardProps) {
  const animated = useCountUp(value, 800, decimals);

  return (
    <div className={cn('frost-card scanlines relative p-5', className)}>
      <p className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">
        {animated}{suffix && <span className="text-muted-foreground text-lg ml-1">{suffix}</span>}
      </p>
      {children}
    </div>
  );
}
