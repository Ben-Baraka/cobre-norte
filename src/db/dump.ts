import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { MODEL } from "../model/build";
import { CATALOG } from "../model/catalog";
import { NARRATIVES } from "../model/narratives";
import { RUN_TRIPS, startChecks } from "../model/permissives";
import { createLive } from "../model/simulate";
import { DESIGN_FEED, PROCESS_SCREENS, STOCK_LIVE_T } from "../model/types";
import { SYMBOL_CARDS } from "../ui/pid";

const { Client } = pg;

export interface DumpCounts {
  areas: number;
  plcs: number;
  buses: number;
  equipment: number;
  motors: number;
  ioPoints: number;
  valves: number;
  loops: number;
  narratives: number;
  symbols: number;
  screens: number;
  pointReadings: number;
  motorReadings: number;
  loopReadings: number;
  alarms: number;
  events: number;
  interlocks: number;
}

function qualityText(code: number): string {
  if (code === 1) return "Bad";
  if (code === 2) return "Forced";
  if (code === 3) return "Uncertain";
  return "Good";
}

async function insertRows(client: pg.Client, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const width = columns.length;
  const size = 200;
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  for (let offset = 0; offset < rows.length; offset += size) {
    const slice = rows.slice(offset, offset + size);
    const values: unknown[] = [];
    const tuples = slice.map((row, rowIndex) => {
      const marks = row.map((value, columnIndex) => {
        values.push(value ?? null);
        return `$${rowIndex * width + columnIndex + 1}`;
      });
      return `(${marks.join(", ")})`;
    });
    await client.query(`insert into ${table} (${quoted}) values ${tuples.join(", ")}`, values);
  }
}

