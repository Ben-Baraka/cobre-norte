import type { MotorState, Point } from "../model/types";

const TZ = "America/Chicago";

export function fmt(n: number, dec = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtTime(ms: number, withDate = false): string {
  const date = new Date(ms);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  if (!withDate) return `${time} CT`;
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${day} ${time} CT`;
}

export function motorWord(state: MotorState): string {
  if (state === "running") return "RUNNING";
  if (state === "starting") return "STARTING";
  if (state === "stopping") return "STOPPING";
  if (state === "tripped") return "TRIPPED";
  return "STOPPED";
}

export function limitOf(point: Point, value: number): "HH" | "LL" | "H" | "L" | null {
  if (point.hh != null && value >= point.hh) return "HH";
  if (point.ll != null && value <= point.ll) return "LL";
  if (point.h != null && value >= point.h) return "H";
  if (point.l != null && value <= point.l) return "L";
  return null;
}

export function csvEscape(rows: (string | number)[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([csvEscape(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
