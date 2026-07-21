const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat("en-US");

export function formatCompact(n) {
  return compact.format(n);
}

export function formatExact(n) {
  return exact.format(n);
}

export function formatPercent(fraction, digits = 1) {
  return `${(fraction * 100).toFixed(digits)}%`;
}
