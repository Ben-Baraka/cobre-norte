import { CATALOG } from "./catalog";
import { MODEL } from "./build";
import { clamp, hash01 } from "./hash";
import { RUN_TRIPS, startChecks } from "./permissives";
import type { Alarm, EventRec, Kpis, Live, LoopLive, Mode, MotorLive, MotorState, Point } from "./types";
import { DESIGN_FEED, HIST_DT, HIST_N, STOCK_LIVE_T } from "./types";

export type Command =
  | { type: "start" | "stop" | "reset"; tag: string }
  | { type: "speed"; tag: string; value: number }
  | { type: "mode"; id: string; mode: Mode }
  | { type: "sp"; id: string; value: number }
  | { type: "op"; id: string; value: number }
  | { type: "ack"; id: string }
  | { type: "ackAll" }
  | { type: "silence" }
  | { type: "force"; tag: string; value: number }
  | { type: "unforce"; tag: string }
  | { type: "latchReset"; tag: string };

const CUSTOM_LOOPS = new Set(["FC-102", "FC-202", "LC-301", "LC-401", "DC-323", "DC-423", "PC-951"]);

function startMs(kind: string): number {
  if (kind === "LCI") return 6000;
  if (kind === "Soft Start") return 4000;
  if (kind === "VFD") return 3000;
  if (kind === "Diesel") return 8000;
  return 2000;
}

function stopMs(kw: number): number {
  return kw >= 500 ? 4500 : 1600;
}

function show(point: Point, value: number): string {
  if (point.words) return point.words[value >= 0.5 ? 1 : 0];
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: point.dec,
    maximumFractionDigits: point.dec,
  });
  return point.eu ? `${n} ${point.eu}` : n;
}

function balance(feed: number, head: number, rec: number, concGrade: number) {
  const cuIn = (feed * head) / 100;
  const cuOut = (cuIn * rec) / 100;
  const conc = concGrade > 1 ? cuOut / (concGrade / 100) : 0;
  const tails = Math.max(feed - conc, 0);
  const tg = tails > 1 ? ((cuIn - cuOut) / tails) * 100 : 0;
  return { cuIn, cuOut, conc, tails, tg };
}

export function createLive(): Live {
  const now = Date.now();
  const motors: MotorLive[] = MODEL.motors.map((spec) => {
    const init = MODEL.motorInit.get(spec.tag);
    const state: MotorState = init?.initial ?? "running";
    const variable = spec.start === "VFD" || spec.start === "LCI";
    const speed = state === "running" ? (init?.speed ?? (variable ? 90 : 100)) : 0;
    const kw = state === "running" ? spec.kw * spec.load * (variable ? speed / 100 : 1) : 0;
    return {
      state,
      speedSp: state === "stopped" || state === "tripped" ? (init?.speed && init.speed > 1 ? init.speed : variable ? 70 : 100) : speed,
      speed,
      amps: state === "running" ? spec.flc * (kw / spec.kw) : 0,
      kw,
      hours: Math.round(6000 + hash01(spec.tag) * 28000),
      starts: 1 + Math.floor(hash01(spec.tag + "s") * 4),
      local: !!init?.local,
      tripReason: init?.tripReason ?? "",
      since: now,
    };
  });
  for (const m of motors) {
    if (m.state === "stopped" && MODEL.motors[motors.indexOf(m)].start !== "Static") {
      /* keep speedSp so a start has a target; standby with speed 0 gets 70 on start */
    }
  }
  const loops: LoopLive[] = CATALOG.loops.map((l) => ({ mode: l.mode, sp: l.sp, op: l.op }));
  const values = Float32Array.from(MODEL.points.map((p) => p.base));
  const quality = Uint8Array.from(MODEL.points.map((p) => p.quality0));
  const forced = new Uint8Array(MODEL.points.length);
  const hist: Record<string, Float32Array> = {};
  for (const tag of MODEL.trendTags) {
    const point = MODEL.byTag.get(tag)!;
    const buf = new Float32Array(HIST_N);
    for (let i = 0; i < HIST_N; i++) {
      const t = now - (HIST_N - 1 - i) * HIST_DT;
      buf[i] = wave(point, t, now);
    }
    hist[tag] = buf;
  }
  const live: Live = {
    tick: 0,
    now,
    epoch: now,
    values,
    quality,
    forced,
    motors,
    loops,
    alarms: [],
    horn: false,
    silenced: false,
    events: [],
    kpis: emptyKpis(),
    stockTons: STOCK_LIVE_T * 0.62,
    hist,
    histHead: 0,
    histLast: now,
    tripTimer: {},
    lubeWait: {},
  };
  const settled = apply(live, [], 0);
  backdate(settled);
  settled.events = [
    {
      time: now - 18 * 60000,
      text: "TIT-311A SAG feed-end bearing high",
      area: "sag",
    },
    {
      time: now - 6 * 60000,
      text: "DC-101 dust collector tripped — overload (49)",
      area: "crush",
    },
    {
      time: now - 42 * 60000,
      text: "XA-MD-201 metal detect latched on CV-202",
      area: "stock",
    },
  ];
  return settled;
}

