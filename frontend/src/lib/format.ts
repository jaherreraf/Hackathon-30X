export function formatMoney(value: number | null | undefined, currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "—";
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "EUR" ? "€" : "$";
  return `${sign}${symbol}${n} ${currency}`;
}

export function splitMoney(value: number): { int: string; cents: string } {
  const [int, cents] = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Math.abs(value))
    .split(".");
  return { int: (value < 0 ? "-" : "") + int, cents: cents ?? "00" };
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
