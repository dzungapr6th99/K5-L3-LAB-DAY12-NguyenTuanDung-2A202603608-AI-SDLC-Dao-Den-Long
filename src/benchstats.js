// Frame statistics exactly as defined in Ticket-04 section 1. `dts` are frame times in milliseconds.
export function benchStats(dts) {
  const n = dts.length;
  if (n === 0) throw new Error('no frames were measured');
  const sum = dts.reduce((a, b) => a + b, 0);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = [...dts].sort((a, b) => b - a).slice(0, k);
  const asc = [...dts].sort((a, b) => a - b);
  const p95 = asc[Math.ceil(0.95 * n) - 1]; // nearest-rank 95th percentile
  return {
    frames: n,
    avg_fps: (1000 * n) / sum,
    p1_low_fps: 1000 / (worst.reduce((a, b) => a + b, 0) / k),
    frame_ms_p95: p95,
  };
}

export const round1 = (x) => Math.round(x * 10) / 10;