function emptyKpis(): Kpis {
  return {
    feed: DESIGN_FEED,
    sagFeed: DESIGN_FEED,
    head: 0.62,
    rec: 89,
    concGrade: 27.4,
    tailsGrade: 0.07,
    concTph: 35,
    tailsTph: 1715,
    cuTph: 9.6,
    cuIn: 10.8,
    p80: 155,
    grindKw: 22000,
    plantKw: 30000,
    sec: 12.9,
    water: 980,
    stockPct: 62,
    stockTons: STOCK_LIVE_T * 0.62,
    stockDelta: 0,
    shiftTons: DESIGN_FEED * 6.25,
    shiftCu: 9.6 * 6.25,
  };
}

function wave(point: Point, t: number, epoch: number): number {
  if (!point.wander) return point.base;
  const periodMs = point.period * 1000;
  const w = Math.sin(((t - epoch) / periodMs) * Math.PI * 2) * point.wander;
  return clamp(point.base + w, point.min, point.max);
}

function backdate(live: Live) {
  const table: Record<string, { age: number; state: Alarm["state"] }> = {
    "XA-DC-101|FAULT": { age: 6 * 60000, state: "UNACK" },
    "TIT-311A|H": { age: 18 * 60000, state: "UNACK" },
    "XA-MD-201|METAL": { age: 42 * 60000, state: "ACK" },
    "AIT-510-FE|COMM": { age: 2 * 60000, state: "UNACK" },
  };
  for (const alarm of live.alarms) {
    const hit = table[alarm.id];
    if (!hit) continue;
    alarm.time = live.now - hit.age;
    alarm.state = hit.state;
  }
  live.alarms.push({
    id: `LIT-520|L@${live.now - 70 * 60000}`,
    tag: "LIT-520",
    cond: "L",
    priority: 2,
    time: live.now - 80 * 60000,
    rtnTime: live.now - 70 * 60000,
    text: "Conditioner level low",
    state: "CLEAR",
    value: "41 %",
    area: "rough",
  });
  live.horn = live.alarms.some((a) => a.state === "UNACK" && a.priority <= 2);
}

