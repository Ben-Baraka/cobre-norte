import { CATALOG } from "./catalog";
import { flcAmps, hash01, powerCable } from "./hash";
import type {
  AnalogSpec,
  AreaId,
  DiscreteSpec,
  Equip,
  IoType,
  Loop,
  Motor,
  MotorSpec,
  Point,
  Valve,
} from "./types";
import { AREA_BY_ID, AREAS, BUSES, PLCS } from "./types";

export interface Model {
  equips: Equip[];
  motors: Motor[];
  points: Point[];
  loops: Loop[];
  valves: Valve[];
  byTag: Map<string, Point>;
  motorByTag: Map<string, Motor>;
  equipByTag: Map<string, Equip>;
  loopById: Map<string, Loop>;
  loopByPv: Map<string, Loop>;
  loopByActuator: Map<string, Loop>;
  pointsByEquip: Map<string, Point[]>;
  trendTags: string[];
  areas: typeof AREAS;
  plcs: typeof PLCS;
  buses: typeof BUSES;
  motorInit: Map<string, MotorSpec>;
}

const CARD: Record<string, { name: string; channels: number }> = {
  AI: { name: "1756-IF8", channels: 8 },
  RTD: { name: "1756-IR6", channels: 6 },
  AO: { name: "1756-OF8", channels: 8 },
  DI: { name: "1756-IB32", channels: 32 },
  DO: { name: "1756-OB16E", channels: 16 },
};

function periodFor(tag: string, specified?: number): number {
  if (specified) return specified;
  return 40 + hash01(tag) * 90;
}

function blankPoint(partial: Omit<Point, "index" | "address" | "card" | "cable" | "plc"> & { plc?: string }): Point {
  const area = AREA_BY_ID[partial.area];
  return {
    ...partial,
    index: 0,
    plc: partial.plc ?? area.plc,
    address: "",
    card: "",
    cable: "",
  };
}

function fromAnalog(a: AnalogSpec): Point {
  const source = a.source ?? (a.io === "CALC" ? "Calculated" : a.io === "COMM" ? "Drive" : "Field");
  const span = Math.abs(a.max - a.min) || 1;
  return blankPoint({
    tag: a.tag,
    desc: a.desc,
    area: a.area,
    equip: a.equip,
    io: a.io,
    signal: a.signal,
    eu: a.eu,
    min: a.min,
    max: a.max,
    dec: a.dec,
    hh: a.hh,
    h: a.h,
    l: a.l,
    ll: a.ll,
    device: a.device,
    pid: a.pid,
    fail: a.fail,
    wander: a.wander ?? span * 0.004,
    period: periodFor(a.tag, a.period),
    base: a.pv,
    quality0: a.quality === "Bad" ? 1 : a.quality === "Uncertain" ? 3 : 0,
    trend: a.trend ?? (a.io === "AI" || a.io === "RTD" || a.io === "CALC"),
    source,
    feature: !!a.feature,
  });
}

function fromDiscrete(d: DiscreteSpec): Point {
  return blankPoint({
    tag: d.tag,
    desc: d.desc,
    area: d.area,
    equip: d.equip,
    io: d.io,
    signal: d.signal ?? "24 VDC",
    eu: "",
    min: 0,
    max: 1,
    dec: 0,
    device: d.device,
    pid: d.pid,
    fail: d.fail ?? (d.io === "DO" ? "De-energise" : "Open"),
    words: d.words,
    alarmWhen: d.alarmWhen,
    alarmCond: d.alarmCond,
    priority: d.priority,
    latched: d.latched,
    wander: 0,
    period: 60,
    base: d.initial,
    quality0: 0,
    trend: false,
    source: "Field",
    feature: false,
  });
}

