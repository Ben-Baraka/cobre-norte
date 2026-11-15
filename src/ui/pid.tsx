import type { ReactNode } from "react";
import { MODEL } from "../model/build";
import type { AreaId, Live, MotorState, Target } from "../model/types";
import { fmt } from "./format";
import { usePlant } from "./state";

type Tone = "ore" | "slurry" | "water" | "conc" | "tails" | "air" | "reag" | "power";

interface Unit {
  tag: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  tone: Tone;
  drive?: string;
  read?: string;
}

interface Pipe {
  d: string;
  label?: string;
  lx?: number;
  ly?: number;
  run?: string;
  kind?: "process" | "water" | "air" | "recycle";
}

interface Sheet {
  note: string;
  drawing: string;
  units: Unit[];
  pipes: Pipe[];
}

const FILL: Record<Tone, string> = {
  ore: "#e7c48a",
  slurry: "#e3b184",
  water: "#9ed0ea",
  conc: "#f0c56a",
  tails: "#d9cfc4",
  air: "#d7e0ea",
  reag: "#d7e3a4",
  power: "#c9d4e0",
};

function stateOf(tag: string | undefined, live: Live): MotorState | undefined {
  if (!tag) return undefined;
  const spec = MODEL.motorByTag.get(tag);
  return spec ? live.motors[spec.index].state : undefined;
}

function strokeOf(state?: MotorState): string {
  if (state === "running") return "#1f7a4d";
  if (state === "starting" || state === "stopping") return "#a97812";
  if (state === "tripped") return "#b43333";
  if (state === "stopped") return "#5c6b7a";
  return "#243140";
}

function reading(tag: string | undefined, live: Live): string | null {
  if (!tag) return null;
  const point = MODEL.byTag.get(tag);
  if (!point) return null;
  return `${fmt(live.values[point.index], point.dec)} ${point.eu}`;
}

function targetFor(tag: string): Target | null {
  if (MODEL.equipByTag.has(tag)) return { kind: "equip", tag };
  if (MODEL.motorByTag.has(tag)) return { kind: "motor", tag };
  if (MODEL.valves.some((valve) => valve.tag === tag)) return { kind: "valve", tag };
  const point = MODEL.byTag.get(tag);
  if (point) return { kind: point.words ? "discrete" : "analog", tag };
  return null;
}

function Hit({ tag, children }: { tag: string; children: ReactNode }) {
  const { open } = usePlant();
  const target = targetFor(tag);
  if (!target) return <g>{children}</g>;
  return (
    <g style={{ cursor: "pointer" }} onClick={(event) => { event.stopPropagation(); open(target); }}>
      {children}
    </g>
  );
}

function FlowUnit({ unit, live }: { unit: Unit; live: Live }) {
  const state = stateOf(unit.drive ?? unit.tag, live);
  const value = reading(unit.read, live);
  const cx = unit.x + unit.w / 2;
  const titleY = value ? unit.y + 16 : unit.y + unit.h / 2 - 2;
  const tagY = value ? unit.y + 30 : unit.y + unit.h / 2 + 14;
  return (
    <Hit tag={unit.tag}>
      <rect x={unit.x} y={unit.y} width={unit.w} height={unit.h} rx="3" fill={FILL[unit.tone]} stroke={strokeOf(state)} strokeWidth={state ? 2.4 : 1.4} />
      <text x={cx} y={titleY} textAnchor="middle" fill="#1c2833" fontSize="13" fontWeight={600}>
        {unit.title}
      </text>
      <text x={cx} y={tagY} textAnchor="middle" fill="#3d4e5e" fontSize="11">
        {unit.tag}
      </text>
      {value ? (
        <text x={cx} y={unit.y + unit.h - 8} textAnchor="middle" fill="#143246" fontSize="12" fontFamily="IBM Plex Mono, monospace">
          {value}
        </text>
      ) : null}
    </Hit>
  );
}

