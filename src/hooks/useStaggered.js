import { useState, useEffect } from 'react';

/**
 * Returns an integer that increments from 0 → total, one step every delayMs.
 * Use: if (ready >= N) render the Nth thing.
 * @param {number} total - how many steps to count up to
 * @param {number} delayMs - ms between each step
 * @param {boolean} enabled - only start counting when true
 */
export function useStaggered(total, delayMs = 120, enabled = true) {
  const [ready, setReady] = useState(0);

  useEffect(() => {
    if (!enabled || ready >= total) return;
    const id = setTimeout(() => setReady(r => r + 1), delayMs);
    return () => clearTimeout(id);
  }, [ready, total, delayMs, enabled]);

  return ready;
}
