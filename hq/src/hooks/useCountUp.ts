import { useState, useEffect } from 'react';

export function useCountUp(target: number, duration: number = 800, decimals: number = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Number((eased * target).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, decimals]);

  return value;
}