export function PidView({ sheet }: { sheet: Sheet }) {
  const { live } = usePlant();
  return (
    <div className="mimic-wrap">
      <svg className="pid" viewBox="0 0 1180 640">
        <rect width="1180" height="640" fill="#f6f3ee" />
        <defs>
          <marker id="arr" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#243140" />
          </marker>
          <marker id="arr-water" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#1d6284" />
          </marker>
          <marker id="arr-air" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#5c6b7a" />
          </marker>
        </defs>
        {sheet.pipes.map((pipe, index) => {
          const running = !pipe.run || stateOf(pipe.run, live) === "running";
          const stroke = pipe.kind === "water" ? "#1d6284" : pipe.kind === "air" ? "#5c6b7a" : "#243140";
          const marker = pipe.kind === "water" ? "url(#arr-water)" : pipe.kind === "air" ? "url(#arr-air)" : "url(#arr)";
          return (
            <path
              key={index}
              d={pipe.d}
              fill="none"
              stroke={stroke}
              strokeWidth={pipe.kind === "recycle" ? 1.6 : 2.2}
              strokeDasharray={!running || pipe.kind === "recycle" ? "7 5" : undefined}
              markerEnd={marker}
            />
          );
        })}
        {sheet.units.map((unit) => (
          <FlowUnit key={unit.tag + unit.x} unit={unit} live={live} />
        ))}
        {sheet.pipes.map((pipe, index) => (
          pipe.label ? (
            <text key={`l${index}`} x={pipe.lx} y={pipe.ly} fill="#1c2833" fontSize="12" fontStyle="italic" stroke="#f6f3ee" strokeWidth="4" paintOrder="stroke">
              {pipe.label}
            </text>
          ) : null
        ))}
        <text x="24" y="632" fill="#5c6b7a" fontSize="12">
          {sheet.drawing} · arrows follow the process · green border running · red border tripped
        </text>
      </svg>
    </div>
  );
}

const U = (unit: Unit): Unit => unit;