export async function dumpDatabase(connectionString: string): Promise<DumpCounts> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const schema = await readFile(join(root, "migrations/001_cobre_norte.sql"), "utf8");
  const live = createLive();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(schema);
    await client.query("begin");
    try {
      await client.query(`
        truncate
          cobre.interlocks,
          cobre.kpis,
          cobre.events,
          cobre.alarms,
          cobre.loop_readings,
          cobre.motor_readings,
          cobre.point_readings,
          cobre.snapshots,
          cobre.narrative_sections,
          cobre.narratives,
          cobre.symbols,
          cobre.screens,
          cobre.loops,
          cobre.valves,
          cobre.io_points,
          cobre.motors,
          cobre.equipment_design,
          cobre.equipment_drawings,
          cobre.equipment,
          cobre.buses,
          cobre.plcs,
          cobre.areas,
          cobre.plant
        restart identity
      `);

      await insertRows(client, "cobre.plant", ["id", "name", "design_feed_tph", "stockpile_live_t"], [
        ["cobre-norte", "Cobre Norte Concentrator", DESIGN_FEED, STOCK_LIVE_T],
      ]);
      await insertRows(
        client,
        "cobre.areas",
        ["id", "code", "name", "short_name", "plc_id"],
        MODEL.areas.map((area) => [area.id, area.code, area.name, area.short, area.plc]),
      );
      await insertRows(
        client,
        "cobre.plcs",
        ["id", "name", "ip", "cpu"],
        MODEL.plcs.map((plc) => [plc.id, plc.name, plc.ip, plc.cpu]),
      );
      await insertRows(
        client,
        "cobre.buses",
        ["id", "name", "volts", "mva", "fed_from"],
        MODEL.buses.map((bus) => [bus.id, bus.name, bus.volts, bus.mva, bus.from]),
      );
      await insertRows(
        client,
        "cobre.equipment",
        ["tag", "name", "area_id", "kind", "maker", "model", "blurb"],
        MODEL.equips.map((equip) => [equip.tag, equip.name, equip.area, equip.kind, equip.maker, equip.model, equip.blurb]),
      );
      await insertRows(
        client,
        "cobre.equipment_design",
        ["equip_tag", "sort_order", "label", "value"],
        MODEL.equips.flatMap((equip) => equip.design.map((row, index) => [equip.tag, index + 1, row.label, row.value])),
      );
      await insertRows(
        client,
        "cobre.equipment_drawings",
        ["equip_tag", "pid"],
        MODEL.equips.flatMap((equip) => equip.pids.map((pid) => [equip.tag, pid])),
      );
      await insertRows(
        client,
        "cobre.motors",
        [
          "tag", "name", "area_id", "equip_tag", "kw", "volts", "power_factor", "efficiency", "flc_amps",
          "start_method", "duty", "mcc", "cell", "feeder", "bus_id", "cable", "essential", "pair_tag",
          "load_factor", "rated_rpm", "fault_priority", "initial_state", "initial_speed", "local_handoff",
          "trip_reason", "ys_tag", "xa_tag", "xl_tag", "hs_start_tag", "hs_stop_tag", "ii_tag", "ei_tag",
          "si_tag", "sc_tag", "tt_tag", "gh_tag",
        ],
        MODEL.motors.map((motor) => {
          const init = MODEL.motorInit.get(motor.tag);
          return [
            motor.tag, motor.name, motor.area, motor.equip, motor.kw, motor.volts, motor.pf, motor.eff, motor.flc,
            motor.start, motor.duty, motor.mcc, motor.cell, motor.feeder, motor.bus, motor.cable, motor.essential,
            motor.pair ?? null, motor.load, motor.ratedRpm ?? null, motor.faultPriority,
            init?.initial ?? "running", init?.speed ?? 0, !!init?.local, init?.tripReason ?? "",
            motor.ys, motor.xa, motor.xl, motor.hsStart, motor.hsStop, motor.ii,
            motor.ei ?? null, motor.si ?? null, motor.sc ?? null, motor.tt ?? null, motor.gh,
          ];
        }),
      );
      await insertRows(
        client,
        "cobre.io_points",
        [
          "tag", "description", "area_id", "equip_tag", "io_type", "signal", "plc_id", "address", "card", "eu",
          "range_min", "range_max", "decimals", "hh", "h", "l_limit", "ll", "device", "pid", "cable", "fail_state",
          "word_off", "word_on", "alarm_when", "alarm_condition", "alarm_priority", "latched", "wander", "period_s",
          "base_value", "initial_quality", "trend", "source", "feature",
        ],
        MODEL.points.map((point) => [
          point.tag, point.desc, point.area, point.equip, point.io, point.signal, point.plc, point.address, point.card,
          point.eu, point.min, point.max, point.dec, point.hh ?? null, point.h ?? null, point.l ?? null, point.ll ?? null,
          point.device, point.pid, point.cable, point.fail, point.words?.[0] ?? null, point.words?.[1] ?? null,
          point.alarmWhen ?? null, point.alarmCond ?? null, point.priority ?? null, point.latched ?? null,
          point.wander, point.period, point.base, point.quality0, point.trend, point.source, point.feature,
        ]),
      );
      await insertRows(
        client,
        "cobre.valves",
        ["tag", "name", "area_id", "equip_tag", "fail_position", "pid", "device", "zt_tag", "zc_tag", "zso_tag", "zsc_tag"],
        MODEL.valves.map((valve) => [
          valve.tag, valve.name, valve.area, valve.equip, valve.fail, valve.pid, valve.device,
          valve.zt, valve.zc, valve.zso, valve.zsc,
        ]),
      );
      const loopSpec = new Map(CATALOG.loops.map((loop) => [loop.id, loop]));
      await insertRows(
        client,
        "cobre.loops",
        [
          "id", "name", "area_id", "pv_tag", "op_tag", "actuator_tag", "action", "kp", "pv_at_0", "pv_at_100",
          "pv_stopped", "feature", "configured_mode", "configured_sp", "configured_op",
        ],
        MODEL.loops.map((loop) => {
          const spec = loopSpec.get(loop.id);
          return [
            loop.id, loop.name, loop.area, loop.pv, loop.opTag ?? null, loop.actuator ?? null, loop.action, loop.kp,
            loop.pvAt0, loop.pvAt100, loop.pvStopped ?? null, loop.feature,
            spec?.mode ?? "AUTO", spec?.sp ?? 0, spec?.op ?? 0,
          ];
        }),
      );

      const areaByCode = new Map(MODEL.areas.map((area) => [area.code, area.id]));
      await insertRows(
        client,
        "cobre.narratives",
        ["area_code", "title", "area_id"],
        NARRATIVES.map((story) => [story.area, story.title, areaByCode.get(story.area) ?? null]),
      );
      await insertRows(
        client,
        "cobre.narrative_sections",
        ["area_code", "sort_order", "heading", "body"],
        NARRATIVES.flatMap((story) => story.blocks.map((block, index) => [story.area, index + 1, block.h, block.text])),
      );
      await insertRows(
        client,
        "cobre.symbols",
        ["id", "group_name", "name", "note"],
        SYMBOL_CARDS.map((card) => [card.id, card.group, card.name, card.note]),
      );
      await insertRows(
        client,
        "cobre.screens",
        ["id", "label", "group_name", "sort_order"],
        PROCESS_SCREENS.map((screen, index) => [screen.id, screen.label, screen.group, index + 1]),
      );

      const snapshot = await client.query<{ id: string }>(
        "insert into cobre.snapshots (plant_time, tick) values ($1, $2) returning id",
        [new Date(live.now), live.tick],
      );
      const snapshotId = snapshot.rows[0].id;

      await insertRows(
        client,
        "cobre.point_readings",
        ["snapshot_id", "tag", "value", "quality", "quality_text", "forced"],
        MODEL.points.map((point) => [
          snapshotId,
          point.tag,
          live.values[point.index],
          live.quality[point.index],
          qualityText(live.quality[point.index]),
          live.forced[point.index] === 1,
        ]),
      );
      await insertRows(
        client,
        "cobre.motor_readings",
        [
          "snapshot_id", "tag", "state", "speed_sp", "speed", "amps", "kw", "run_hours", "starts",
          "local_handoff", "trip_reason", "state_since",
        ],
        MODEL.motors.map((motor) => {
          const reading = live.motors[motor.index];
          return [
            snapshotId, motor.tag, reading.state, reading.speedSp, reading.speed, reading.amps, reading.kw,
            reading.hours, reading.starts, reading.local, reading.tripReason, new Date(reading.since),
          ];
        }),
      );
      await insertRows(
        client,
        "cobre.loop_readings",
        ["snapshot_id", "loop_id", "mode", "sp", "op"],
        MODEL.loops.map((loop) => {
          const reading = live.loops[loop.index];
          return [snapshotId, loop.id, reading.mode, reading.sp, reading.op];
        }),
      );
      await insertRows(
        client,
        "cobre.alarms",
        ["snapshot_id", "alarm_id", "tag", "condition", "priority", "raised_at", "returned_at", "text", "state", "value_text", "area_id"],
        live.alarms.map((alarm) => [
          snapshotId, alarm.id, alarm.tag, alarm.cond, alarm.priority, new Date(alarm.time),
          alarm.rtnTime ? new Date(alarm.rtnTime) : null, alarm.text, alarm.state, alarm.value, alarm.area,
        ]),
      );
      await insertRows(
        client,
        "cobre.events",
        ["snapshot_id", "sort_order", "event_time", "text", "area_id"],
        live.events.map((event, index) => [snapshotId, index + 1, new Date(event.time), event.text, event.area ?? null]),
      );
      const kpi = live.kpis;
      await insertRows(
        client,
        "cobre.kpis",
        [
          "snapshot_id", "feed_tph", "sag_feed_tph", "head_grade", "recovery", "conc_grade", "tails_grade",
          "conc_tph", "tails_tph", "cu_tph", "cu_in_tph", "p80_um", "grind_kw", "plant_kw", "specific_energy",
          "water_m3h", "stock_pct", "stock_tons", "stock_delta_tph", "shift_tons", "shift_cu",
        ],
        [[
          snapshotId, kpi.feed, kpi.sagFeed, kpi.head, kpi.rec, kpi.concGrade, kpi.tailsGrade, kpi.concTph,
          kpi.tailsTph, kpi.cuTph, kpi.cuIn, kpi.p80, kpi.grindKw, kpi.plantKw, kpi.sec, kpi.water, kpi.stockPct,
          kpi.stockTons, kpi.stockDelta, kpi.shiftTons, kpi.shiftCu,
        ]],
      );

      const interlocks: unknown[][] = [];
      for (const motor of MODEL.motors) {
        if (motor.start === "Static" || motor.area === "sys") continue;
        startChecks(live, motor.tag).forEach((check, index) => {
          interlocks.push([
            snapshotId, `P-${motor.tag}-${index + 1}`, "Permissive", motor.tag, motor.area, check.label,
            "Start stays blocked while this check is not met", null, check.ok,
          ]);
        });
      }
      for (const trip of RUN_TRIPS) {
        const motor = MODEL.motorByTag.get(trip.motor);
        if (!motor) continue;
        interlocks.push([
          snapshotId, `T-${trip.motor}-${trip.reason}`, "Trip", trip.motor, motor.area, trip.reason,
          "Drive trips and the fault stays latched until reset", trip.delay, trip.ok(live),
        ]);
      }
      await insertRows(
        client,
        "cobre.interlocks",
        ["snapshot_id", "interlock_id", "kind", "motor_tag", "area_id", "cause", "action", "delay_s", "healthy"],
        interlocks,
      );

      await client.query("commit");
      return {
        areas: MODEL.areas.length,
        plcs: MODEL.plcs.length,
        buses: MODEL.buses.length,
        equipment: MODEL.equips.length,
        motors: MODEL.motors.length,
        ioPoints: MODEL.points.length,
        valves: MODEL.valves.length,
        loops: MODEL.loops.length,
        narratives: NARRATIVES.length,
        symbols: SYMBOL_CARDS.length,
        screens: PROCESS_SCREENS.length,
        pointReadings: MODEL.points.length,
        motorReadings: MODEL.motors.length,
        loopReadings: MODEL.loops.length,
        alarms: live.alarms.length,
        events: live.events.length,
        interlocks: interlocks.length,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

export function redactConnection(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\/\/([^:/\s]+):([^@/\s]+)@/g, "//$1:***@");
}
