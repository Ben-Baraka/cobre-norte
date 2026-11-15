import type { Live, Motor } from "./types";
import { MODEL } from "./build";

export interface Check {
  label: string;
  ok: boolean;
}

function motor(live: Live, tag: string) {
  const spec = MODEL.motorByTag.get(tag);
  if (!spec) return undefined;
  return live.motors[spec.index];
}

function running(live: Live, tag: string): boolean {
  const m = motor(live, tag);
  return !!m && (m.state === "running" || m.state === "starting");
}

function value(live: Live, tag: string): number {
  const p = MODEL.byTag.get(tag);
  return p ? live.values[p.index] : NaN;
}

function estop(live: Live, tag: string): Check {
  return { label: `${tag} healthy`, ok: value(live, tag) < 0.5 };
}

export function startChecks(live: Live, tag: string): Check[] {
  const spec = MODEL.motorByTag.get(tag);
  const rt = spec ? live.motors[spec.index] : undefined;
  if (!spec || !rt) return [{ label: "Unknown drive", ok: false }];
  if (spec.start === "Static") return [{ label: "Static load is always energised", ok: false }];

  const checks: Check[] = [
    { label: "Drive in remote", ok: !rt.local },
    { label: "No active fault", ok: rt.state !== "tripped" },
  ];

  const areaEstop: Record<string, string> = {
    crush: "HS-100-ES",
    stock: "HS-200-ES",
    sag: "HS-300-ES",
    ball: "HS-400-ES",
    rough: "HS-500-ES",
    clean: "HS-600-ES",
    conc: "HS-700-ES",
    tails: "HS-800-ES",
    reag: "HS-900-ES",
    util: "HS-950-ES",
  };
  const es = areaEstop[spec.area];
  if (es) checks.push(estop(live, es));

  if (tag === "FE-101") {
    checks.push({ label: "CV-102 discharge conveyor running", ok: running(live, "CV-102") });
    checks.push({ label: "CR-101 crusher running", ok: running(live, "CR-101") });
    checks.push({ label: "Metal detector clear", ok: value(live, "XA-MD-101") < 0.5 });
    checks.push({ label: "ROM bin below high-high", ok: value(live, "LIT-101") < 92 });
  }
  if (tag === "CR-101") {
    checks.push({ label: "CV-102 discharge conveyor running", ok: running(live, "CV-102") });
    checks.push({
      label: "Crusher lube pump running",
      ok: running(live, "PU-111") || running(live, "PU-112"),
    });
    checks.push({ label: "Lube pressure above 160 kPa", ok: value(live, "PIT-111") > 160 });
  }
  if (tag === "CV-102") {
    checks.push({ label: "Pull-wire healthy", ok: value(live, "XA-CV-102-PC") < 0.5 });
    checks.push({ label: "Belt aligned", ok: value(live, "XA-CV-102-BA") < 0.5 });
  }
  if (tag === "FE-201A" || tag === "FE-201B" || tag === "FE-201C") {
    checks.push({ label: "CV-201 collection conveyor running", ok: running(live, "CV-201") });
    checks.push({ label: "Stockpile above low level", ok: value(live, "LIT-201") > 12 });
    checks.push({ label: "SAG-feed metal detector reset", ok: value(live, "XA-MD-201") < 0.5 });
  }
  if (tag === "CV-201") {
    checks.push({ label: "CV-202 SAG feed conveyor running", ok: running(live, "CV-202") });
  }
  if (tag === "ML-301A" || tag === "ML-301B") {
    const other = tag === "ML-301A" ? "ML-301B" : "ML-301A";
    const otherRt = motor(live, other);
    checks.push({ label: `${other} not tripped`, ok: otherRt?.state !== "tripped" });
    checks.push({ label: "Inching drive stopped", ok: !running(live, "ML-301I") });
    checks.push({
      label: "SAG lube pump running",
      ok: running(live, "PU-311A") || running(live, "PU-311B"),
    });
    checks.push({ label: "SAG lube pressure above 160 kPa", ok: value(live, "PIT-311") > 160 });
    checks.push({ label: "CV-202 feed conveyor running", ok: running(live, "CV-202") });
    checks.push({ label: "CV-331 pebble conveyor running", ok: running(live, "CV-331") });
    checks.push({ label: "Feed-end bearing below trip", ok: value(live, "TIT-311A") < 82 });
  }
  if (tag === "ML-301I") {
    checks.push({ label: "Both SAG pinions stopped", ok: !running(live, "ML-301A") && !running(live, "ML-301B") });
  }
  if (tag === "ML-401A" || tag === "ML-401B") {
    const other = tag === "ML-401A" ? "ML-401B" : "ML-401A";
    checks.push({ label: `${other} not tripped`, ok: motor(live, other)?.state !== "tripped" });
    checks.push({
      label: "Ball mill lube pump running",
      ok: running(live, "PU-411A") || running(live, "PU-411B"),
    });
    checks.push({ label: "Ball mill lube pressure above 160 kPa", ok: value(live, "PIT-411") > 160 });
  }
  if (tag === "PU-321A" || tag === "PU-321B") {
    checks.push({ label: "Sump not empty", ok: value(live, "LIT-301") > 8 });
  }
  if (tag === "PU-421A" || tag === "PU-421B") {
    checks.push({ label: "Sump not empty", ok: value(live, "LIT-401") > 8 });
  }
  return checks;
}

export interface RunTrip {
  motor: string;
  delay: number;
  reason: string;
  ok: (live: Live) => boolean;
}

export const RUN_TRIPS: RunTrip[] = [
  { motor: "FE-101", delay: 2, reason: "Discharge conveyor stopped", ok: (l) => running(l, "CV-102") },
  { motor: "CR-101", delay: 3, reason: "Discharge conveyor stopped", ok: (l) => running(l, "CV-102") },
  { motor: "FE-201A", delay: 2, reason: "Collection conveyor stopped", ok: (l) => running(l, "CV-201") },
  { motor: "FE-201B", delay: 2, reason: "Collection conveyor stopped", ok: (l) => running(l, "CV-201") },
  { motor: "FE-201C", delay: 2, reason: "Collection conveyor stopped", ok: (l) => running(l, "CV-201") },
  { motor: "CV-201", delay: 2, reason: "SAG feed conveyor stopped", ok: (l) => running(l, "CV-202") },
  { motor: "CV-102", delay: 0, reason: "Pull-wire trip", ok: (l) => value(l, "XA-CV-102-PC") < 0.5 },
  { motor: "ML-301A", delay: 3, reason: "Lube pressure lost", ok: (l) => value(l, "PIT-311") >= 140 },
  { motor: "ML-301B", delay: 3, reason: "Lube pressure lost", ok: (l) => value(l, "PIT-311") >= 140 },
  { motor: "ML-401A", delay: 3, reason: "Lube pressure lost", ok: (l) => value(l, "PIT-411") >= 140 },
  { motor: "ML-401B", delay: 3, reason: "Lube pressure lost", ok: (l) => value(l, "PIT-411") >= 140 },
];

export function isRunningState(live: Live, tag: string): boolean {
  return running(live, tag);
}

export function motorSpec(tag: string): Motor | undefined {
  return MODEL.motorByTag.get(tag);
}