export function apply(live: Live, commands: Command[], dt: number): Live {
  const now = dt === 0 ? live.now : live.now + dt * 1000;
  const motors = live.motors.map((m) => ({ ...m }));
  const loops = live.loops.map((l) => ({ ...l }));
  let alarms = live.alarms.map((a) => ({ ...a }));
  let events = live.events;
  let horn = live.horn;
  let silenced = live.silenced;
  let reject = live.reject;
  let stockTons = live.stockTons;
  const tripTimer = { ...live.tripTimer };
  const lubeWait = { ...live.lubeWait };
  const written = new Set<number>();

  const pushEvent = (text: string, area?: EventRec["area"]) => {
    events = [{ time: now, text, area }, ...events].slice(0, 220);
  };

  const write = (tag: string, value: number) => {
    const point = MODEL.byTag.get(tag);
    if (!point || live.forced[point.index]) return;
    live.values[point.index] = value;
    written.add(point.index);
  };
  const read = (tag: string): number => {
    const point = MODEL.byTag.get(tag);
    return point ? live.values[point.index] : NaN;
  };

  for (let i = 0; i < MODEL.points.length; i++) {
    if (!live.forced[i]) live.quality[i] = MODEL.points[i].quality0;
  }

  const failStart = (tag: string): string | null => {
    const bad = startChecks({ ...live, motors, values: live.values }, tag).find((c) => !c.ok);
    return bad ? bad.label : null;
  };

  const actuallyStart = (tag: string) => {
    const spec = MODEL.motorByTag.get(tag);
    if (!spec) return;
    const m = motors[spec.index];
    if (m.state === "running" || m.state === "starting") return;
    m.state = "starting";
    m.since = now;
    m.tripReason = "";
    if ((spec.start === "VFD" || spec.start === "LCI") && m.speedSp < 5) m.speedSp = 70;
    pushEvent(`${tag} start command`, spec.area);
  };

  const actuallyStop = (tag: string) => {
    const spec = MODEL.motorByTag.get(tag);
    if (!spec || spec.start === "Static") return;
    const m = motors[spec.index];
    if (m.state === "stopped" || m.state === "stopping" || m.state === "tripped") return;
    m.state = "stopping";
    m.since = now;
    pushEvent(`${tag} stop command`, spec.area);
  };

  const trip = (tag: string, reason: string) => {
    const spec = MODEL.motorByTag.get(tag);
    if (!spec) return;
    const m = motors[spec.index];
    if (m.state === "tripped" || m.state === "stopped") return;
    m.state = "tripped";
    m.tripReason = reason;
    m.since = now;
    m.speed = 0;
    pushEvent(`${tag} tripped — ${reason}`, spec.area);
  };

  for (const cmd of commands) {
    if (cmd.type === "start") {
      const spec = MODEL.motorByTag.get(cmd.tag);
      if (!spec) continue;
      if (spec.start === "Static") {
        reject = { tag: cmd.tag, text: "Static load cannot be started", time: now };
        continue;
      }
      const reason = failStart(cmd.tag);
      if (reason) {
        reject = { tag: cmd.tag, text: reason, time: now };
        pushEvent(`${cmd.tag} start refused — ${reason}`, spec.area);
        continue;
      }
      if (spec.pair) {
        const pairReason = failStart(spec.pair);
        if (pairReason) {
          reject = { tag: cmd.tag, text: `${spec.pair}: ${pairReason}`, time: now };
          pushEvent(`${cmd.tag} start refused — ${spec.pair}: ${pairReason}`, spec.area);
          continue;
        }
      }
      actuallyStart(cmd.tag);
      if (spec.pair) actuallyStart(spec.pair);
      reject = undefined;
    } else if (cmd.type === "stop") {
      const spec = MODEL.motorByTag.get(cmd.tag);
      if (!spec || spec.start === "Static") {
        reject = { tag: cmd.tag, text: "This load cannot be stopped from the HMI", time: now };
        continue;
      }
      const rt = motors[spec.index];
      if (rt.local) {
        reject = { tag: cmd.tag, text: "Drive is in local", time: now };
        continue;
      }
      actuallyStop(cmd.tag);
      if (spec.pair) actuallyStop(spec.pair);
      reject = undefined;
    } else if (cmd.type === "reset") {
      const spec = MODEL.motorByTag.get(cmd.tag);
      if (!spec) continue;
      const m = motors[spec.index];
      if (m.state !== "tripped") continue;
      m.state = "stopped";
      m.tripReason = "";
      m.speed = 0;
      m.since = now;
      pushEvent(`${cmd.tag} fault reset`, spec.area);
      reject = undefined;
    } else if (cmd.type === "speed") {
      const spec = MODEL.motorByTag.get(cmd.tag);
      if (!spec) continue;
      const m = motors[spec.index];
      m.speedSp = clamp(cmd.value, 0, 100);
      const loop = MODEL.loopByActuator.get(cmd.tag);
      if (loop) {
        loops[loop.index].mode = "MAN";
        loops[loop.index].op = m.speedSp;
      }
      pushEvent(`${cmd.tag} speed reference ${m.speedSp.toFixed(0)}%`, spec.area);
    } else if (cmd.type === "mode") {
      const loop = MODEL.loopById.get(cmd.id);
      if (!loop) continue;
      loops[loop.index].mode = cmd.mode;
      pushEvent(`${loop.id} ${cmd.mode}`, loop.area);
    } else if (cmd.type === "sp") {
      const loop = MODEL.loopById.get(cmd.id);
      if (!loop) continue;
      const point = MODEL.byTag.get(loop.pv)!;
      loops[loop.index].sp = clamp(cmd.value, point.min, point.max);
      pushEvent(`${loop.id} setpoint ${loops[loop.index].sp}`, loop.area);
    } else if (cmd.type === "op") {
      const loop = MODEL.loopById.get(cmd.id);
      if (!loop) continue;
      loops[loop.index].mode = "MAN";
      loops[loop.index].op = clamp(cmd.value, 0, 100);
      if (loop.actuator) motors[MODEL.motorByTag.get(loop.actuator)!.index].speedSp = loops[loop.index].op;
      pushEvent(`${loop.id} output ${loops[loop.index].op.toFixed(0)}%`, loop.area);
    } else if (cmd.type === "ack") {
      alarms = alarms.map((a) => {
        if (a.id !== cmd.id) return a;
        if (a.state === "UNACK") return { ...a, state: "ACK" };
        if (a.state === "RTN") return { ...a, state: "CLEAR", id: `${a.id}@${now}`, rtnTime: a.rtnTime ?? now };
        return a;
      });
    } else if (cmd.type === "ackAll") {
      alarms = alarms.map((a) => {
        if (a.state === "UNACK") return { ...a, state: "ACK" as const };
        if (a.state === "RTN") return { ...a, state: "CLEAR" as const, id: `${a.id}@${now}`, rtnTime: a.rtnTime ?? now };
        return a;
      });
      pushEvent("All active alarms acknowledged");
    } else if (cmd.type === "silence") {
      silenced = true;
      horn = false;
    } else if (cmd.type === "force") {
      const point = MODEL.byTag.get(cmd.tag);
      if (!point) continue;
      live.forced[point.index] = 1;
      live.values[point.index] = cmd.value;
      live.quality[point.index] = 2;
      pushEvent(`${cmd.tag} forced to ${cmd.value}`, point.area);
    } else if (cmd.type === "unforce") {
      const point = MODEL.byTag.get(cmd.tag);
      if (!point) continue;
      live.forced[point.index] = 0;
      live.quality[point.index] = point.quality0;
      pushEvent(`${cmd.tag} force removed`, point.area);
    } else if (cmd.type === "latchReset") {
      const point = MODEL.byTag.get(cmd.tag);
      if (!point || live.forced[point.index]) continue;
      live.values[point.index] = 0;
      written.add(point.index);
      pushEvent(`${cmd.tag} latch reset`, point.area);
    }
  }

  for (const spec of MODEL.motors) {
    const m = motors[spec.index];
    if (spec.start === "Static") {
      m.state = "running";
      m.speed = 100;
      m.speedSp = 100;
      continue;
    }
    if (m.state === "starting" && now - m.since >= startMs(spec.start)) {
      m.state = "running";
      m.starts += 1;
      pushEvent(`${spec.tag} running`, spec.area);
    } else if (m.state === "stopping" && now - m.since >= stopMs(spec.kw)) {
      m.state = "stopped";
      m.speed = 0;
      pushEvent(`${spec.tag} stopped`, spec.area);
    }
    if (m.state === "starting") {
      const ramp = clamp((now - m.since) / startMs(spec.start), 0, 1);
      m.speed = m.speedSp * ramp;
    } else if (m.state === "stopping") {
      const ramp = clamp((now - m.since) / stopMs(spec.kw), 0, 1);
      m.speed = m.speed * (1 - ramp);
    } else if (m.state === "running") {
      m.speed += (m.speedSp - m.speed) * (dt === 0 ? 1 : 0.5);
      m.hours += dt / 3600;
    } else {
      m.speed = 0;
    }
  }

  if (dt > 0) {
    for (const [duty, standby] of [
      ["PU-311A", "PU-311B"],
      ["PU-411A", "PU-411B"],
      ["PU-111", "PU-112"],
    ] as const) {
      const a = motors[MODEL.motorByTag.get(duty)!.index];
      const b = motors[MODEL.motorByTag.get(standby)!.index];
      const aUp = a.state === "running" || a.state === "starting";
      const bUp = b.state === "running" || b.state === "starting";
      if (!aUp && !bUp && b.state === "stopped" && !b.local) {
        lubeWait[duty] = (lubeWait[duty] ?? 0) + dt;
        if (lubeWait[duty] >= 1) {
          const reason = failStart(standby);
          if (!reason) {
            actuallyStart(standby);
            pushEvent(`${standby} auto-start — ${duty} is down`, MODEL.motorByTag.get(duty)!.area);
          }
          lubeWait[duty] = 0;
        }
      } else lubeWait[duty] = 0;
    }
  }

  const spd = (tag: string) => {
    const spec = MODEL.motorByTag.get(tag)!;
    const m = motors[spec.index];
    return m.state === "running" || m.state === "starting" ? m.speed / 100 : 0;
  };
  const up = (tag: string) => spd(tag) > 0.02 || motors[MODEL.motorByTag.get(tag)!.index].state === "running";

  const tune = (id: string, pv: number) => {
    const loop = MODEL.loopById.get(id)!;
    const rt = loops[loop.index];
    if (rt.mode === "AUTO") {
      const err = loop.action === "direct" ? pv - rt.sp : rt.sp - pv;
      rt.op = clamp(rt.op + err * loop.kp * (dt === 0 ? 0 : dt), 0, 100);
    }
    return rt;
  };

  let feed = read("WIT-102");
  const fc = tune("FC-102", feed);
  if (MODEL.motorByTag.get("FE-101")) {
    const feeder = motors[MODEL.motorByTag.get("FE-101")!.index];
    if (fc.mode === "AUTO" && feeder.state === "running") feeder.speedSp = fc.op;
    else if (fc.mode !== "AUTO") fc.op = feeder.speedSp;
  }
  const feedTarget = spd("FE-101") * 1900;
  feed = dt === 0 ? feedTarget : feed + (feedTarget - feed) * Math.min(1, 0.4 * dt);

  let sag = spd("FE-201A") * 1080 + spd("FE-201B") * 1080 + spd("FE-201C") * 1080;
  const fc202 = tune("FC-202", sag);
  const feederA = motors[MODEL.motorByTag.get("FE-201A")!.index];
  if (fc202.mode === "AUTO" && feederA.state === "running") feederA.speedSp = fc202.op;
  else if (fc202.mode !== "AUTO") fc202.op = feederA.speedSp;
  if (dt !== 0 && fc202.mode === "AUTO") {
    sag = feederA.speedSp / 100 * 1080 + spd("FE-201B") * 1080 + spd("FE-201C") * 1080;
  }
  const sagTarget = sag;
  let sagFeed = read("WIT-202");
  sagFeed = dt === 0 ? sagTarget : sagFeed + (sagTarget - sagFeed) * Math.min(1, 0.35 * dt);

  if (dt > 0) stockTons = clamp(stockTons + ((feed - sagFeed) / 3600) * dt, 400, STOCK_LIVE_T);
  const stockPct = (stockTons / STOCK_LIVE_T) * 100;

  const sagOn = up("ML-301A") && up("ML-301B");
  const ballOn = up("ML-401A") && up("ML-401B");
  const f = clamp(sagFeed / DESIGN_FEED, 0, 1.35);

  const sump = (id: string, tag: string, pumpA: string, pumpB: string, inflow: number, gain: number) => {
    const pv = read(tag);
    const rt = tune(id, pv);
    const a = motors[MODEL.motorByTag.get(pumpA)!.index];
    const b = motors[MODEL.motorByTag.get(pumpB)!.index];
    const lead = a.state === "running" || a.state === "starting" ? a : b.state === "running" || b.state === "starting" ? b : undefined;
    if (lead && rt.mode === "AUTO") lead.speedSp = rt.op;
    else if (lead && rt.mode !== "AUTO") rt.op = lead.speedSp;
    const out = (spd(pumpA) + spd(pumpB)) * gain;
    const next = dt === 0 ? pv : clamp(pv + (inflow - out) * dt, 0, 100);
    write(tag, next);
    return next;
  };

  const lit301 = sump("LC-301", "LIT-301", "PU-321A", "PU-321B", sagOn ? 0.5 * f : 0.04, 0.72);
  const lit401 = sump("LC-401", "LIT-401", "PU-421A", "PU-421B", ballOn && sagOn ? 0.46 * f : 0.04, 0.64);

  for (const spec of MODEL.motors) {
    const m = motors[spec.index];
    if (m.state === "running") m.speed += (m.speedSp - m.speed) * (dt === 0 ? 1 : 0.65);
  }

  const lube = (tag: string, a: string, b: string) => {
    const n = (up(a) ? 1 : 0) + (up(b) ? 1 : 0);
    const target = n === 0 ? 45 : 250;
    const pv = read(tag);
    write(tag, dt === 0 ? target : pv + (target - pv) * Math.min(1, 0.28 * dt));
  };
  lube("PIT-311", "PU-311A", "PU-311B");
  lube("PIT-411", "PU-411A", "PU-411B");
  lube("PIT-111", "PU-111", "PU-112");

  if (dt > 0) {
    for (const rule of RUN_TRIPS) {
      const spec = MODEL.motorByTag.get(rule.motor)!;
      const m = motors[spec.index];
      const active = m.state === "running" || m.state === "starting";
      const healthy = rule.ok({ ...live, motors, now, values: live.values });
      if (active && !healthy) {
        tripTimer[rule.motor] = (tripTimer[rule.motor] ?? 0) + dt;
        if (tripTimer[rule.motor] >= rule.delay) {
          trip(rule.motor, rule.reason);
          if (rule.motor === "ML-301A") trip("ML-301B", rule.reason);
          if (rule.motor === "ML-301B") trip("ML-301A", rule.reason);
          if (rule.motor === "ML-401A") trip("ML-401B", rule.reason);
          if (rule.motor === "ML-401B") trip("ML-401A", rule.reason);
          tripTimer[rule.motor] = 0;
        }
      } else tripTimer[rule.motor] = 0;
    }
  }

  const waterRt = tune("PC-951", read("PIT-951"));
  const waterPump = motors[MODEL.motorByTag.get("PU-951A")!.index];
  if (waterRt.mode === "AUTO" && waterPump.state === "running") waterPump.speedSp = waterRt.op;
  else if (waterRt.mode !== "AUTO") waterRt.op = waterPump.speedSp;
  const waterSpd = spd("PU-951A") + spd("PU-951B") + spd("PU-951C");
  const waterTarget = 90 + Math.min(waterSpd, 1.4) * 650;
  const pit951 = read("PIT-951");
  write("PIT-951", dt === 0 ? waterTarget : pit951 + (waterTarget - pit951) * Math.min(1, 0.18 * dt));
  write("FIT-951", waterSpd * 980);

  const glandUp = up("PU-961A") || up("PU-961B");
  const pit961 = read("PIT-961");
  write("PIT-961", dt === 0 ? (glandUp ? 810 : 120) : pit961 + ((glandUp ? 810 : 120) - pit961) * Math.min(1, 0.2 * dt));
  const airUp = up("CA-971A") || up("CA-971B");
  const pit971 = read("PIT-971");
  write("PIT-971", dt === 0 ? (airUp ? 720 : 200) : pit971 + ((airUp ? 720 : 200) - pit971) * Math.min(1, 0.12 * dt));

  for (const valve of MODEL.valves) {
    const cmd = read(valve.zc);
    const pos = read(valve.zt);
    const next = dt === 0 ? cmd : pos + clamp(cmd - pos, -14 * dt, 14 * dt);
    write(valve.zt, clamp(next, 0, 100));
    write(valve.zso, next > 90 ? 1 : 0);
    write(valve.zsc, next < 5 ? 1 : 0);
  }

  const setLoopOutput = (id: string) => {
    const loop = MODEL.loopById.get(id)!;
    const rt = loops[loop.index];
    if (loop.opTag) write(loop.opTag, rt.op);
    return rt;
  };
  for (const id of CUSTOM_LOOPS) setLoopOutput(id);

  const dens = (id: string, tag: string, valveZt: string, openIsLower: boolean) => {
    const pv = read(tag);
    const rt = tune(id, pv);
    setLoopOutput(id);
    const pos = read(valveZt);
    const target = openIsLower ? 80 - 0.18 * pos : 40 + 0.35 * pos;
    write(tag, dt === 0 ? pv : pv + (target - pv) * Math.min(1, 0.25 * dt));
    return rt;
  };
  dens("DC-323", "DIT-323", "ZT-FV-301", true);
  dens("DC-423", "DIT-423", "ZT-FV-401", true);

  write("FIT-301", (read("ZT-FV-301") / 100) * 420);
  write("FIT-321", (spd("PU-321A") + spd("PU-321B")) * 3400);
  write("PIT-322", Math.pow(spd("PU-321A") + spd("PU-321B"), 1.4) * 145);
  write("FIT-421", (spd("PU-421A") + spd("PU-421B")) * 2900);
  write("PIT-422", Math.pow(spd("PU-421A") + spd("PU-421B"), 1.4) * 155);
  write("WIT-331", up("CR-341") ? sagFeed * 0.1 : 0);
  write("FIT-520", spd("PU-501") * 1950);
  write("FIT-801", (spd("PU-801A") + spd("PU-801B") + spd("PU-801C")) * 1180);
  write("PIT-802", (spd("PU-801A") + spd("PU-801B") + spd("PU-801C")) * 680);
  write("LIT-201", stockPct);
  write("LIT-202", clamp(stockPct - 1.6, 0, 100));
  write("LIT-203", clamp(stockPct + 1.4, 0, 100));
  write("WIT-102", feed);
  write("WIT-202", sagFeed);

  const tSec = (now - live.epoch) / 1000;
  const head = clamp(0.62 + Math.sin(tSec / 95) * 0.028 + Math.sin(tSec / 260) * 0.012, 0.48, 0.82);
  const p80 = clamp(154 + (sagFeed - DESIGN_FEED) * 0.02 + (read("PIT-322") - 95) * -0.18 + Math.sin(tSec / 70) * 3.5, 120, 230);
  const rec = clamp(90.2 - (p80 - 150) * 0.038 - (head - 0.62) * 1.6 + Math.sin(tSec / 110) * 0.12, 84, 93);
  const concGrade = clamp(27.6 - (rec - 89) * 0.09 + Math.sin(tSec / 85) * 0.22, 24, 31);
  const bal = balance(feed, head, rec, concGrade);
  write("AIT-510-CU", head);
  write("AIT-511-CU", clamp(8.2 + head * 6, 4, 16));
  write("AIT-512-CU", clamp(head * 0.18, 0.04, 0.3));
  write("AIT-401-P80", p80);
  write("AIT-710", concGrade);
  write("AIT-801-CU", bal.tg);
  write("CALC-REC", rec);
  write("CALC-CU", bal.cuOut);
  write("CALC-CONC", bal.conc);
  write("CALC-TAILS", bal.tails);

  for (const loop of MODEL.loops) {
    if (CUSTOM_LOOPS.has(loop.id)) continue;
    const rt = loops[loop.index];
    const pv0 = read(loop.pv);
    const actuatorUp = !loop.actuator || up(loop.actuator);
    if (rt.mode === "AUTO" && actuatorUp && dt > 0) {
      const err = loop.action === "direct" ? pv0 - rt.sp : rt.sp - pv0;
      rt.op = clamp(rt.op + err * loop.kp * dt, 0, 100);
    }
    if (loop.actuator && actuatorUp && rt.mode === "AUTO") {
      motors[MODEL.motorByTag.get(loop.actuator)!.index].speedSp = rt.op;
    }
    if (loop.opTag) write(loop.opTag, rt.op);
    let target = loop.pvAt0 + (rt.op / 100) * (loop.pvAt100 - loop.pvAt0);
    if (!actuatorUp && loop.pvStopped != null) target = loop.pvStopped;
    const next = dt === 0 ? pv0 : pv0 + (target - pv0) * Math.min(1, 0.18 * dt);
    const point = MODEL.byTag.get(loop.pv)!;
    write(loop.pv, clamp(next, point.min, point.max));
  }

  for (const point of MODEL.points) {
    if (written.has(point.index) || live.forced[point.index]) continue;
    if (point.io === "DI" || point.io === "DO" || point.wander === 0) continue;
    live.values[point.index] = wave(point, now, live.epoch);
  }

  let grindKw = 0;
  let plantKw = 0;
  for (const spec of MODEL.motors) {
    const m = motors[spec.index];
    let frac = spec.load;
    if (spec.tag === "ML-301A" || spec.tag === "ML-301B") frac = sagOn ? 0.5 + 0.42 * f : 0.22;
    else if (spec.tag === "ML-401A" || spec.tag === "ML-401B") frac = ballOn ? 0.5 + 0.38 * f : 0.2;
    else if (spec.tag === "CR-101") frac = 0.3 + 0.48 * clamp(feed / DESIGN_FEED, 0, 1.2);
    else if (spec.tag.startsWith("CV-102")) frac = spec.load * (feed > 200 ? 1 : 0.2);
    else if (spec.tag === "CV-201" || spec.tag === "CV-202") frac = spec.load * (sagFeed > 200 ? 1 : 0.2);
    const running = m.state === "running" || m.state === "starting";
    let kw = 0;
    let amps = 0;
    if (spec.start === "Diesel") {
      kw = m.state === "running" ? 180 : 0;
      amps = kw > 0 ? spec.flc * (kw / spec.kw) : 0;
    } else if (spec.start === "Static") {
      kw = spec.kw * spec.load;
      amps = spec.flc * spec.load;
    } else if (m.state === "starting") {
      const ramp = clamp((now - m.since) / startMs(spec.start), 0, 1);
      const inrush = spec.start === "DOL" ? 6.2 : spec.start === "Soft Start" ? 3.1 : 1.15;
      amps = spec.flc * inrush * (0.45 + 0.55 * ramp);
      kw = spec.kw * frac * ramp * 0.35;
    } else if (running) {
      const variable = spec.start === "VFD" || spec.start === "LCI";
      const pump = spec.tag.startsWith("PU-") || spec.tag.startsWith("BL-");
      if (pump && variable) kw = spec.kw * spec.load * Math.pow(Math.max(m.speed, 0) / 100, 2.15);
      else if (variable) kw = spec.kw * frac * (m.speed / 100);
      else kw = spec.kw * frac;
      amps = spec.flc * (kw / Math.max(spec.kw, 1));
    }
    m.kw = kw;
    m.amps = amps;
    if (spec.start !== "Diesel") plantKw += kw;
    if (spec.tag.startsWith("ML-301") || spec.tag.startsWith("ML-401") || spec.tag === "ML-601" || spec.tag === "CR-341") {
      grindKw += kw;
    }
    write(spec.ys, running || spec.start === "Static" ? 1 : 0);
    if (spec.xa) write(spec.xa, m.state === "tripped" ? 1 : 0);
    if (spec.hsStart) write(spec.hsStart, m.state === "starting" ? 1 : 0);
    if (spec.hsStop) write(spec.hsStop, m.state === "stopping" ? 1 : 0);
    write(spec.ii, amps);
    if (spec.ei) write(spec.ei, kw);
    if (spec.si) write(spec.si, m.speed);
    if (spec.sc) write(spec.sc, m.speedSp);
    if (spec.tt) {
      const target = running ? 78 + frac * 18 : 32;
      const cur = read(spec.tt);
      write(spec.tt, dt === 0 ? target : cur + (target - cur) * 0.05);
    }
  }

  write("LSH-101", read("LIT-101") > 90 ? 1 : 0);
  write("LSL-101", read("LIT-101") < 12 ? 1 : 0);
  write("CALC-GRIND", grindKw / 1000);
  const sec = feed > 80 ? grindKw / feed : 0;
  write("CALC-SE", sec);
  write("WIT-703", read("WIT-703") + (dt > 0 ? (bal.conc / 3600) * dt : 0));

  const raised = evaluate(alarms, now, live.values, live.quality, live.forced, (pri) => {
    if (pri <= 2) {
      horn = true;
      silenced = false;
    }
  });
  alarms = raised;

  let histHead = live.histHead;
  let histLast = live.histLast;
  if (dt > 0 && now - histLast >= HIST_DT) {
    for (const tag of MODEL.trendTags) {
      const point = MODEL.byTag.get(tag)!;
      live.hist[tag][histHead] = live.values[point.index];
    }
    histHead = (histHead + 1) % HIST_N;
    histLast = now;
  }

  const kpis: Kpis = {
    feed,
    sagFeed,
    head,
    rec,
    concGrade,
    tailsGrade: bal.tg,
    concTph: bal.conc,
    tailsTph: bal.tails,
    cuTph: bal.cuOut,
    cuIn: bal.cuIn,
    p80,
    grindKw,
    plantKw,
    sec,
    water: read("FIT-951"),
    stockPct,
    stockTons,
    stockDelta: feed - sagFeed,
    shiftTons: live.kpis.shiftTons + (dt > 0 ? (feed / 3600) * dt : 0),
    shiftCu: live.kpis.shiftCu + (dt > 0 ? (bal.cuOut / 3600) * dt : 0),
  };

  void lit301;
  void lit401;

  return {
    ...live,
    tick: live.tick + 1,
    now,
    motors,
    loops,
    alarms,
    events,
    horn,
    silenced,
    reject,
    kpis,
    stockTons,
    tripTimer,
    lubeWait,
    histHead,
    histLast,
  };
}