function motorPoints(spec: MotorSpec, area: AreaId, equip: string, pid: string): Point[] {
  const out: Point[] = [];
  const running = (spec.initial ?? "running") === "running";
  const tripped = spec.initial === "tripped";
  const pri = spec.faultPriority ?? (spec.kw >= 75 ? 1 : 2);
  const variable = spec.start === "VFD" || spec.start === "LCI";
  const flc = flcAmps(spec.kw, spec.volts, spec.pf ?? 0.85, spec.eff ?? 0.93);
  const speed = spec.initial === "stopped" || spec.initial === "tripped" ? 0 : (spec.speed ?? 100);
  const frac = (spec.load ?? 0.75) * (variable ? speed / 100 : running ? 1 : 0);
  const amps = running ? flc * Math.max(frac, 0.05) : 0;
  const kw = running ? spec.kw * Math.max(frac, 0.05) : 0;

  const di = (
    tag: string,
    desc: string,
    words: [string, string],
    initial: 0 | 1,
    extra: Partial<Point> = {},
  ) =>
    blankPoint({
      tag,
      desc,
      area,
      equip,
      io: extra.io ?? "DI",
      signal: "24 VDC",
      eu: "",
      min: 0,
      max: 1,
      dec: 0,
      device: spec.kw >= 250 ? "Drive auxiliary" : "Contactor aux",
      pid,
      fail: "Open",
      words,
      wander: 0,
      period: 60,
      base: initial,
      quality0: 0,
      trend: false,
      source: "Field",
      feature: false,
      ...extra,
    });

  if (spec.start !== "Static") {
    out.push(
      di(`YS-${spec.tag}`, `${spec.name} running`, ["STOPPED", "RUNNING"], running ? 1 : 0),
      di(`XA-${spec.tag}`, `${spec.name} fault`, ["OK", "FAULT"], tripped ? 1 : 0, {
        alarmWhen: 1,
        alarmCond: "FAULT",
        priority: pri,
      }),
      di(`XL-${spec.tag}`, `${spec.name} local selected`, ["REMOTE", "LOCAL"], spec.local ? 1 : 0),
      di(`HS-${spec.tag}-ST`, `${spec.name} start command`, ["OFF", "ON"], 0, { io: "DO", fail: "De-energise" }),
      di(`HS-${spec.tag}-SP`, `${spec.name} stop command`, ["OFF", "ON"], 0, { io: "DO", fail: "De-energise" }),
    );
  } else {
    out.push(di(`YS-${spec.tag}`, `${spec.name} energised`, ["OFF", "ON"], 1));
  }

  out.push(
    blankPoint({
      tag: `II-${spec.tag}`,
      desc: `${spec.name} current`,
      area,
      equip,
      io: spec.kw >= 250 ? "COMM" : "AI",
      signal: spec.kw >= 250 ? "EtherNet/IP" : "4-20 mA",
      eu: "A",
      min: 0,
      max: Math.ceil(flc * (spec.start === "DOL" ? 8 : 1.6)),
      dec: spec.kw >= 200 ? 0 : 1,
      device: spec.kw >= 250 ? "Drive meter" : "Current transformer",
      pid,
      fail: "Fail low",
      wander: 0,
      period: 30,
      base: amps,
      quality0: 0,
      trend: spec.kw >= 200,
      source: spec.kw >= 250 ? "Drive" : "Field",
      feature: false,
    }),
  );

  if (spec.kw >= 132 && spec.start !== "Static") {
    out.push(
      blankPoint({
        tag: `EI-${spec.tag}`,
        desc: `${spec.name} power`,
        area,
        equip,
        io: "COMM",
        signal: "EtherNet/IP",
        eu: "kW",
        min: 0,
        max: Math.ceil(spec.kw * 1.15),
        dec: spec.kw >= 500 ? 0 : 1,
        device: "Drive power",
        pid,
        fail: "Last good",
        wander: 0,
        period: 30,
        base: kw,
        quality0: 0,
        trend: true,
        source: "Drive",
        feature: !!spec.featurePower,
      }),
    );
  }

  if (variable) {
    out.push(
      blankPoint({
        tag: `SI-${spec.tag}`,
        desc: `${spec.name} speed`,
        area,
        equip,
        io: "COMM",
        signal: "EtherNet/IP",
        eu: "%",
        min: 0,
        max: 110,
        dec: 1,
        device: "Drive speed",
        pid,
        fail: "Last good",
        wander: 0,
        period: 20,
        base: speed,
        quality0: 0,
        trend: spec.kw >= 400,
        source: "Drive",
        feature: false,
      }),
      blankPoint({
        tag: `SC-${spec.tag}`,
        desc: `${spec.name} speed reference`,
        area,
        equip,
        io: "AO",
        signal: "4-20 mA",
        eu: "%",
        min: 0,
        max: 100,
        dec: 1,
        device: "Speed reference",
        pid,
        fail: "Hold last",
        wander: 0,
        period: 20,
        base: spec.speed ?? 0,
        quality0: 0,
        trend: false,
        source: "Field",
        feature: false,
      }),
    );
  }

  if (spec.kw >= 1500) {
    out.push(
      blankPoint({
        tag: `TT-${spec.tag}`,
        desc: `${spec.name} winding temperature`,
        area,
        equip,
        io: "RTD",
        signal: "PT100",
        eu: "°C",
        min: 0,
        max: 180,
        dec: 1,
        h: 120,
        hh: 140,
        device: "Winding RTD",
        pid,
        fail: "Upscale",
        wander: running ? 0.6 : 0,
        period: 180,
        base: running ? 86 : 34,
        quality0: 0,
        trend: true,
        source: "Field",
        feature: false,
      }),
    );
  }
  return out;
}

