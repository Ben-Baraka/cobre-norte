import { MODEL } from "../model/build";
import type { AreaId, MotorState, Target } from "../model/types";
import { fmt, limitOf } from "./format";
import { usePlant } from "./state";

type Fluid = "slurry" | "water" | "conc" | "tails" | "reag";

export interface SceneNode {
  open: Target;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  motor?: string;
  level?: string;
  fluid?: Fluid;
}

export interface Scene {
  note: string;
  pipes: { d: string; fluid: Fluid | "air"; run?: string }[];
  nodes: SceneNode[];
  readouts: { tag: string; x: number; y: number; label: string }[];
}

function motorState(tag: string | undefined, liveMotors: { state: MotorState }[], indexOf: Map<string, number>): MotorState | undefined {
  if (!tag) return undefined;
  const index = indexOf.get(tag);
  return index == null ? undefined : liveMotors[index].state;
}

const motorIndex = new Map(MODEL.motors.map((m) => [m.tag, m.index]));

function colors(state?: MotorState): [string, string] {
  if (state === "running") return ["#16382c", "#3cba7c"];
  if (state === "starting" || state === "stopping") return ["#3a3214", "#e2b340"];
  if (state === "tripped") return ["#3d1d1d", "#e15b5b"];
  return ["#222a33", "#8b97a6"];
}

function Glyph({ node, state, level }: { node: SceneNode; state?: MotorState; level?: number }) {
  const [fill, stroke] = colors(node.motor ? state : undefined);
  const fluidColor =
    node.fluid === "water" ? "#1f6f8a" : node.fluid === "conc" ? "#c4893a" : node.fluid === "tails" ? "#5c564e" : node.fluid === "reag" ? "#5f6b38" : "#8a5a32";
  const { x, y, w, h, kind } = node;
  const lvl = level == null ? 0.55 : Math.max(0, Math.min(1, level / 100));
  return (
    <g>
      {kind === "bin" || kind === "tank" || kind === "sump" ? (
        <>
          <rect x={x} y={y} width={w} height={h} fill="#1a242e" stroke="#9aafc2" />
          <rect x={x + 2} y={y + h - h * lvl} width={w - 4} height={h * lvl - 2} fill={fluidColor} opacity={0.85} />
        </>
      ) : null}
      {kind === "pile" ? <polygon points={`${x},${y + h} ${x + w / 2},${y} ${x + w},${y + h}`} fill="#3a3128" stroke={stroke} /> : null}
      {kind === "crusher" ? (
        <polygon points={`${x + 8},${y} ${x + w - 8},${y} ${x + w},${y + h} ${x},${y + h}`} fill={fill} stroke={stroke} />
      ) : null}
      {kind === "conveyor" || kind === "feeder" ? (
        <rect x={x} y={y} width={w} height={h} rx={3} fill={fill} stroke={stroke} />
      ) : null}
      {kind === "mill" ? (
        <>
          <rect x={x + 16} y={y} width={w - 32} height={h} fill={fill} stroke={stroke} />
          <ellipse cx={x + 16} cy={y + h / 2} rx={16} ry={h / 2} fill={fill} stroke={stroke} />
          <ellipse cx={x + w - 16} cy={y + h / 2} rx={16} ry={h / 2} fill={fill} stroke={stroke} />
        </>
      ) : null}
      {kind === "pump" || kind === "blower" || kind === "compressor" ? (
        <>
          <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2 - 1} fill={fill} stroke={stroke} />
          <path d={`M ${x + w * 0.35} ${y + h * 0.7} L ${x + w * 0.75} ${y + h * 0.5} L ${x + w * 0.35} ${y + h * 0.3}`} fill="none" stroke={stroke} />
        </>
      ) : null}
      {kind === "cyclone" ? (
        <polygon points={`${x},${y} ${x + w},${y} ${x + w * 0.62},${y + h} ${x + w * 0.38},${y + h}`} fill={fill} stroke={stroke} />
      ) : null}
      {kind === "cell" || kind === "column" ? (
        <>
          <rect x={x} y={y} width={w} height={h} fill="#1a242e" stroke={stroke} />
          <rect x={x + 2} y={y + 4} width={w - 4} height={10} fill="#d7e0ea" opacity={0.35} />
          <rect x={x + 2} y={y + h - h * lvl} width={w - 4} height={Math.max(0, h * lvl - 2)} fill={fluidColor} opacity={0.8} />
        </>
      ) : null}
      {kind === "thickener" ? (
        <>
          <ellipse cx={x + w / 2} cy={y + 18} rx={w / 2} ry={14} fill="#1a242e" stroke="#9aafc2" />
          <rect x={x} y={y + 18} width={w} height={h - 28} fill={fill} stroke={stroke} />
          <ellipse cx={x + w / 2} cy={y + h - 10} rx={w / 2} ry={12} fill={fluidColor} stroke={stroke} />
        </>
      ) : null}
      {kind === "filter" || kind === "analyzer" || kind === "detector" || kind === "generic" ? (
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} />
      ) : null}
      {kind === "valve" ? (
        <polygon points={`${x},${y} ${x + w},${y + h / 2} ${x},${y + h} ${x + w},${y} ${x},${y + h / 2} ${x + w},${y + h}`} fill="#1a242e" stroke="#d4894c" />
      ) : null}
      {kind === "diesel" ? <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} /> : null}
      <text x={x + w / 2} y={y + h + 13} textAnchor="middle" fill="#d7e0ea" fontSize="11">{node.title}</text>
      {node.sub ? <text x={x + w / 2} y={y + h + 25} textAnchor="middle" fill="#8ea0b3" fontSize="9">{node.sub}</text> : null}
    </g>
  );
}

