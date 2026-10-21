/** Formatting helpers for scores, times and durations. */

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '–';
  return Math.round(value).toLocaleString('en-US');
}

/** Seconds to m:ss (or h:mm:ss). */
export function formatClock(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '–';
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return '–';
  return `${Math.round(ms)} ms`;
}

export function formatPercent(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return '–';
  return `${Math.round(ratio * 100)}%`;
}

/** Formats a stored record according to the format named in game metadata. */
export function formatRecord(value, format = 'number') {
  switch (format) {
    case 'clock':
      return formatClock(value);
    case 'ms':
      return formatMs(value);
    case 'level':
      return `Level ${formatNumber(value)}`;
    default:
      return formatNumber(value);
  }
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