function valvePoints(valveTag: string, name: string, area: AreaId, equip: string, pid: string, device: string, op: number): Point[] {
  const zt = `ZT-${valveTag}`;
  const zc = `ZC-${valveTag}`;
  return [
    blankPoint({
      tag: zt,
      desc: `${name} position`,
      area,
      equip,
      io: "AI",
      signal: "4-20 mA",
      eu: "%",
      min: 0,
      max: 100,
      dec: 1,
      device,
      pid,
      fail: "Fail last",
      wander: 0.3,
      period: 25,
      base: op,
      quality0: 0,
      trend: false,
      source: "Field",
      feature: false,
    }),
    blankPoint({
      tag: zc,
      desc: `${name} command`,
      area,
      equip,
      io: "AO",
      signal: "4-20 mA",
      eu: "%",
      min: 0,
      max: 100,
      dec: 1,
      device,
      pid,
      fail: "Hold last",
      wander: 0,
      period: 25,
      base: op,
      quality0: 0,
      trend: false,
      source: "Field",
      feature: false,
    }),
    blankPoint({
      tag: `ZSO-${valveTag}`,
      desc: `${name} open limit`,
      area,
      equip,
      io: "DI",
      signal: "24 VDC",
      eu: "",
      min: 0,
      max: 1,
      dec: 0,
      words: ["NOT OPEN", "OPEN"],
      device: "Limit switch",
      pid,
      fail: "Open",
      wander: 0,
      period: 60,
      base: op > 90 ? 1 : 0,
      quality0: 0,
      trend: false,
      source: "Field",
      feature: false,
    }),
    blankPoint({
      tag: `ZSC-${valveTag}`,
      desc: `${name} closed limit`,
      area,
      equip,
      io: "DI",
      signal: "24 VDC",
      eu: "",
      min: 0,
      max: 1,
      dec: 0,
      words: ["NOT CLOSED", "CLOSED"],
      device: "Limit switch",
      pid,
      fail: "Open",
      wander: 0,
      period: 60,
      base: op < 5 ? 1 : 0,
      quality0: 0,
      trend: false,
      source: "Field",
      feature: false,
    }),
  ];
}

