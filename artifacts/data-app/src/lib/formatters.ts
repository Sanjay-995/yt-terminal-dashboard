import { format } from "date-fns";

/**
 * Universal placeholder for data that is unknown / not available.
 * Shown when an API field is null or undefined — distinct from a real "0".
 */
export const NO_DATA = "—";

export type Nullable<T> = T | null | undefined;

export function isMissing(v: Nullable<number>): v is null | undefined {
  return v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
}

export function formatCurrency(value: Nullable<number>): string {
  if (isMissing(value)) return NO_DATA;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value as number);
}

export function formatPercent(value: Nullable<number>): string {
  if (isMissing(value)) return NO_DATA;
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((value as number) / 100);
}

export function formatCompact(value: Nullable<number>): string {
  if (isMissing(value)) return NO_DATA;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value as number);
}

/** Full thousands-separated number, e.g. 1,234,567. Returns NO_DATA on null. */
export function formatNumber(value: Nullable<number>): string {
  if (isMissing(value)) return NO_DATA;
  return (value as number).toLocaleString("en-US");
}

/**
 * Stable, deterministic accent color derived from a channel name.
 * Used as a fallback when the API returns a generic/red avatarColor for everyone.
 * Picks from a curated mission-control palette.
 */
const ACCENT_PALETTE = [
  "#0079F2", // blue
  "#795EFF", // purple
  "#22C55E", // green
  "#F59E0B", // amber
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#EF4444", // red
  "#A855F7", // violet
  "#14B8A6", // teal
  "#F97316", // orange
];

export function deriveAccent(seed: string, fallback?: string): string {
  // If the API gave us a non-default brand color, trust it.
  // The current backend hands every channel "#FF0000" — treat that (and empty)
  // as "no real color" and derive one from the name instead.
  if (fallback && fallback.toLowerCase() !== "#ff0000" && fallback !== "") {
    return fallback;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length] as string;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function formatDate(dateStr: string, fmt = "MMM d"): string {
  if (!dateStr) return "";
  // Check if it's YYYY-MM-DD
  if (dateStr.includes("-") && dateStr.length === 10) {
    return format(parseLocalDate(dateStr), fmt);
  }
  return format(new Date(dateStr), fmt);
}

export const CHART_COLORS = {
  blue: "#0079F2", // #00E5FF
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
};

export const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
];