export function SceneView({ scene }: { scene: Scene }) {
  const { live, open } = usePlant();
  return (
    <div className="mimic-wrap">
      <svg className="mimic" viewBox="0 0 1100 520">
        <rect width="1100" height="520" fill="#101820" />
        {scene.pipes.map((pipe, i) => {
          const running = !pipe.run || motorState(pipe.run, live.motors, motorIndex) === "running";
          return <path key={i} d={pipe.d} className={running ? `pipe ${pipe.fluid} flow` : `pipe ${pipe.fluid}`} />;
        })}
        {scene.nodes.map((node) => {
          const state = motorState(node.motor, live.motors, motorIndex);
          const levelPoint = node.level ? MODEL.byTag.get(node.level) : undefined;
          const level = levelPoint ? live.values[levelPoint.index] : undefined;
          return (
            <g key={node.title + node.x} style={{ cursor: "pointer" }} onClick={() => open(node.open)}>
              <Glyph node={node} state={state} level={level} />
            </g>
          );
        })}
        {scene.readouts.map((item) => {
          const point = MODEL.byTag.get(item.tag);
          if (!point) return null;
          const value = live.values[point.index];
          const alarm = limitOf(point, value);
          return (
            <g key={item.tag + item.x} style={{ cursor: "pointer" }} onClick={() => open({ kind: point.words ? "discrete" : "analog", tag: point.tag })}>
              <rect x={item.x} y={item.y} width="108" height="28" fill="#0e151c" stroke={alarm === "HH" || alarm === "LL" ? "#e15b5b" : alarm ? "#e2b340" : "#2c3d4e"} />
              <text x={item.x + 6} y={item.y + 11} fill="#8ea0b3" fontSize="8">{item.label}</text>
              <text x={item.x + 6} y={item.y + 23} fill={alarm ? "#ffb4b4" : "#79d0e6"} fontSize="11" fontFamily="IBM Plex Mono, monospace">
                {fmt(value, point.dec)} {point.eu}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="sw run" /> Running</span>
        <span><i className="sw stop" /> Stopped</span>
        <span><i className="sw start" /> Starting</span>
        <span><i className="sw trip" /> Tripped</span>
        <span><i className="sw slurry" /> Slurry</span>
        <span><i className="sw water" /> Water</span>
        <span><i className="sw air" /> Air</span>
        <span>Click equipment or a value to open its faceplate.</span>
      </div>
    </div>
  );
}

const equip = (tag: string): Target => ({ kind: "equip", tag });
const motor = (tag: string): Target => ({ kind: "motor", tag });
const valve = (tag: string): Target => ({ kind: "valve", tag });

export const SCENES: Record<Exclude<AreaId, "sys">, Scene> = {
  crush: {
    note: "ROM bin, apron feeder, 60-89 gyratory and the discharge conveyor to the stockpile. The dust collector starts tripped.",
    pipes: [
      { d: "M 130 180 H 200", fluid: "slurry", run: "FE-101" },
      { d: "M 350 200 H 400", fluid: "slurry", run: "CV-102" },
    ],
    nodes: [
      { open: equip("BN-101"), kind: "bin", x: 24, y: 70, w: 100, h: 150, title: "BN-101", sub: "ROM BIN", level: "LIT-101", fluid: "slurry" },
      { open: motor("FE-101"), kind: "feeder", x: 24, y: 250, w: 100, h: 36, title: "FE-101", sub: "APRON", motor: "FE-101" },
      { open: equip("CR-101"), kind: "crusher", x: 190, y: 80, w: 150, h: 160, title: "CR-101", sub: "GYRATORY", motor: "CR-101" },
      { open: motor("DC-101"), kind: "generic", x: 210, y: 24, w: 110, h: 36, title: "DC-101", sub: "DUST", motor: "DC-101" },
      { open: motor("CV-102"), kind: "conveyor", x: 400, y: 188, w: 640, h: 28, title: "CV-102", sub: "TO STOCKPILE", motor: "CV-102" },
      { open: motor("MA-101"), kind: "generic", x: 560, y: 130, w: 80, h: 36, title: "MA-101", sub: "MAGNET", motor: "MA-101" },
      { open: equip("MD-101"), kind: "detector", x: 700, y: 130, w: 80, h: 36, title: "MD-101", sub: "METAL" },
    ],
    readouts: [
      { tag: "LIT-101", x: 24, y: 320, label: "BIN LEVEL" },
      { tag: "WIT-102", x: 820, y: 130, label: "FRESH FEED" },
      { tag: "ZT-114", x: 190, y: 280, label: "CSS" },
      { tag: "PIT-111", x: 310, y: 280, label: "LUBE" },
      { tag: "EI-CR-101", x: 190, y: 360, label: "CRUSHER kW" },
      { tag: "VT-115", x: 310, y: 360, label: "VIBRATION" },
    ],
  },
  stock: {
    note: "18,000 t live pocket. Feeders A and C are drawing. Feeder B is standby. CV-202 metal detect is still latched.",
    pipes: [
      { d: "M 40 80 H 180", fluid: "slurry", run: "CV-102" },
      { d: "M 250 250 H 860", fluid: "slurry", run: "CV-201" },
      { d: "M 860 250 H 1040", fluid: "slurry", run: "CV-202" },
    ],
    nodes: [
      { open: equip("ST-201"), kind: "pile", x: 180, y: 40, w: 280, h: 150, title: "ST-201", sub: "COARSE ORE", level: "LIT-201", fluid: "slurry" },
      { open: motor("FE-201A"), kind: "feeder", x: 200, y: 230, w: 70, h: 32, title: "FE-201A", motor: "FE-201A" },
      { open: motor("FE-201B"), kind: "feeder", x: 290, y: 230, w: 70, h: 32, title: "FE-201B", motor: "FE-201B" },
      { open: motor("FE-201C"), kind: "feeder", x: 380, y: 230, w: 70, h: 32, title: "FE-201C", motor: "FE-201C" },
      { open: motor("CV-201"), kind: "conveyor", x: 180, y: 300, w: 420, h: 26, title: "CV-201", sub: "COLLECTION", motor: "CV-201" },
      { open: motor("CV-202"), kind: "conveyor", x: 640, y: 300, w: 400, h: 26, title: "CV-202", sub: "SAG FEED", motor: "CV-202" },
      { open: equip("MD-201"), kind: "detector", x: 900, y: 240, w: 80, h: 32, title: "MD-201", sub: "METAL" },
    ],
    readouts: [
      { tag: "LIT-201", x: 480, y: 70, label: "LIVE LEVEL" },
      { tag: "WIT-202", x: 900, y: 360, label: "SAG FEED" },
      { tag: "XA-MD-201", x: 760, y: 360, label: "METAL DET" },
    ],
  },
  sag: {
    note: "36 ft × 20 ft SAG, twin 7.8 MW pinions. Sump level drives cyclone-feed pump A. Pump B is standby.",
    pipes: [
      { d: "M 16 90 H 36", fluid: "slurry", run: "CV-202" },
      { d: "M 336 100 H 390", fluid: "slurry", run: "ML-301A" },
      { d: "M 480 100 H 530", fluid: "slurry", run: "PU-321A" },
      { d: "M 600 90 H 660", fluid: "slurry", run: "PU-321A" },
      { d: "M 36 340 H 250", fluid: "slurry", run: "CV-331" },
    ],
    nodes: [
      { open: equip("ML-301"), kind: "mill", x: 36, y: 48, w: 300, h: 92, title: "ML-301", sub: "SAG MILL", motor: "ML-301A" },
      { open: equip("SU-301"), kind: "sump", x: 390, y: 40, w: 84, h: 110, title: "SU-301", sub: "SUMP", level: "LIT-301", fluid: "slurry" },
      { open: motor("PU-321A"), kind: "pump", x: 520, y: 36, w: 64, h: 64, title: "PU-321A", sub: "LEAD", motor: "PU-321A" },
      { open: motor("PU-321B"), kind: "pump", x: 520, y: 130, w: 64, h: 64, title: "PU-321B", sub: "STBY", motor: "PU-321B" },
      { open: equip("CY-301"), kind: "cyclone", x: 660, y: 28, w: 88, h: 120, title: "CY-301", sub: "12 CYCLONES", motor: "PU-321A" },
      { open: valve("FV-301"), kind: "valve", x: 780, y: 250, w: 40, h: 32, title: "FV-301", sub: "DILUTION" },
      { open: motor("CV-331"), kind: "conveyor", x: 36, y: 300, w: 280, h: 28, title: "CV-331", sub: "PEBBLES", motor: "CV-331" },
      { open: equip("CR-341"), kind: "crusher", x: 360, y: 270, w: 100, h: 80, title: "CR-341", sub: "PEBBLE", motor: "CR-341" },
      { open: motor("PU-311A"), kind: "pump", x: 900, y: 250, w: 58, h: 58, title: "PU-311A", sub: "LUBE", motor: "PU-311A" },
    ],
    readouts: [
      { tag: "EI-ML-301A", x: 36, y: 190, label: "PINION A kW" },
      { tag: "EI-ML-301B", x: 156, y: 190, label: "PINION B kW" },
      { tag: "LIT-301", x: 390, y: 190, label: "SUMP LEVEL" },
      { tag: "DIT-323", x: 780, y: 28, label: "DENSITY" },
      { tag: "PIT-322", x: 900, y: 28, label: "CYC kPa" },
      { tag: "FIT-321", x: 780, y: 70, label: "CYC FLOW" },
      { tag: "TIT-311A", x: 900, y: 70, label: "BRG A" },
      { tag: "PIT-311", x: 780, y: 310, label: "LUBE kPa" },
    ],
  },
  ball: {
    note: "22 ft × 36 ft ball mill. Overflow P80 is the rougher feed size. Cyclone pump B is standby.",
    pipes: [
      { d: "M 20 140 H 100", fluid: "slurry", run: "PU-321A" },
      { d: "M 420 180 H 540", fluid: "slurry", run: "PU-421A" },
    ],
    nodes: [
      { open: equip("ML-401"), kind: "mill", x: 70, y: 80, w: 300, h: 100, title: "ML-401", sub: "BALL MILL", motor: "ML-401A" },
      { open: equip("SU-401"), kind: "sump", x: 420, y: 140, w: 80, h: 90, title: "SU-401", level: "LIT-401", fluid: "slurry" },
      { open: motor("PU-421A"), kind: "pump", x: 540, y: 130, w: 64, h: 64, title: "PU-421A", sub: "LEAD", motor: "PU-421A" },
      { open: motor("PU-421B"), kind: "pump", x: 540, y: 220, w: 64, h: 64, title: "PU-421B", sub: "STBY", motor: "PU-421B" },
      { open: equip("CY-401"), kind: "cyclone", x: 700, y: 60, w: 90, h: 120, title: "CY-401", sub: "TO ROUGHER", motor: "PU-421A" },
      { open: valve("FV-401"), kind: "valve", x: 820, y: 200, w: 36, h: 28, title: "FV-401", sub: "DILUTION" },
      { open: motor("PU-411A"), kind: "pump", x: 900, y: 320, w: 54, h: 54, title: "PU-411A", sub: "LUBE", motor: "PU-411A" },
    ],
    readouts: [
      { tag: "EI-ML-401A", x: 70, y: 220, label: "PINION A kW" },
      { tag: "EI-ML-401B", x: 190, y: 220, label: "PINION B kW" },
      { tag: "AIT-401-P80", x: 820, y: 60, label: "P80 µm" },
      { tag: "DIT-423", x: 820, y: 100, label: "DENSITY" },
      { tag: "LIT-401", x: 420, y: 40, label: "SUMP" },
      { tag: "PIT-422", x: 700, y: 220, label: "CYC kPa" },
      { tag: "FIT-421", x: 820, y: 220, label: "CYC FLOW" },
    ],
  },
  rough: {
    note: "Conditioner, eight 300 m³ roughers, one duty blower. Air and level are individual loops. Cell 1 is on the group display; the others match it.",
    pipes: [
      { d: "M 40 160 H 150", fluid: "slurry", run: "PU-501" },
      { d: "M 230 160 H 980", fluid: "slurry", run: "AG-501" },
      { d: "M 40 40 H 980", fluid: "air", run: "BL-501A" },
    ],
    nodes: [
      { open: equip("TK-501"), kind: "tank", x: 24, y: 80, w: 70, h: 110, title: "TK-501", sub: "COND", level: "LIT-520", fluid: "slurry" },
      { open: motor("PU-501"), kind: "pump", x: 110, y: 120, w: 54, h: 54, title: "PU-501", motor: "PU-501" },
      ...Array.from({ length: 8 }, (_, i) => ({
        open: equip(`FC-${501 + i}`),
        kind: "cell",
        x: 200 + i * 100,
        y: 90,
        w: 78,
        h: 110,
        title: `FC-${501 + i}`,
        sub: `CELL ${i + 1}`,
        motor: `AG-${501 + i}`,
        level: `LIT-${501 + i}`,
        fluid: "slurry" as const,
      })),
      { open: motor("BL-501A"), kind: "blower", x: 24, y: 280, w: 70, h: 70, title: "BL-501A", sub: "AIR", motor: "BL-501A" },
      { open: motor("BL-501B"), kind: "blower", x: 110, y: 280, w: 70, h: 70, title: "BL-501B", sub: "STBY", motor: "BL-501B" },
      { open: equip("AN-501"), kind: "analyzer", x: 860, y: 280, w: 140, h: 50, title: "AN-501", sub: "COURIER 6i" },
    ],
    readouts: [
      { tag: "AIT-510-CU", x: 24, y: 380, label: "FEED %Cu" },
      { tag: "AIT-511-CU", x: 150, y: 380, label: "CONC %Cu" },
      { tag: "AIT-512-CU", x: 276, y: 380, label: "TAILS %Cu" },
      { tag: "AIT-520", x: 400, y: 380, label: "pH" },
      { tag: "PIT-510", x: 24, y: 430, label: "AIR kPa" },
      { tag: "LIT-501", x: 150, y: 430, label: "CELL 1" },
      { tag: "FIT-501", x: 276, y: 430, label: "CELL 1 AIR" },
    ],
  },
  clean: {
    note: "Regrind vertimill, four cleaners, two columns and four scavengers. Cleaner tails return to the rougher.",
    pipes: [{ d: "M 40 150 H 1040", fluid: "slurry", run: "ML-601" }],
    nodes: [
      { open: equip("ML-601"), kind: "mill", x: 20, y: 40, w: 160, h: 70, title: "ML-601", sub: "REGRIND", motor: "ML-601" },
      { open: motor("PU-601"), kind: "pump", x: 200, y: 50, w: 54, h: 54, title: "PU-601", motor: "PU-601" },
      ...[1, 2, 3, 4].map((i) => ({
        open: equip(`FC-60${i}`),
        kind: "cell",
        x: 280 + (i - 1) * 90,
        y: 40,
        w: 72,
        h: 90,
        title: `FC-60${i}`,
        sub: "CLEANER",
        motor: `AG-60${i}`,
        level: `LIT-60${i}`,
        fluid: "conc" as const,
      })),
      ...[1, 2].map((i) => ({
        open: equip(`COL-61${i}`),
        kind: "column",
        x: 660 + (i - 1) * 80,
        y: 30,
        w: 60,
        h: 120,
        title: `COL-61${i}`,
        sub: "COLUMN",
        level: `LIT-61${i}`,
        fluid: "conc" as const,
      })),
      ...[1, 2, 3, 4].map((i) => ({
        open: equip(`FC-62${i}`),
        kind: "cell",
        x: 280 + (i - 1) * 90,
        y: 220,
        w: 72,
        h: 80,
        title: `FC-62${i}`,
        sub: "SCAV",
        motor: `AG-62${i}`,
        level: `LIT-62${i}`,
        fluid: "slurry" as const,
      })),
      { open: motor("PU-631"), kind: "pump", x: 860, y: 240, w: 54, h: 54, title: "PU-631", sub: "TAILS", motor: "PU-631" },
    ],
    readouts: [
      { tag: "AIT-601-P80", x: 20, y: 160, label: "REGRIND P80" },
      { tag: "EI-ML-601", x: 20, y: 200, label: "MILL kW" },
      { tag: "AIT-610-CU", x: 860, y: 160, label: "CLEANER %Cu" },
      { tag: "LIT-601", x: 280, y: 160, label: "CLN 1 LVL" },
      { tag: "LIT-611", x: 660, y: 180, label: "COL 1 LVL" },
    ],
  },
  conc: {
    note: "25 m concentrate thickener, ceramic disc filter and the covered pad.",
    pipes: [
      { d: "M 180 160 H 320", fluid: "conc", run: "PU-701A" },
      { d: "M 500 180 H 700", fluid: "conc", run: "FL-701" },
    ],
    nodes: [
      { open: equip("TH-701"), kind: "thickener", x: 40, y: 60, w: 140, h: 120, title: "TH-701", sub: "25 m", motor: "TH-701", fluid: "conc" },
      { open: motor("PU-701A"), kind: "pump", x: 230, y: 100, w: 60, h: 60, title: "PU-701A", motor: "PU-701A" },
      { open: motor("PU-701B"), kind: "pump", x: 230, y: 190, w: 60, h: 60, title: "PU-701B", sub: "STBY", motor: "PU-701B" },
      { open: equip("FL-701"), kind: "filter", x: 380, y: 80, w: 140, h: 90, title: "FL-701", sub: "DISC FILTER", motor: "FL-701" },
      { open: motor("CV-701"), kind: "conveyor", x: 560, y: 120, w: 240, h: 26, title: "CV-701", motor: "CV-701" },
      { open: equip("BN-701"), kind: "pile", x: 840, y: 60, w: 160, h: 110, title: "BN-701", sub: "CONC PAD", fluid: "conc" },
    ],
    readouts: [
      { tag: "DIT-701", x: 40, y: 230, label: "UF DENSITY" },
      { tag: "LIT-701", x: 160, y: 230, label: "BED" },
      { tag: "JT-701", x: 40, y: 280, label: "RAKE TORQUE" },
      { tag: "AIT-702", x: 380, y: 200, label: "MOISTURE" },
      { tag: "AIT-710", x: 840, y: 200, label: "FINAL %Cu" },
      { tag: "WIT-703", x: 960, y: 200, label: "PAD t" },
    ],
  },
  tails: {
    note: "65 m tailings thickener. Pumps A and B run to the TSF. Pump C is standby. Return water comes back to the plant.",
    pipes: [
      { d: "M 200 160 H 520", fluid: "tails", run: "PU-801A" },
      { d: "M 700 200 H 1000", fluid: "water", run: "PU-851A" },
    ],
    nodes: [
      { open: equip("TH-801"), kind: "thickener", x: 30, y: 40, w: 170, h: 140, title: "TH-801", sub: "65 m", motor: "TH-801", fluid: "tails" },
      { open: motor("PU-801A"), kind: "pump", x: 250, y: 60, w: 64, h: 64, title: "PU-801A", motor: "PU-801A" },
      { open: motor("PU-801B"), kind: "pump", x: 340, y: 60, w: 64, h: 64, title: "PU-801B", motor: "PU-801B" },
      { open: motor("PU-801C"), kind: "pump", x: 430, y: 60, w: 64, h: 64, title: "PU-801C", sub: "STBY", motor: "PU-801C" },
      { open: equip("TH-801"), kind: "pile", x: 560, y: 40, w: 140, h: 80, title: "TSF", sub: "LINE", fluid: "tails" },
      { open: equip("TK-851"), kind: "tank", x: 760, y: 50, w: 80, h: 120, title: "TK-851", sub: "RETURN", level: "LIT-851", fluid: "water" },
      { open: motor("PU-851A"), kind: "pump", x: 880, y: 70, w: 60, h: 60, title: "PU-851A", motor: "PU-851A" },
      { open: motor("PU-851B"), kind: "pump", x: 960, y: 70, w: 60, h: 60, title: "PU-851B", sub: "STBY", motor: "PU-851B" },
    ],
    readouts: [
      { tag: "LIT-801", x: 30, y: 230, label: "BED LEVEL" },
      { tag: "DIT-801", x: 150, y: 230, label: "UF DENSITY" },
      { tag: "AIT-801-CU", x: 270, y: 230, label: "TAILS %Cu" },
      { tag: "FIT-801", x: 250, y: 160, label: "LINE FLOW" },
      { tag: "PIT-802", x: 370, y: 160, label: "LINE kPa" },
      { tag: "JT-801", x: 30, y: 280, label: "RAKE %" },
      { tag: "LIT-851", x: 760, y: 200, label: "RETURN LVL" },
    ],
  },
  reag: {
    note: "Lime slaker, collector, frother and depressant. Lime pump A is the output of the conditioner pH loop.",
    pipes: [{ d: "M 80 220 H 980", fluid: "reag", run: "PU-901A" }],
    nodes: [
      { open: equip("SL-901"), kind: "tank", x: 30, y: 50, w: 80, h: 100, title: "SL-901", sub: "SLAKER", motor: "SL-901", fluid: "reag" },
      { open: equip("TK-901"), kind: "tank", x: 180, y: 40, w: 80, h: 120, title: "TK-901", sub: "LIME", level: "LIT-901", fluid: "reag" },
      { open: equip("TK-902"), kind: "tank", x: 400, y: 40, w: 80, h: 120, title: "TK-902", sub: "COLLECTOR", level: "LIT-902", fluid: "reag" },
      { open: equip("TK-903"), kind: "tank", x: 620, y: 40, w: 80, h: 120, title: "TK-903", sub: "FROTHER", level: "LIT-903", fluid: "reag" },
      { open: equip("TK-904"), kind: "tank", x: 840, y: 40, w: 80, h: 120, title: "TK-904", sub: "DEPRESSANT", level: "LIT-904", fluid: "reag" },
      { open: motor("PU-901A"), kind: "pump", x: 190, y: 250, w: 54, h: 54, title: "PU-901A", sub: "pH", motor: "PU-901A" },
      { open: motor("PU-902A"), kind: "pump", x: 410, y: 250, w: 54, h: 54, title: "PU-902A", motor: "PU-902A" },
      { open: motor("PU-903A"), kind: "pump", x: 630, y: 250, w: 54, h: 54, title: "PU-903A", motor: "PU-903A" },
      { open: motor("PU-904A"), kind: "pump", x: 850, y: 250, w: 54, h: 54, title: "PU-904A", motor: "PU-904A" },
    ],
    readouts: [
      { tag: "DIT-901", x: 180, y: 190, label: "LIME %sol" },
      { tag: "FIT-901", x: 180, y: 340, label: "LIME FLOW" },
      { tag: "FIT-902", x: 400, y: 340, label: "COLLECTOR" },
      { tag: "FIT-903", x: 620, y: 340, label: "FROTHER" },
      { tag: "FIT-904", x: 840, y: 340, label: "DEPRESSANT" },
      { tag: "AIT-520", x: 30, y: 190, label: "COND pH" },
    ],
  },
  util: {
    note: "Process water, gland water, instrument air and the essential board. Stopping the duty water pump drops header pressure until a standby is started.",
    pipes: [
      { d: "M 140 120 H 520", fluid: "water", run: "PU-951A" },
      { d: "M 700 140 H 1040", fluid: "air", run: "CA-971A" },
    ],
    nodes: [
      { open: equip("TK-951"), kind: "tank", x: 30, y: 50, w: 90, h: 140, title: "TK-951", sub: "PROCESS WTR", level: "LIT-951", fluid: "water" },
      { open: motor("PU-951A"), kind: "pump", x: 160, y: 70, w: 64, h: 64, title: "PU-951A", sub: "DUTY", motor: "PU-951A" },
      { open: motor("PU-951B"), kind: "pump", x: 250, y: 70, w: 64, h: 64, title: "PU-951B", sub: "STBY", motor: "PU-951B" },
      { open: motor("PU-951C"), kind: "pump", x: 340, y: 70, w: 64, h: 64, title: "PU-951C", sub: "STBY", motor: "PU-951C" },
      { open: motor("PU-961A"), kind: "pump", x: 160, y: 250, w: 60, h: 60, title: "PU-961A", sub: "GLAND", motor: "PU-961A" },
      { open: motor("PU-961B"), kind: "pump", x: 250, y: 250, w: 60, h: 60, title: "PU-961B", sub: "STBY", motor: "PU-961B" },
      { open: motor("CA-971A"), kind: "compressor", x: 500, y: 70, w: 90, h: 60, title: "CA-971A", sub: "AIR", motor: "CA-971A" },
      { open: motor("CA-971B"), kind: "compressor", x: 610, y: 70, w: 90, h: 60, title: "CA-971B", sub: "STBY", motor: "CA-971B" },
      { open: motor("PU-981"), kind: "pump", x: 500, y: 250, w: 60, h: 60, title: "PU-981", sub: "COOLING", motor: "PU-981" },
      { open: equip("EDG-991"), kind: "diesel", x: 860, y: 60, w: 150, h: 70, title: "EDG-991", sub: "1250 kW", motor: "EDG-991" },
      { open: equip("UPS-001"), kind: "generic", x: 860, y: 180, w: 110, h: 40, title: "UPS-001", sub: "CONTROL", motor: "UPS-001" },
    ],
    readouts: [
      { tag: "PIT-951", x: 160, y: 160, label: "HEADER kPa" },
      { tag: "FIT-951", x: 280, y: 160, label: "WATER m3/h" },
      { tag: "LIT-951", x: 30, y: 220, label: "TANK" },
      { tag: "PIT-961", x: 160, y: 340, label: "GLAND kPa" },
      { tag: "PIT-971", x: 500, y: 160, label: "AIR kPa" },
      { tag: "FIT-981", x: 500, y: 340, label: "CW FLOW" },
    ],
  },
};

export function areaOfScreen(screen: string): Exclude<AreaId, "sys"> | null {
  return screen in SCENES ? (screen as Exclude<AreaId, "sys">) : null;
}