function assignAddresses(points: Point[]) {
  const plcOrder = PLCS.map((p) => p.id);
  const typeOrder: IoType[] = ["AI", "RTD", "AO", "DI", "DO", "COMM", "CALC"];
  const buckets = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${p.plc}|${p.io}`;
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }
  for (const list of buckets.values()) list.sort((a, b) => a.tag.localeCompare(b.tag));

  for (const plc of plcOrder) {
    let rack = 0;
    let slot = 2;
    let eip = 1;
    const cableSeq = new Map<string, number>();
    const placeCard = (io: IoType) => {
      const card = CARD[io];
      const list = buckets.get(`${plc}|${io}`) ?? [];
      if (!card) {
        for (const p of list) {
          if (p.io === "CALC") {
            p.address = "SOFT";
            p.card = "Register";
          } else {
            p.address = `EIP:${eip++}`;
            p.card = "1756-EN2T";
          }
        }
        return;
      }
      let ch = 0;
      for (const p of list) {
        if (ch >= card.channels) {
          slot += 1;
          ch = 0;
          if (slot > 16) {
            rack += 1;
            slot = 2;
          }
        }
        p.address = `R${rack}:S${slot}:C${ch}`;
        p.card = card.name;
        ch += 1;
        if (p.source === "Field") {
          const n = (cableSeq.get(p.area) ?? 0) + 1;
          cableSeq.set(p.area, n);
          p.cable = `EC-${AREA_BY_ID[p.area].code}-${String(n).padStart(4, "0")}`;
        }
      }
      if (list.length) {
        slot += 1;
        if (slot > 16) {
          rack += 1;
          slot = 2;
        }
      }
    };
    for (const io of typeOrder) placeCard(io);
  }
}

export function buildModel(): Model {
  const points: Point[] = [];
  const motors: Motor[] = [];
  const equips: Equip[] = CATALOG.equips.map((e) => ({
    tag: e.tag,
    name: e.name,
    area: e.area,
    kind: e.kind,
    maker: e.maker,
    model: e.model,
    blurb: e.blurb,
    design: e.design,
    motors: e.motors.map((m) => m.tag),
    pids: e.pids,
  }));

  const seen = new Set<string>();
  const take = (p: Point) => {
    if (seen.has(p.tag)) throw new Error(`Duplicate tag ${p.tag}`);
    seen.add(p.tag);
    points.push(p);
  };

  for (const a of CATALOG.analogs) take(fromAnalog(a));
  for (const d of CATALOG.discretes) take(fromDiscrete(d));

  for (const equip of CATALOG.equips) {
    const pid = equip.pids[0] ?? "N/A";
    for (const spec of equip.motors) {
      if (seen.has(spec.tag) && spec.tag === equip.tag) {
        /* equipment and motor share a tag — allowed */
      }
      const pf = spec.pf ?? 0.85;
      const eff = spec.eff ?? 0.93;
      const flc = flcAmps(spec.kw, spec.volts, pf, eff);
      const motor: Motor = {
        index: motors.length,
        tag: spec.tag,
        name: spec.name,
        area: equip.area,
        equip: equip.tag,
        kw: spec.kw,
        volts: spec.volts,
        pf,
        eff,
        flc,
        start: spec.start,
        duty: spec.duty,
        mcc: spec.mcc,
        cell: spec.cell,
        feeder: spec.feeder,
        bus: spec.bus,
        cable: spec.start === "Static" ? "Busbar" : powerCable(spec.volts, flc),
        essential: !!spec.essential,
        pair: spec.pair,
        load: spec.load ?? 0.75,
        ratedRpm: spec.ratedRpm,
        faultPriority: spec.faultPriority ?? (spec.kw >= 75 ? 1 : 2),
        ys: `YS-${spec.tag}`,
        xa: spec.start === "Static" ? "" : `XA-${spec.tag}`,
        xl: spec.start === "Static" ? "" : `XL-${spec.tag}`,
        hsStart: spec.start === "Static" ? "" : `HS-${spec.tag}-ST`,
        hsStop: spec.start === "Static" ? "" : `HS-${spec.tag}-SP`,
        ii: `II-${spec.tag}`,
        ei: spec.kw >= 132 && spec.start !== "Static" ? `EI-${spec.tag}` : undefined,
        si: spec.start === "VFD" || spec.start === "LCI" ? `SI-${spec.tag}` : undefined,
        sc: spec.start === "VFD" || spec.start === "LCI" ? `SC-${spec.tag}` : undefined,
        tt: spec.kw >= 1500 ? `TT-${spec.tag}` : undefined,
        gh: `GH-${spec.tag}`,
      };
      motors.push(motor);
      for (const p of motorPoints(spec, equip.area, equip.tag, pid)) take(p);
    }
  }

  const valves: Valve[] = CATALOG.valves.map((v) => {
    const op = CATALOG.loops.find((l) => l.opTag === `ZC-${v.tag}`)?.op ?? 40;
    for (const p of valvePoints(v.tag, v.name, v.area, v.equip, v.pid, v.device, op)) take(p);
    return {
      tag: v.tag,
      name: v.name,
      area: v.area,
      equip: v.equip,
      fail: v.fail,
      pid: v.pid,
      device: v.device,
      zt: `ZT-${v.tag}`,
      zc: `ZC-${v.tag}`,
      zso: `ZSO-${v.tag}`,
      zsc: `ZSC-${v.tag}`,
    };
  });

  assignAddresses(points);
  points.forEach((p, i) => {
    p.index = i;
  });

  const loops: Loop[] = CATALOG.loops.map((l, index) => ({
    index,
    id: l.id,
    name: l.name,
    area: l.area,
    pv: l.pv,
    opTag: l.opTag,
    actuator: l.actuator,
    action: l.action,
    kp: l.kp,
    pvAt0: l.pvAt0,
    pvAt100: l.pvAt100,
    pvStopped: l.pvStopped,
    feature: !!l.feature,
  }));

  for (const l of loops) {
    if (!seen.has(l.pv)) throw new Error(`Loop ${l.id} PV ${l.pv} missing`);
    if (l.opTag && !seen.has(l.opTag)) throw new Error(`Loop ${l.id} output ${l.opTag} missing`);
    if (l.actuator && !motors.some((m) => m.tag === l.actuator)) {
      throw new Error(`Loop ${l.id} actuator ${l.actuator} missing`);
    }
  }

  const byTag = new Map(points.map((p) => [p.tag, p]));
  const motorByTag = new Map(motors.map((m) => [m.tag, m]));
  const equipByTag = new Map(equips.map((e) => [e.tag, e]));
  const loopById = new Map(loops.map((l) => [l.id, l]));
  const loopByPv = new Map(loops.map((l) => [l.pv, l]));
  const loopByActuator = new Map<string, Loop>();
  for (const l of loops) if (l.actuator) loopByActuator.set(l.actuator, l);
  const pointsByEquip = new Map<string, Point[]>();
  for (const p of points) {
    const list = pointsByEquip.get(p.equip) ?? [];
    list.push(p);
    pointsByEquip.set(p.equip, list);
  }

  const motorInit = new Map(CATALOG.equips.flatMap((e) => e.motors.map((m) => [m.tag, m] as const)));

  return {
    equips,
    motors,
    points,
    loops,
    valves,
    byTag,
    motorByTag,
    equipByTag,
    loopById,
    loopByPv,
    loopByActuator,
    pointsByEquip,
    trendTags: points.filter((p) => p.trend).map((p) => p.tag),
    areas: AREAS,
    plcs: PLCS,
    buses: BUSES,
    motorInit,
  };
}

export const MODEL: Model = buildModel();