export const SHEETS: Record<Exclude<AreaId, "sys">, Sheet> = {
  crush: {
    drawing: "PID-100-001",
    note: "ROM enters the bin, the apron feeder draws it through the gyratory, and the discharge conveyor leaves for the stockpile.",
    units: [
      U({ tag: "BN-101", x: 36, y: 150, w: 140, h: 110, title: "ROM bin", tone: "ore", read: "LIT-101" }),
      U({ tag: "FE-101", x: 230, y: 175, w: 130, h: 64, title: "Apron feeder", tone: "slurry", drive: "FE-101" }),
      U({ tag: "CR-101", x: 410, y: 140, w: 150, h: 130, title: "Gyratory", tone: "ore", drive: "CR-101", read: "EI-CR-101" }),
      U({ tag: "CV-102", x: 720, y: 172, w: 320, h: 70, title: "Discharge conveyor", tone: "slurry", drive: "CV-102", read: "WIT-102" }),
      U({ tag: "DC-101", x: 425, y: 36, w: 130, h: 58, title: "Dust collector", tone: "air", drive: "DC-101" }),
      U({ tag: "MA-101", x: 700, y: 78, w: 110, h: 52, title: "Magnet", tone: "power", drive: "MA-101" }),
      U({ tag: "MD-101", x: 860, y: 78, w: 130, h: 52, title: "Metal detector", tone: "power" }),
      U({ tag: "PU-111", x: 410, y: 360, w: 110, h: 56, title: "Lube pump A", tone: "water", drive: "PU-111" }),
      U({ tag: "PU-112", x: 540, y: 360, w: 110, h: 56, title: "Lube pump B", tone: "water", drive: "PU-112" }),
    ],
    pipes: [
      { d: "M 176 205 H 230", label: "ROM", lx: 184, ly: 196 },
      { d: "M 360 205 H 410" },
      { d: "M 560 205 H 720", label: "Crushed ore", lx: 590, ly: 196 },
      { d: "M 1040 207 H 1140", label: "To stockpile", lx: 1048, ly: 196, run: "CV-102" },
      { d: "M 490 94 V 140", label: "Dust", lx: 498, ly: 124, kind: "air", run: "DC-101" },
      { d: "M 755 130 V 172", run: "CV-102" },
      { d: "M 925 130 V 172", run: "CV-102" },
      { d: "M 485 270 V 330", label: "Lube oil", lx: 492, ly: 312 },
      { d: "M 465 330 H 595" },
      { d: "M 465 330 V 360" },
      { d: "M 595 330 V 360" },
    ],
  },
  stock: {
    drawing: "PID-200-001",
    note: "Crushed ore lands on the live pile. Feeders A and C reclaim onto the collection conveyor, then the SAG-feed conveyor.",
    units: [
      U({ tag: "ST-201", x: 150, y: 48, w: 340, h: 100, title: "Coarse ore stockpile", tone: "ore", read: "LIT-201" }),
      U({ tag: "FE-201A", x: 170, y: 210, w: 90, h: 56, title: "Feeder A", tone: "slurry", drive: "FE-201A" }),
      U({ tag: "FE-201B", x: 275, y: 210, w: 90, h: 56, title: "Feeder B", tone: "slurry", drive: "FE-201B" }),
      U({ tag: "FE-201C", x: 380, y: 210, w: 90, h: 56, title: "Feeder C", tone: "slurry", drive: "FE-201C" }),
      U({ tag: "CV-201", x: 150, y: 340, w: 340, h: 60, title: "Collection conveyor", tone: "slurry", drive: "CV-201" }),
      U({ tag: "CV-202", x: 560, y: 340, w: 420, h: 60, title: "SAG feed conveyor", tone: "slurry", drive: "CV-202", read: "WIT-202" }),
      U({ tag: "MD-201", x: 760, y: 230, w: 140, h: 56, title: "Metal detector", tone: "power" }),
    ],
    pipes: [
      { d: "M 24 98 H 150", label: "From crushing", lx: 28, ly: 88 },
      { d: "M 215 148 V 210" },
      { d: "M 320 148 V 210" },
      { d: "M 425 148 V 210" },
      { d: "M 215 266 V 340" },
      { d: "M 320 266 V 340" },
      { d: "M 425 266 V 340" },
      { d: "M 490 370 H 560", label: "Reclaim", lx: 498, ly: 360, run: "CV-201" },
      { d: "M 830 286 V 340" },
      { d: "M 980 370 H 1140", label: "To SAG mill", lx: 992, ly: 360, run: "CV-202" },
    ],
  },
  sag: {
    drawing: "PID-300-001",
    note: "SAG discharge drops into the sump. The lead cyclone pump feeds the cluster. Underflow is crushed and returned. Overflow leaves for the ball mill.",
    units: [
      U({ tag: "ML-301", x: 36, y: 70, w: 280, h: 90, title: "SAG mill", tone: "ore", drive: "ML-301A", read: "EI-ML-301A" }),
      U({ tag: "SU-301", x: 380, y: 60, w: 110, h: 110, title: "Mill sump", tone: "slurry", read: "LIT-301" }),
      U({ tag: "PU-321A", x: 550, y: 48, w: 130, h: 52, title: "Cyclone pump A", tone: "slurry", drive: "PU-321A" }),
      U({ tag: "PU-321B", x: 550, y: 118, w: 130, h: 52, title: "Cyclone pump B", tone: "slurry", drive: "PU-321B" }),
      U({ tag: "CY-301", x: 760, y: 55, w: 140, h: 100, title: "Cyclone cluster", tone: "slurry", read: "DIT-323" }),
      U({ tag: "CV-331", x: 36, y: 340, w: 280, h: 56, title: "Pebble conveyor", tone: "slurry", drive: "CV-331" }),
      U({ tag: "CR-341", x: 380, y: 328, w: 150, h: 80, title: "Pebble crusher", tone: "ore", drive: "CR-341" }),
      U({ tag: "FV-301", x: 380, y: 230, w: 110, h: 48, title: "Dilution", tone: "water" }),
      U({ tag: "PU-311A", x: 36, y: 470, w: 140, h: 52, title: "SAG lube", tone: "water", drive: "PU-311A", read: "PIT-311" }),
    ],
    pipes: [
      { d: "M 8 115 H 36", label: "From stockpile", lx: 44, ly: 62 },
      { d: "M 316 115 H 380", label: "Discharge", lx: 320, ly: 106, run: "ML-301A" },
      { d: "M 490 86 H 550", run: "PU-321A" },
      { d: "M 490 144 H 550" },
      { d: "M 680 74 H 720", label: "Cyclone feed", lx: 688, ly: 66, run: "PU-321A" },
      { d: "M 680 144 H 720" },
      { d: "M 720 74 V 144" },
      { d: "M 720 105 H 760" },
      { d: "M 900 90 H 1140", label: "Overflow to ball mill", lx: 910, ly: 80, run: "PU-321A" },
      { d: "M 830 155 V 300 H 455 V 328", label: "Underflow", lx: 760, ly: 250, kind: "recycle" },
      { d: "M 316 368 H 380", label: "Pebbles", lx: 318, ly: 358, run: "CV-331" },
      { d: "M 455 408 V 590 H 8 V 36 H 176 V 70", label: "Pebble return", lx: 200, ly: 28, kind: "recycle", run: "CR-341" },
      { d: "M 1100 254 H 490", label: "Process water", lx: 860, ly: 246, kind: "water" },
      { d: "M 435 230 V 170", kind: "water" },
      { d: "M 106 160 V 320 H 22 V 496 H 36", label: "Lube", lx: 36, ly: 448, kind: "water", run: "PU-311A" },
    ],
  },
  ball: {
    drawing: "PID-400-001",
    note: "Ball-mill discharge is pumped to the cyclones. Overflow, sized near 150 µm, is the rougher feed. Underflow returns to the mill.",
    units: [
      U({ tag: "ML-401", x: 36, y: 90, w: 280, h: 90, title: "Ball mill", tone: "ore", drive: "ML-401A", read: "EI-ML-401A" }),
      U({ tag: "SU-401", x: 380, y: 80, w: 110, h: 110, title: "Mill sump", tone: "slurry", read: "LIT-401" }),
      U({ tag: "PU-421A", x: 550, y: 70, w: 140, h: 52, title: "Cyclone pump A", tone: "slurry", drive: "PU-421A" }),
      U({ tag: "PU-421B", x: 550, y: 140, w: 140, h: 52, title: "Cyclone pump B", tone: "slurry", drive: "PU-421B" }),
      U({ tag: "CY-401", x: 770, y: 70, w: 150, h: 100, title: "Cyclone cluster", tone: "slurry", read: "AIT-401-P80" }),
      U({ tag: "FV-401", x: 380, y: 250, w: 110, h: 48, title: "Dilution", tone: "water" }),
      U({ tag: "PU-411A", x: 36, y: 280, w: 150, h: 56, title: "Ball mill lube", tone: "water", drive: "PU-411A", read: "PIT-411" }),
    ],
    pipes: [
      { d: "M 8 135 H 36", label: "SAG overflow", lx: 44, ly: 82 },
      { d: "M 316 135 H 380", label: "Discharge", lx: 318, ly: 126, run: "ML-401A" },
      { d: "M 490 106 H 550", run: "PU-421A" },
      { d: "M 490 166 H 550" },
      { d: "M 690 96 H 730", label: "Cyclone feed", lx: 696, ly: 88, run: "PU-421A" },
      { d: "M 690 166 H 730" },
      { d: "M 730 96 V 166" },
      { d: "M 730 120 H 770" },
      { d: "M 920 100 H 1140", label: "Overflow to rougher", lx: 928, ly: 90, run: "PU-421A" },
      { d: "M 845 170 V 420 H 16 V 135 H 36", label: "Underflow return", lx: 360, ly: 408, kind: "recycle" },
      { d: "M 1040 274 H 490", label: "Process water", lx: 820, ly: 266, kind: "water" },
      { d: "M 435 250 V 190", kind: "water" },
      { d: "M 176 180 V 280", label: "Lube", lx: 184, ly: 230, kind: "water", run: "PU-411A" },
    ],
  },
  rough: {
    drawing: "PID-500-001",
    note: "Conditioned slurry feeds eight rougher cells in series. Concentrate leaves along the top launder. Tails leave along the bottom to the thickener.",
    units: [
      U({ tag: "TK-501", x: 24, y: 165, w: 120, h: 120, title: "Conditioner", tone: "slurry", drive: "AG-520", read: "AIT-520" }),
      U({ tag: "PU-501", x: 180, y: 195, w: 100, h: 60, title: "Feed pump", tone: "slurry", drive: "PU-501" }),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => U({
        tag: `FC-${500 + i}`,
        x: 300 + (i - 1) * 104,
        y: 170,
        w: 86,
        h: 110,
        title: `Cell ${i}`,
        tone: "slurry",
        drive: `AG-${500 + i}`,
        read: i === 1 ? "LIT-501" : undefined,
      })),
      U({ tag: "BL-501A", x: 24, y: 430, w: 120, h: 56, title: "Blower A", tone: "air", drive: "BL-501A", read: "PIT-510" }),
      U({ tag: "BL-501B", x: 160, y: 430, w: 120, h: 56, title: "Blower B", tone: "air", drive: "BL-501B" }),
    ],
    pipes: [
      { d: "M 144 225 H 180", run: "PU-501" },
      { d: "M 280 225 H 300", label: "Rougher feed", lx: 188, ly: 156, run: "PU-501" },
      { d: "M 8 225 H 24", label: "Ball mill overflow", lx: 28, ly: 156 },
      { d: "M 386 225 H 404" },
      { d: "M 490 225 H 508" },
      { d: "M 594 225 H 612" },
      { d: "M 698 225 H 716" },
      { d: "M 802 225 H 820" },
      { d: "M 906 225 H 924" },
      { d: "M 1010 225 H 1028" },
      { d: "M 343 170 V 152 H 1140", label: "Concentrate to cleaner", lx: 620, ly: 144, run: "AG-501" },
      { d: "M 447 170 V 152" },
      { d: "M 551 170 V 152" },
      { d: "M 655 170 V 152" },
      { d: "M 759 170 V 152" },
      { d: "M 863 170 V 152" },
      { d: "M 967 170 V 152" },
      { d: "M 1071 170 V 152" },
      { d: "M 343 280 V 340 H 1140", label: "Tails to thickener", lx: 28, ly: 356, run: "AG-501" },
      { d: "M 447 280 V 340" },
      { d: "M 551 280 V 340" },
      { d: "M 655 280 V 340" },
      { d: "M 759 280 V 340" },
      { d: "M 863 280 V 340" },
      { d: "M 967 280 V 340" },
      { d: "M 1071 280 V 340" },
      { d: "M 84 430 V 400 H 12", kind: "air", run: "BL-501A" },
      { d: "M 220 430 V 400", kind: "air" },
      { d: "M 12 400 V 124 H 1141", label: "Flotation air", lx: 400, ly: 116, kind: "air", run: "BL-501A" },
    ],
  },
  clean: {
    drawing: "PID-600-001",
    note: "Regrind feeds four cleaners and two columns. Scavenger tails are pumped back upstream. Final concentrate leaves for the thickener.",
    units: [
      U({ tag: "ML-601", x: 24, y: 70, w: 150, h: 80, title: "Regrind mill", tone: "ore", drive: "ML-601", read: "EI-ML-601" }),
      U({ tag: "PU-601", x: 200, y: 84, w: 90, h: 52, title: "Feed pump", tone: "slurry", drive: "PU-601" }),
      ...[1, 2, 3, 4].map((i) => U({
        tag: `FC-60${i}`,
        x: 320 + (i - 1) * 110,
        y: 60,
        w: 100,
        h: 96,
        title: `Cleaner ${i}`,
        tone: "conc",
        drive: `AG-60${i}`,
      })),
      U({ tag: "COL-611", x: 770, y: 48, w: 80, h: 120, title: "Column 1", tone: "conc", read: "LIT-611" }),
      U({ tag: "COL-612", x: 870, y: 48, w: 80, h: 120, title: "Column 2", tone: "conc" }),
      ...[1, 2, 3, 4].map((i) => U({
        tag: `FC-62${i}`,
        x: 24 + (i - 1) * 120,
        y: 340,
        w: 108,
        h: 80,
        title: `Scavenger ${i}`,
        tone: "slurry",
        drive: `AG-62${i}`,
      })),
      U({ tag: "PU-631", x: 520, y: 352, w: 120, h: 56, title: "Return pump", tone: "slurry", drive: "PU-631" }),
    ],
    pipes: [
      { d: "M 8 110 H 24", label: "Rougher concentrate", lx: 28, ly: 62 },
      { d: "M 174 110 H 200", run: "ML-601" },
      { d: "M 290 110 H 320", run: "PU-601" },
      { d: "M 420 108 H 430" },
      { d: "M 530 108 H 540" },
      { d: "M 640 108 H 650" },
      { d: "M 750 108 H 770", label: "Cleaner conc", lx: 752, ly: 40 },
      { d: "M 850 108 H 870" },
      { d: "M 950 108 H 1140", label: "To concentrate thickener", lx: 960, ly: 98 },
      { d: "M 370 156 V 300 H 318 V 340", label: "Cleaner tails", lx: 378, ly: 292 },
      { d: "M 132 380 H 144" },
      { d: "M 252 380 H 264" },
      { d: "M 372 380 H 384" },
      { d: "M 492 380 H 520", run: "PU-631" },
      { d: "M 640 380 H 980 V 250 H 12 V 110 H 24", label: "Scavenger return", lx: 700, ly: 242, kind: "recycle", run: "PU-631" },
    ],
  },
  conc: {
    drawing: "PID-700-001",
    note: "Cleaner concentrate is thickened, filtered, and stacked on the covered pad.",
    units: [
      U({ tag: "TH-701", x: 36, y: 160, w: 170, h: 130, title: "Concentrate thickener", tone: "conc", drive: "TH-701", read: "LIT-701" }),
      U({ tag: "PU-701A", x: 270, y: 150, w: 130, h: 56, title: "Underflow pump A", tone: "conc", drive: "PU-701A" }),
      U({ tag: "PU-701B", x: 270, y: 230, w: 130, h: 56, title: "Underflow pump B", tone: "conc", drive: "PU-701B" }),
      U({ tag: "FL-701", x: 480, y: 175, w: 160, h: 90, title: "Disc filter", tone: "conc", drive: "FL-701", read: "AIT-702" }),
      U({ tag: "CV-701", x: 760, y: 188, w: 150, h: 64, title: "Cake conveyor", tone: "conc", drive: "CV-701" }),
      U({ tag: "BN-701", x: 960, y: 160, w: 170, h: 120, title: "Concentrate pad", tone: "conc", read: "AIT-710" }),
    ],
    pipes: [
      { d: "M 8 225 H 36", label: "From columns", lx: 40, ly: 150 },
      { d: "M 206 178 H 270", label: "Underflow", lx: 210, ly: 168, run: "PU-701A" },
      { d: "M 206 258 H 270" },
      { d: "M 400 178 H 440", run: "PU-701A" },
      { d: "M 400 258 H 440" },
      { d: "M 440 178 V 258" },
      { d: "M 440 220 H 480" },
      { d: "M 640 220 H 760", label: "Filter cake", lx: 656, ly: 210, run: "FL-701" },
      { d: "M 910 220 H 960", label: "To pad", lx: 916, ly: 210, run: "CV-701" },
    ],
  },
  tails: {
    drawing: "PID-800-001",
    note: "Rougher tails are thickened and pumped to the TSF. Return water is collected and sent back to the plant.",
    units: [
      U({ tag: "TH-801", x: 36, y: 80, w: 180, h: 140, title: "Tailings thickener", tone: "tails", drive: "TH-801", read: "LIT-801" }),
      U({ tag: "PU-801A", x: 280, y: 78, w: 130, h: 48, title: "TSF pump A", tone: "tails", drive: "PU-801A" }),
      U({ tag: "PU-801B", x: 280, y: 136, w: 130, h: 48, title: "TSF pump B", tone: "tails", drive: "PU-801B" }),
      U({ tag: "PU-801C", x: 280, y: 194, w: 130, h: 48, title: "TSF pump C", tone: "tails", drive: "PU-801C" }),
      U({ tag: "TK-851", x: 720, y: 360, w: 150, h: 120, title: "Return water", tone: "water", read: "LIT-851" }),
      U({ tag: "PU-851A", x: 920, y: 360, w: 120, h: 52, title: "Return pump A", tone: "water", drive: "PU-851A" }),
      U({ tag: "PU-851B", x: 920, y: 428, w: 120, h: 52, title: "Return pump B", tone: "water", drive: "PU-851B" }),
    ],
    pipes: [
      { d: "M 8 150 H 36", label: "Rougher tails", lx: 40, ly: 70 },
      { d: "M 216 102 H 280", run: "PU-801A" },
      { d: "M 216 160 H 280", run: "PU-801B" },
      { d: "M 216 218 H 280" },
      { d: "M 410 102 H 460", run: "PU-801A" },
      { d: "M 410 160 H 460" },
      { d: "M 410 218 H 460" },
      { d: "M 460 102 V 218" },
      { d: "M 460 150 H 1140", label: "To TSF", lx: 980, ly: 140, run: "PU-801A" },
      { d: "M 126 220 V 420 H 720", label: "Decant", lx: 300, ly: 408, kind: "water" },
      { d: "M 870 386 H 920", kind: "water", run: "PU-851A" },
      { d: "M 870 454 H 920", kind: "water" },
      { d: "M 1040 386 H 1140", label: "To process water", lx: 1044, ly: 376, kind: "water", run: "PU-851A" },
      { d: "M 1040 454 H 1080 V 386", kind: "water" },
    ],
  },
  reag: {
    drawing: "PID-900-001",
    note: "Each reagent tank doses through its own pump onto the common header that feeds flotation. Lime pump A is the pH-loop output.",
    units: [
      U({ tag: "SL-901", x: 36, y: 48, w: 130, h: 70, title: "Lime slaker", tone: "reag", drive: "SL-901" }),
      U({ tag: "TK-901", x: 36, y: 150, w: 150, h: 120, title: "Lime", tone: "reag", read: "LIT-901" }),
      U({ tag: "TK-902", x: 280, y: 150, w: 150, h: 120, title: "Collector", tone: "reag", read: "LIT-902" }),
      U({ tag: "TK-903", x: 524, y: 150, w: 150, h: 120, title: "Frother", tone: "reag", read: "LIT-903" }),
      U({ tag: "TK-904", x: 768, y: 150, w: 150, h: 120, title: "Depressant", tone: "reag", read: "LIT-904" }),
      U({ tag: "PU-901A", x: 56, y: 340, w: 120, h: 56, title: "Lime pump", tone: "reag", drive: "PU-901A", read: "FIT-901" }),
      U({ tag: "PU-902A", x: 300, y: 340, w: 120, h: 56, title: "Collector pump", tone: "reag", drive: "PU-902A", read: "FIT-902" }),
      U({ tag: "PU-903A", x: 544, y: 340, w: 120, h: 56, title: "Frother pump", tone: "reag", drive: "PU-903A", read: "FIT-903" }),
      U({ tag: "PU-904A", x: 788, y: 340, w: 120, h: 56, title: "Depressant pump", tone: "reag", drive: "PU-904A", read: "FIT-904" }),
    ],
    pipes: [
      { d: "M 101 118 V 150", label: "Slaked lime", lx: 108, ly: 140 },
      { d: "M 111 270 V 340" },
      { d: "M 355 270 V 340" },
      { d: "M 599 270 V 340" },
      { d: "M 843 270 V 340" },
      { d: "M 116 396 V 470 H 1140", label: "To flotation", lx: 980, ly: 458, run: "PU-901A" },
      { d: "M 360 396 V 470" },
      { d: "M 604 396 V 470" },
      { d: "M 848 396 V 470" },
    ],
  },
  util: {
    drawing: "PID-950-001",
    note: "Process water, gland water, instrument air and cooling water each leave on their own header. The diesel feeds the essential board only.",
    units: [
      U({ tag: "TK-951", x: 36, y: 70, w: 140, h: 140, title: "Process water tank", tone: "water", read: "LIT-951" }),
      U({ tag: "PU-951A", x: 230, y: 48, w: 130, h: 52, title: "Water pump A", tone: "water", drive: "PU-951A", read: "PIT-951" }),
      U({ tag: "PU-951B", x: 230, y: 114, w: 130, h: 52, title: "Water pump B", tone: "water", drive: "PU-951B" }),
      U({ tag: "PU-951C", x: 230, y: 180, w: 130, h: 52, title: "Water pump C", tone: "water", drive: "PU-951C" }),
      U({ tag: "PU-961A", x: 36, y: 280, w: 150, h: 48, title: "Gland pump A", tone: "water", drive: "PU-961A", read: "PIT-961" }),
      U({ tag: "PU-961B", x: 210, y: 280, w: 150, h: 48, title: "Gland pump B", tone: "water", drive: "PU-961B" }),
      U({ tag: "CA-971A", x: 36, y: 400, w: 160, h: 48, title: "Air compressor A", tone: "air", drive: "CA-971A", read: "PIT-971" }),
      U({ tag: "CA-971B", x: 220, y: 400, w: 160, h: 48, title: "Air compressor B", tone: "air", drive: "CA-971B" }),
      U({ tag: "PU-981", x: 36, y: 500, w: 180, h: 48, title: "Cooling water", tone: "water", drive: "PU-981", read: "FIT-981" }),
      U({ tag: "EDG-991", x: 36, y: 556, w: 200, h: 48, title: "Diesel generator", tone: "power", drive: "EDG-991" }),
    ],
    pipes: [
      { d: "M 176 74 H 230", kind: "water", run: "PU-951A" },
      { d: "M 176 140 H 230", kind: "water" },
      { d: "M 176 206 H 230", kind: "water" },
      { d: "M 360 74 H 420", kind: "water", run: "PU-951A" },
      { d: "M 360 140 H 420", kind: "water" },
      { d: "M 360 206 H 420", kind: "water" },
      { d: "M 420 74 V 206" },
      { d: "M 420 120 H 1140", label: "Process water header", lx: 700, ly: 110, kind: "water", run: "PU-951A" },
      { d: "M 111 328 V 364", kind: "water", run: "PU-961A" },
      { d: "M 285 328 V 364", kind: "water" },
      { d: "M 111 364 H 1140", label: "Gland water", lx: 700, ly: 354, kind: "water", run: "PU-961A" },
      { d: "M 116 448 V 468", kind: "air", run: "CA-971A" },
      { d: "M 300 448 V 468", kind: "air" },
      { d: "M 116 468 H 1140", label: "Instrument air", lx: 700, ly: 460, kind: "air", run: "CA-971A" },
      { d: "M 216 524 H 1140", label: "Cooling water", lx: 700, ly: 514, kind: "water", run: "PU-981" },
      { d: "M 236 580 H 1140", label: "Essential board", lx: 700, ly: 570 },
    ],
  },
};

export function areaOfScreen(screen: string): Exclude<AreaId, "sys"> | null {
  return screen in SHEETS ? (screen as Exclude<AreaId, "sys">) : null;
}
