/**
 * Universal Date and Time formatting utility.
 * Formats timestamps cleanly in the user's local timezone.
 */

export function parseToDate(raw: string | number | undefined | null): Date | null {
  if (!raw) return null;

  if (typeof raw === 'number') {
    // If it's unix timestamp in seconds, convert to milliseconds
    return new Date(raw < 1e11 ? raw * 1000 : raw);
  }

  const str = String(raw).trim();
  // If format is SQLite "YYYY-MM-DD HH:MM:SS" without timezone, treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(raw: string | number | undefined | null): string {
  const d = parseToDate(raw);
  if (!d) return '—';

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(raw: string | number | undefined | null): string {
  const d = parseToDate(raw);
  if (!d) return '—';

  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(raw: string | number | undefined | null): string {
  const d = parseToDate(raw);
  if (!d) return '—';

  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
