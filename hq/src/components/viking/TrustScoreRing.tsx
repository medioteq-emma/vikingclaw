import { useEffect, useState } from 'react';

interface TrustScoreRingProps {
  score: number;
  max?: number;
  size?: number;
}

export function TrustScoreRing({ score, max = 100, size = 32 }: TrustScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / max) * circumference;

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timeout);
  }, [score]);

  const color = score >= 80 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span className="font-display text-sm font-bold" style={{ color }}>{score}<span className="text-muted-foreground">/{max}</span></span>
    </div>
  );
}
