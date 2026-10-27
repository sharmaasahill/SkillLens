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

/**
 * A file name that can wrap onto several lines instead of being cut off. Names like
 * "Sahil_Sharma_Citi_Java_Python_Resume.pdf" have no spaces, so an invisible break point is added
 * after each _ . and -, and the line breaks there first.
 */
export const breakable = (name) => String(name ?? '').replace(/([_.-])/g, '$1\u200b');

/** Classes for text that must wrap, even inside one very long word, rather than overflow. */
export const WRAP = 'min-w-0 [overflow-wrap:anywhere]';

export const dateLabel = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');

export const dateTimeLabel = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');

/**
 * A calendar date such as a birthday ("1998-05-14") as "14/5/1998". new Date("1998-05-14") would
 * read it as midnight UTC, which is the day before in time zones west of London.
 */
export const birthDateLabel = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString('en-IN') : '-';
};

/** The date `years` years before today, as "YYYY-MM-DD" for a date input's min or max. */
export const yearsAgo = (years, now = new Date()) => {
  const day = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const pad = (n) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
};

/** min and max for a date-of-birth input: aged 18 to 100, the same rule the server checks. */
export const birthDateBounds = (now = new Date()) => ({ min: yearsAgo(100, now), max: yearsAgo(18, now) });

export const firstName = (fullName) => (fullName || '').trim().split(/\s+/)[0] || '';

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