function condition(point: Point, value: number, quality: number): { cond: string; pri: 1 | 2 | 3 | 4 } | null {
  if (point.hh != null && value >= point.hh) return { cond: "HH", pri: 1 };
  if (point.ll != null && value <= point.ll) return { cond: "LL", pri: 1 };
  if (point.h != null && value >= point.h) return { cond: "H", pri: 2 };
  if (point.l != null && value <= point.l) return { cond: "L", pri: 2 };
  if (point.alarmWhen != null && Math.round(value) === point.alarmWhen) {
    return { cond: point.alarmCond ?? "ON", pri: point.priority ?? 2 };
  }
  if (quality === 1) return { cond: "BAD", pri: 2 };
  if (quality === 3) return { cond: "COMM", pri: 3 };
  return null;
}

function evaluate(
  alarms: Alarm[],
  now: number,
  values: Float32Array,
  quality: Uint8Array,
  forced: Uint8Array,
  onNew: (priority: number) => void,
): Alarm[] {
  const next = alarms.map((a) => ({ ...a }));
  for (const point of MODEL.points) {
    if (forced[point.index]) continue;
    const value = values[point.index];
    const hit = condition(point, value, quality[point.index]);
    const wanted = hit ? `${point.tag}|${hit.cond}` : null;
    for (const alarm of next) {
      if (alarm.tag !== point.tag || alarm.state === "CLEAR" || alarm.id.includes("@")) continue;
      if (alarm.id === wanted) {
        alarm.value = show(point, value);
        continue;
      }
      if (alarm.state === "UNACK") {
        alarm.state = "RTN";
        alarm.rtnTime = now;
      } else if (alarm.state === "ACK") {
        alarm.state = "CLEAR";
        alarm.rtnTime = now;
        alarm.id = `${alarm.id}@${now}`;
      }
    }
    if (wanted && hit && !next.some((a) => a.id === wanted && a.state !== "CLEAR")) {
      next.unshift({
        id: wanted,
        tag: point.tag,
        cond: hit.cond,
        priority: hit.pri,
        time: now,
        text: `${point.desc} ${hit.cond}`,
        state: "UNACK",
        value: show(point, value),
        area: point.area,
      });
      onNew(hit.pri);
    }
  }
  const active = next.filter((a) => a.state !== "CLEAR");
  const cleared = next.filter((a) => a.state === "CLEAR").slice(0, 80);
  return [...active, ...cleared];
}

export function readSeries(live: Live, tag: string, windowMs: number): { t: number; v: number }[] {
  const buf = live.hist[tag];
  if (!buf) return [];
  const n = buf.length;
  const count = Math.max(2, Math.min(n, Math.round(windowMs / HIST_DT)));
  const newest = (live.histHead - 1 + n) % n;
  const pts: { t: number; v: number }[] = [];
  for (let k = count - 1; k >= 0; k--) {
    const idx = (newest - k + n * 4) % n;
    pts.push({ t: live.histLast - k * HIST_DT, v: buf[idx] });
  }
  const point = MODEL.byTag.get(tag);
  if (point) pts.push({ t: live.now, v: live.values[point.index] });
  return pts;
}
