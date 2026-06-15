import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number | null | undefined, maximumFractionDigits = 2) {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  const n = Number(value);
  if (Math.abs(n) < 0.01 && n !== 0) return `$${n.toPrecision(3)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(n) >= 100000 ? "compact" : "standard",
    maximumFractionDigits
  }).format(n);
}

export function formatCompact(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "N/A";
  return `${Number(value).toFixed(2)}%`;
}

export function formatAge(hours: number | null | undefined) {
  if (!Number.isFinite(hours ?? NaN)) return "N/A";
  const h = Number(hours);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}
