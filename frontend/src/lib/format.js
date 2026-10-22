const isBlank = (n) => n === null || n === undefined || n === '' || Number.isNaN(Number(n));

/** Indian rupees with lakh/crore grouping: 1823000 -> "₹18,23,000". */
export const money = (n) => (isBlank(n) ? '-' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);

/** Annual salary in lakhs per annum, the way Indian offers are quoted: 1823000 -> "₹18.2 LPA". */
export const lpa = (n, digits = 1) => {
  if (isBlank(n)) return '-';
  const lakhs = Number(n) / 100000;
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs.toFixed(digits)} LPA`;
};

/** "+12%" / "−8%" for effects on a salary. */
export const signedPercent = (value, digits = 0) => {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${Math.abs(n).toFixed(digits)}%`;
};

export const percent = (ratio, digits = 0) => `${(Number(ratio || 0) * 100).toFixed(digits)}%`;

export const dateLabel = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');

export const dateTimeLabel = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');

export const firstName = (fullName) => (fullName || '').trim().split(/\s+/)[0] || '';

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Turn "**bold** text" into React-safe segments: [{ text, bold }]. Used instead of innerHTML. */
export function boldSegments(text) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**')
      ? { text: part.slice(2, -2), bold: true }
      : { text: part, bold: false }));
}

/** Build CSV text with proper quoting, so commas and quotes inside values stay in one column. */
export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

/** Decode HTML entities such as &hellip; and &amp; found in scraped job text. */
export function decodeEntities(text) {
  if (!text) return '';
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

export function downloadBlob(data, filename, type) {
  const url = window.URL.createObjectURL(type ? new Blob([data], { type }) : new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
