import type { ReactNode } from "react";
import { MODEL } from "../model/build";
import type { AreaId, Live, MotorState, Target } from "../model/types";
import { fmt, limitOf } from "./format";
import { usePlant } from "./state";

type Fluid = "slurry" | "water" | "conc" | "tails" | "reag" | "air";
type Loc = "field" | "board" | "panel" | "dcs" | "computer";
type ValveForm = "control" | "gate" | "globe" | "check" | "butterfly" | "ball";
type Act = "air" | "motor" | "solenoid" | "hand";

type Sym =
  | { k: "bin"; tag: string; name: string; x: number; y: number; w: number; h: number; level?: string }
  | { k: "pile"; tag: string; name: string; x: number; y: number; w: number; h: number; level?: string }
  | { k: "tank"; tag: string; name: string; x: number; y: number; w: number; h: number; level?: string; drive?: string; agitator?: boolean; fluid?: Fluid }
  | { k: "belt"; tag: string; name: string; x: number; y: number; w: number; drive?: string }
  | { k: "crusher"; tag: string; name: string; x: number; y: number; drive?: string }
  | { k: "mill"; tag: string; name: string; x: number; y: number; w: number; drive?: string }
  | { k: "pump"; tag: string; name: string; x: number; y: number; drive?: string; dir?: "e" | "n" }
  | { k: "cyclone"; tag: string; name: string; x: number; y: number }
  | { k: "cell"; tag: string; name: string; x: number; y: number; drive?: string }
  | { k: "column"; tag: string; name: string; x: number; y: number }
  | { k: "thickener"; tag: string; name: string; x: number; y: number; r: number; drive?: string }
  | { k: "filter"; tag: string; name: string; x: number; y: number; drive?: string }
  | { k: "fan"; tag: string; name: string; x: number; y: number; drive?: string; motor?: "below" | "right" }
  | { k: "compressor"; tag: string; name: string; x: number; y: number; drive?: string }
  | { k: "diesel"; tag: string; name: string; x: number; y: number; drive?: string }
  | { k: "magnet"; tag: string; name: string; x: number; y: number }
  | { k: "detector"; tag: string; name: string; x: number; y: number }
  | { k: "valve"; tag: string; name: string; x: number; y: number; form: ValveForm; act?: Act }
  | { k: "bubble"; tag: string; x: number; y: number; loc: Loc };

interface Pipe {
  d: string;
  fluid: Fluid;
  label?: string;
  lx?: number;
  ly?: number;
  run?: string;
  recycle?: boolean;
}

interface Sheet {
  note: string;
  drawing: string;
  syms: Sym[];
  pipes: Pipe[];
  signals?: string[];
}

const INK = "#d5e2ee";
const DIM = "#8ea0b3";
const PAPER = "#101820";
const FLUID: Record<Fluid, string> = {
  slurry: "#d08a45",
  water: "#4aa3c7",
  conc: "#e2b340",
  tails: "#c4b8ae",
  reag: "#c5d46a",
  air: "#b7c3d0",
};

function stateColor(state?: MotorState): string {
  if (state === "running") return "#3cba7c";
  if (state === "starting" || state === "stopping") return "#e2b340";
  if (state === "tripped") return "#e15b5b";
  return "#8b97a6";
}

function motorOf(tag: string | undefined, live: Live): MotorState | undefined {
  if (!tag) return undefined;
  const spec = MODEL.motorByTag.get(tag);
  return spec ? live.motors[spec.index].state : undefined;
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

function Caption({ x, y, name, tag }: { x: number; y: number; name?: string; tag: string }) {
  return (
    <g>
      {name ? <text x={x} y={y} textAnchor="middle" fill={DIM} fontSize="11">{name}</text> : null}
      <text x={x} y={y + (name ? 13 : 0)} textAnchor="middle" fill={INK} fontSize="11">{tag}</text>
    </g>
  );
}

function Motor({ x, y, tag, state }: { x: number; y: number; tag?: string; state?: MotorState }) {
  const stroke = stateColor(state);
  const body = (
    <g>
      <circle cx={x} cy={y} r="11" fill={PAPER} stroke={stroke} strokeWidth="1.4" />
      <text x={x} y={y + 4} textAnchor="middle" fill={stroke} fontSize="11" fontFamily="IBM Plex Mono, monospace">M</text>
    </g>
  );
  return tag ? <Hit tag={tag}>{body}</Hit> : body;
}

function BubbleGlyph({ loc, alarm }: { loc: Loc; alarm: boolean }) {
  const stroke = alarm ? "#e15b5b" : INK;
  if (loc === "computer") return <polygon points="0,-18 16,0 0,18 -16,0" fill={PAPER} stroke={stroke} />;
  return (
    <g>
      {loc === "dcs" ? <rect x="-18" y="-18" width="36" height="36" fill={PAPER} stroke={stroke} /> : null}
      <circle r="15" fill={PAPER} stroke={stroke} />
      {loc === "board" ? <line x1="-15" y1="0" x2="15" y2="0" stroke={stroke} /> : null}
      {loc === "panel" ? (
        <>
          <line x1="-15" y1="-3" x2="15" y2="-3" stroke={stroke} />
          <line x1="-15" y1="3" x2="15" y2="3" stroke={stroke} />
        </>
      ) : null}
    </g>
  );
}

function bowtie() {
  return (
    <g>
      <polygon points="-13,-8 0,0 -13,8" fill={PAPER} stroke={INK} />
      <polygon points="13,-8 0,0 13,8" fill={PAPER} stroke={INK} />
    </g>
  );
}

function Actuator({ act }: { act?: Act }) {
  if (act === "motor") {
    return (
      <g>
        <line x1="0" y1="-8" x2="0" y2="-16" stroke={INK} />
        <circle cy="-26" r="9" fill={PAPER} stroke={INK} />
        <text y="-23" textAnchor="middle" fill={INK} fontSize="9">M</text>
      </g>
    );
  }
  if (act === "solenoid") {
    return (
      <g>
        <line x1="0" y1="-8" x2="0" y2="-16" stroke={INK} />
        <rect x="-8" y="-32" width="16" height="16" fill={PAPER} stroke={INK} />
        <text y="-21" textAnchor="middle" fill={INK} fontSize="9">S</text>
      </g>
    );
  }
  if (act === "hand") {
    return (
      <g>
        <line x1="0" y1="-8" x2="0" y2="-20" stroke={INK} />
        <line x1="-8" y1="-20" x2="8" y2="-20" stroke={INK} />
      </g>
    );
  }
  return (
    <g>
      <line x1="0" y1="-8" x2="0" y2="-16" stroke={INK} />
      <path d="M -9,-16 A 9 9 0 0 1 9,-16 Z" fill={PAPER} stroke={INK} />
    </g>
  );
}

function ValveGlyph({ form, act }: { form: ValveForm; act?: Act }) {
  return (
    <g>
      {form === "control" ? <Actuator act={act ?? "air"} /> : null}
      {form === "check" ? (
        <g>
          <polygon points="-12,-8 4,0 -12,8" fill={PAPER} stroke={INK} />
          <line x1="6" y1="-9" x2="6" y2="9" stroke={INK} />
        </g>
      ) : bowtie()}
      {form === "gate" ? <line x1="0" y1="-9" x2="0" y2="9" stroke={INK} /> : null}
      {form === "globe" ? <circle r="3.5" fill={INK} /> : null}
      {form === "ball" ? <circle r="4" fill={PAPER} stroke={INK} /> : null}
      {form === "butterfly" ? <line x1="-6" y1="-7" x2="6" y2="7" stroke={INK} /> : null}
    </g>
  );
}

function PumpGlyph({ dir, stroke }: { dir: "e" | "n"; stroke: string }) {
  return (
    <g transform={dir === "n" ? "rotate(-90)" : undefined} stroke={stroke}>
      <circle r="16" fill={PAPER} strokeWidth="1.4" />
      <path d="M 4,-9 L 22,0 L 4,9 Z" fill={PAPER} strokeWidth="1.4" />
      <path d="M -8,5 Q 0,-6 7,4" fill="none" strokeWidth="1.2" />
    </g>
  );
}

function levelBand(w: number, h: number, level: number | undefined, fluid: Fluid = "slurry") {
  const pct = level == null ? 0.45 : Math.max(0.08, Math.min(0.92, level / 100));
  return <rect x="2" y={h * (1 - pct)} width={w - 4} height={h * pct - 2} fill={FLUID[fluid]} opacity="0.35" />;
}

function SymbolMark({ sym, live }: { sym: Sym; live: Live }) {
  if (sym.k === "bubble") {
    const loop = MODEL.loopById.get(sym.tag);
    const point = MODEL.byTag.get(sym.tag) ?? (loop ? MODEL.byTag.get(loop.pv) : undefined);
    const value = point ? live.values[point.index] : undefined;
    const shown = loop ? live.loops[loop.index].sp : value;
    const alarm = point && value != null && (limitOf(point, value) != null || (point.alarmWhen != null && (value >= 0.5 ? 1 : 0) === point.alarmWhen));
    const [fn, ...rest] = sym.tag.split("-");
    const num = rest.join("-");
    return (
      <Hit tag={point?.tag ?? sym.tag}>
        <g transform={`translate(${sym.x} ${sym.y})`}>
          <BubbleGlyph loc={sym.loc} alarm={!!alarm} />
          <text y={num ? -1 : 3} textAnchor="middle" fill={INK} fontSize="8">{fn}</text>
          {num ? <text y="9" textAnchor="middle" fill={DIM} fontSize="7">{num.length > 8 ? num.slice(0, 8) : num}</text> : null}
          {point && shown != null ? (
            <text y="-24" textAnchor="middle" fill={alarm ? "#ffb4b4" : "#79d0e6"} fontSize="11" fontFamily="IBM Plex Mono, monospace">
              {fmt(shown, point.dec)}
            </text>
          ) : null}
        </g>
      </Hit>
    );
  }

  const drive = "drive" in sym ? sym.drive : undefined;
  const state = motorOf(drive ?? (sym.k === "pump" || sym.k === "belt" || sym.k === "fan" || sym.k === "compressor" || sym.k === "diesel" ? sym.tag : undefined), live);
  const driven = state != null;
  const stroke = driven ? stateColor(state) : INK;

  if (sym.k === "bin") {
    const { x, y, w, h } = sym;
    const body = h * 0.62;
    const lvl = sym.level ? live.values[MODEL.byTag.get(sym.level)?.index ?? -1] : undefined;
    return (
      <Hit tag={sym.tag}>
        <g>
          <polygon points={`${x},${y} ${x + w},${y} ${x + w},${y + body} ${x + w * 0.72},${y + h} ${x + w * 0.28},${y + h}`} fill={PAPER} stroke={stroke} />
          <g transform={`translate(${x} ${y})`}>{levelBand(w, body, lvl)}</g>
          <Caption x={x + w / 2} y={y + h + 16} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "pile") {
    const { x, y, w, h } = sym;
    const lvl = sym.level ? live.values[MODEL.byTag.get(sym.level)?.index ?? -1] : undefined;
    return (
      <Hit tag={sym.tag}>
        <g>
          <polygon points={`${x + w * 0.18},${y} ${x + w * 0.82},${y} ${x + w},${y + h} ${x},${y + h}`} fill={PAPER} stroke={stroke} />
          <g transform={`translate(${x} ${y})`}>{levelBand(w, h, lvl)}</g>
          <Caption x={x + w / 2} y={y - 22} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "tank") {
    const { x, y, w, h } = sym;
    const lvl = sym.level ? live.values[MODEL.byTag.get(sym.level)?.index ?? -1] : undefined;
    return (
      <g>
        <Hit tag={sym.tag}>
          <g>
            <line x1={x} y1={y + 8} x2={x + w} y2={y + 8} stroke={stroke} />
            <rect x={x} y={y + 8} width={w} height={h - 16} fill={PAPER} stroke={stroke} />
            <ellipse cx={x + w / 2} cy={y + h - 8} rx={w / 2} ry="8" fill={PAPER} stroke={stroke} />
            <g transform={`translate(${x} ${y + 8})`}>{levelBand(w, h - 16, lvl, sym.fluid)}</g>
            {sym.agitator ? (
              <g stroke={stroke} fill="none">
                <line x1={x + w / 2} y1={y + 8} x2={x + w / 2} y2={y + h - 24} />
                <path d={`M ${x + w / 2 - 14} ${y + h - 30} L ${x + w / 2} ${y + h - 22} L ${x + w / 2 + 14} ${y + h - 30}`} />
              </g>
            ) : null}
            <Caption x={x + w / 2} y={y + h + 18} name={sym.name} tag={sym.tag} />
          </g>
        </Hit>
        {sym.agitator ? <Motor x={x + w / 2} y={y - 14} tag={sym.drive} state={state} /> : null}
      </g>
    );
  }

  if (sym.k === "belt") {
    const y = sym.y;
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <line x1={sym.x + 12} y1={y} x2={sym.x + sym.w - 12} y2={y} strokeWidth="1.4" />
            <line x1={sym.x + 12} y1={y + 16} x2={sym.x + sym.w - 12} y2={y + 16} strokeWidth="1.4" />
            <circle cx={sym.x + 12} cy={y + 8} r="8" />
            <circle cx={sym.x + sym.w - 12} cy={y + 8} r="8" />
          </g>
          <Caption x={sym.x + sym.w / 2} y={y + 36} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x + sym.w - 12} y={y + 34} tag={sym.drive ?? sym.tag} state={state} />
      </g>
    );
  }

  if (sym.k === "crusher") {
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <polygon points={`${sym.x},${sym.y} ${sym.x + 78},${sym.y} ${sym.x + 64},${sym.y + 86} ${sym.x + 14},${sym.y + 86}`} />
            <polygon points={`${sym.x + 39},${sym.y + 10} ${sym.x + 50},${sym.y + 74} ${sym.x + 28},${sym.y + 74}`} />
          </g>
          <Caption x={sym.x + 39} y={sym.y + 104} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x - 26} y={sym.y + 78} tag={sym.drive} state={state} />
      </g>
    );
  }

  if (sym.k === "mill") {
    const h = 58;
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={sym.x + 18} y={sym.y} width={sym.w - 36} height={h} />
            <ellipse cx={sym.x + 18} cy={sym.y + h / 2} rx="18" ry={h / 2} />
            <ellipse cx={sym.x + sym.w - 18} cy={sym.y + h / 2} rx="18" ry={h / 2} />
          </g>
          <Caption x={sym.x + sym.w / 2} y={sym.y + h + 18} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x + sym.w - 18} y={sym.y + h + 20} tag={sym.drive} state={state} />
      </g>
    );
  }

  if (sym.k === "pump") {
    const dir = sym.dir ?? "e";
    return (
      <g>
        <Hit tag={sym.tag}>
          <g transform={`translate(${sym.x} ${sym.y})`}>
            <PumpGlyph dir={dir} stroke={stroke} />
          </g>
          {dir === "n" ? <Caption x={sym.x} y={sym.y + 36} name={sym.name} tag={sym.tag} /> : (
            <g>
              <text x={sym.x + 20} y={sym.y + 36} fill={DIM} fontSize="10">{sym.name}</text>
              <text x={sym.x + 20} y={sym.y + 48} fill={INK} fontSize="10">{sym.tag}</text>
            </g>
          )}
        </Hit>
        {dir === "e" ? <Motor x={sym.x} y={sym.y + 40} tag={sym.drive ?? sym.tag} state={state} /> : null}
      </g>
    );
  }

  if (sym.k === "cyclone") {
    return (
      <Hit tag={sym.tag}>
        <g stroke={INK} fill={PAPER}>
          <rect x={sym.x} y={sym.y} width="46" height="18" />
          <polygon points={`${sym.x},${sym.y + 18} ${sym.x + 46},${sym.y + 18} ${sym.x + 30},${sym.y + 78} ${sym.x + 16},${sym.y + 78}`} />
          <line x1={sym.x + 23} y1={sym.y - 8} x2={sym.x + 23} y2={sym.y + 16} />
          <Caption x={sym.x + 23} y={sym.y + 96} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "cell") {
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={sym.x} y={sym.y} width="64" height="78" />
            <rect x={sym.x + 3} y={sym.y + 4} width="58" height="10" fill="#d7e0ea" opacity="0.28" stroke="none" />
            <line x1={sym.x + 32} y1={sym.y} x2={sym.x + 32} y2={sym.y + 62} />
            <path d={`M ${sym.x + 18} ${sym.y + 58} L ${sym.x + 32} ${sym.y + 68} L ${sym.x + 46} ${sym.y + 58}`} fill="none" />
          </g>
          <Caption x={sym.x + 32} y={sym.y + 96} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x + 32} y={sym.y - 16} tag={sym.drive} state={state} />
      </g>
    );
  }

  if (sym.k === "column") {
    return (
      <Hit tag={sym.tag}>
        <g stroke={INK} fill={PAPER}>
          <rect x={sym.x} y={sym.y} width="36" height="120" />
          <line x1={sym.x + 6} y1={sym.y + 30} x2={sym.x + 30} y2={sym.y + 30} strokeDasharray="3 2" />
          <line x1={sym.x + 6} y1={sym.y + 48} x2={sym.x + 30} y2={sym.y + 48} strokeDasharray="3 2" />
          <line x1={sym.x + 6} y1={sym.y + 66} x2={sym.x + 30} y2={sym.y + 66} strokeDasharray="3 2" />
          <Caption x={sym.x + 18} y={sym.y + 136} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "thickener") {
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <circle cx={sym.x} cy={sym.y} r={sym.r} />
            <line x1={sym.x - sym.r + 8} y1={sym.y} x2={sym.x + sym.r - 8} y2={sym.y} />
            <line x1={sym.x} y1={sym.y - sym.r + 8} x2={sym.x} y2={sym.y + sym.r - 8} />
            <circle cx={sym.x} cy={sym.y} r="7" />
          </g>
          <Caption x={sym.x} y={sym.y + sym.r + 18} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x + sym.r + 18} y={sym.y - sym.r + 16} tag={sym.drive} state={state} />
      </g>
    );
  }

  if (sym.k === "filter") {
    return (
      <g>
        <Hit tag={sym.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={sym.x} y={sym.y} width="86" height="54" />
            <line x1={sym.x + 8} y1={sym.y + 46} x2={sym.x + 78} y2={sym.y + 8} />
            <line x1={sym.x + 8} y1={sym.y + 32} x2={sym.x + 50} y2={sym.y + 8} />
            <line x1={sym.x + 28} y1={sym.y + 46} x2={sym.x + 78} y2={sym.y + 22} />
          </g>
          <Caption x={sym.x + 43} y={sym.y + 74} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={sym.x + 43} y={sym.y + 96} tag={sym.drive} state={state} />
      </g>
    );
  }

  if (sym.k === "fan" || sym.k === "compressor") {
    const side = sym.k === "fan" && sym.motor === "right";
    return (
      <g>
        <Hit tag={sym.tag}>
          <g transform={`translate(${sym.x} ${sym.y})`} stroke={stroke} fill={PAPER}>
            <circle r="18" strokeWidth="1.4" />
            <path d="M 0,-12 L 8,8 L -8,8 Z" />
            {sym.k === "compressor" ? <path d="M 6,-10 L 24,0 L 6,10 Z" /> : <path d="M -4,0 Q 8,-14 10,6" fill="none" />}
          </g>
          <Caption x={sym.x} y={sym.y + (side ? 40 : 64)} name={sym.name} tag={sym.tag} />
        </Hit>
        <Motor x={side ? sym.x + 36 : sym.x} y={side ? sym.y : sym.y + 40} tag={sym.drive ?? sym.tag} state={state} />
      </g>
    );
  }

  if (sym.k === "diesel") {
    return (
      <Hit tag={sym.tag}>
        <g stroke={stroke} fill={PAPER}>
          <rect x={sym.x} y={sym.y} width="88" height="40" />
          <polygon points={`${sym.x + 88},${sym.y + 8} ${sym.x + 108},${sym.y + 8} ${sym.x + 108},${sym.y + 20} ${sym.x + 88},${sym.y + 20}`} />
          <text x={sym.x + 44} y={sym.y + 25} textAnchor="middle" fill={stroke} fontSize="12">D</text>
          <Caption x={sym.x + 44} y={sym.y + 58} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "magnet") {
    return (
      <Hit tag={sym.tag}>
        <g fill="none" stroke={INK}>
          <path d={`M ${sym.x} ${sym.y + 22} L ${sym.x} ${sym.y + 8} Q ${sym.x + 18} ${sym.y - 10} ${sym.x + 36} ${sym.y + 8} L ${sym.x + 36} ${sym.y + 22}`} strokeWidth="3" />
          <Caption x={sym.x + 18} y={sym.y - 16} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  if (sym.k === "detector") {
    return (
      <Hit tag={sym.tag}>
        <g>
          <polygon points={`${sym.x},${sym.y} ${sym.x + 16},${sym.y + 14} ${sym.x},${sym.y + 28} ${sym.x - 16},${sym.y + 14}`} fill={PAPER} stroke={INK} />
          <text x={sym.x} y={sym.y + 18} textAnchor="middle" fill={INK} fontSize="8">MD</text>
          <Caption x={sym.x} y={sym.y + 44} name={sym.name} tag={sym.tag} />
        </g>
      </Hit>
    );
  }

  return (
    <Hit tag={sym.tag}>
      <g transform={`translate(${sym.x} ${sym.y})`}>
        <ValveGlyph form={sym.form} act={sym.act} />
      </g>
      <Caption x={sym.x} y={sym.y + 22} name={sym.name} tag={sym.tag} />
    </Hit>
  );
}

export function PidView({ sheet }: { sheet: Sheet }) {
  const { live } = usePlant();
  return (
    <div className="mimic-wrap">
      <svg className="pid" viewBox="0 0 1180 760">
        <rect width="1180" height="760" fill={PAPER} />
        <defs>
          {(Object.keys(FLUID) as Fluid[]).map((fluid) => (
            <marker key={fluid} id={`arr-${fluid}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={FLUID[fluid]} />
            </marker>
          ))}
        </defs>
        {sheet.pipes.map((pipe, index) => {
          const running = !pipe.run || motorOf(pipe.run, live) === "running";
          return (
            <path
              key={index}
              d={pipe.d}
              fill="none"
              stroke={FLUID[pipe.fluid]}
              strokeWidth={pipe.recycle ? 1.5 : 2.2}
              strokeDasharray={!running || pipe.recycle ? "7 5" : undefined}
              markerEnd={`url(#arr-${pipe.fluid})`}
            />
          );
        })}
        {sheet.signals?.map((d, index) => <path key={index} d={d} className="signal" />)}
        {sheet.syms.map((sym, index) => <SymbolMark key={sym.k + ("tag" in sym ? sym.tag : "") + index} sym={sym} live={live} />)}
        {sheet.pipes.map((pipe, index) => (
          pipe.label ? (
            <text key={`l${index}`} x={pipe.lx} y={pipe.ly} fill={INK} fontSize="12" fontStyle="italic" stroke={PAPER} strokeWidth="4" paintOrder="stroke">
              {pipe.label}
            </text>
          ) : null
        ))}
        <text x="24" y="744" fill={DIM} fontSize="11">{sheet.drawing} · ISA-5.1 symbols · arrows follow the process</text>
      </svg>
    </div>
  );
}

const cells = (from: number, count: number, prefix: string, x0: number, step: number, y: number, name: (i: number) => string): Sym[] =>
  Array.from({ length: count }, (_, i) => ({
    k: "cell" as const,
    tag: `${prefix}${from + i}`,
    name: name(i + 1),
    x: x0 + i * step,
    y,
    drive: `AG-${from + i}`,
  }));

export const SHEETS: Record<Exclude<AreaId, "sys">, Sheet> = {
  crush: {
    drawing: "PID-100-001",
    note: "ROM enters the bin, the apron feeder draws it through the gyratory, and the discharge conveyor leaves for the stockpile.",
    syms: [
      { k: "bin", tag: "BN-101", name: "ROM bin", x: 28, y: 200, w: 86, h: 160, level: "LIT-101" },
      { k: "belt", tag: "FE-101", name: "Apron feeder", x: 160, y: 242, w: 160, drive: "FE-101" },
      { k: "crusher", tag: "CR-101", name: "Gyratory", x: 370, y: 207, drive: "CR-101" },
      { k: "belt", tag: "CV-102", name: "Discharge conveyor", x: 500, y: 242, w: 500, drive: "CV-102" },
      { k: "fan", tag: "DC-101", name: "Dust collector", x: 409, y: 110, drive: "DC-101", motor: "right" },
      { k: "magnet", tag: "MA-101", name: "Magnet", x: 640, y: 168 },
      { k: "detector", tag: "MD-101", name: "Metal detector", x: 820, y: 178 },
      { k: "pump", tag: "PU-111", name: "Lube A", x: 500, y: 490, drive: "PU-111", dir: "n" },
      { k: "pump", tag: "PU-112", name: "Lube B", x: 640, y: 490, drive: "PU-112", dir: "n" },
      { k: "bubble", tag: "LIT-101", x: 71, y: 160, loc: "field" },
      { k: "bubble", tag: "FC-102", x: 240, y: 180, loc: "dcs" },
      { k: "bubble", tag: "WIT-102", x: 900, y: 180, loc: "field" },
    ],
    signals: ["M 71 175 V 200", "M 240 195 V 242", "M 900 195 V 242"],
    pipes: [
      { d: "M 114 250 H 160", fluid: "slurry", label: "ROM", lx: 118, ly: 240 },
      { d: "M 320 250 H 377", fluid: "slurry", run: "FE-101" },
      { d: "M 441 250 H 500", fluid: "slurry", label: "Crushed ore", lx: 448, ly: 232, run: "CR-101" },
      { d: "M 1000 250 H 1160", fluid: "slurry", label: "To stockpile", lx: 1008, ly: 240, run: "CV-102" },
      { d: "M 409 128 V 207", fluid: "air", label: "Dust", lx: 416, ly: 168, run: "DC-101" },
      { d: "M 658 190 V 242", fluid: "slurry", run: "CV-102" },
      { d: "M 820 206 V 242", fluid: "slurry", run: "CV-102" },
      { d: "M 640 468 V 400 H 409 V 293", fluid: "water", label: "Lube oil", lx: 430, ly: 360, run: "PU-111" },
      { d: "M 500 468 V 400", fluid: "water", run: "PU-112" },
    ],
  },
  stock: {
    drawing: "PID-200-001",
    note: "Crushed ore lands on the live pile. Feeders reclaim onto the collection conveyor, then the SAG-feed conveyor.",
    syms: [
      { k: "pile", tag: "ST-201", name: "Coarse ore stockpile", x: 150, y: 70, w: 380, h: 90, level: "LIT-201" },
      { k: "belt", tag: "FE-201A", name: "Feeder A", x: 175, y: 210, w: 100, drive: "FE-201A" },
      { k: "belt", tag: "FE-201B", name: "Feeder B", x: 295, y: 210, w: 100, drive: "FE-201B" },
      { k: "belt", tag: "FE-201C", name: "Feeder C", x: 415, y: 210, w: 100, drive: "FE-201C" },
      { k: "belt", tag: "CV-201", name: "Collection", x: 160, y: 340, w: 370, drive: "CV-201" },
      { k: "belt", tag: "CV-202", name: "SAG feed", x: 590, y: 340, w: 420, drive: "CV-202" },
      { k: "detector", tag: "MD-201", name: "Metal detector", x: 800, y: 250 },
      { k: "bubble", tag: "LIT-201", x: 200, y: 36, loc: "field" },
      { k: "bubble", tag: "WIT-202", x: 900, y: 280, loc: "field" },
    ],
    signals: ["M 200 51 V 70", "M 900 295 V 340"],
    pipes: [
      { d: "M 24 115 H 150", fluid: "slurry", label: "From crushing", lx: 28, ly: 104 },
      { d: "M 225 160 V 210", fluid: "slurry" },
      { d: "M 345 160 V 210", fluid: "slurry" },
      { d: "M 465 160 V 210", fluid: "slurry" },
      { d: "M 225 226 V 340", fluid: "slurry", run: "FE-201A" },
      { d: "M 345 226 V 340", fluid: "slurry", run: "FE-201B" },
      { d: "M 465 226 V 340", fluid: "slurry", run: "FE-201C" },
      { d: "M 530 348 H 590", fluid: "slurry", label: "Reclaim", lx: 536, ly: 338, run: "CV-201" },
      { d: "M 800 278 V 340", fluid: "slurry" },
      { d: "M 1010 348 H 1160", fluid: "slurry", label: "To SAG mill", lx: 1020, ly: 338, run: "CV-202" },
    ],
  },
  sag: {
    drawing: "PID-300-001",
    note: "SAG discharge drops into the sump. The lead cyclone pump feeds the cluster. Underflow is crushed and returned. Overflow leaves for the ball mill.",
    syms: [
      { k: "mill", tag: "ML-301", name: "SAG mill", x: 36, y: 96, w: 250, drive: "ML-301A" },
      { k: "tank", tag: "SU-301", name: "Mill sump", x: 360, y: 78, w: 78, h: 112, level: "LIT-301", fluid: "slurry" },
      { k: "pump", tag: "PU-321A", name: "Cyclone A", x: 530, y: 108, drive: "PU-321A" },
      { k: "pump", tag: "PU-321B", name: "Cyclone B", x: 530, y: 196, drive: "PU-321B" },
      { k: "cyclone", tag: "CY-301", name: "Cyclone cluster", x: 700, y: 84 },
      { k: "belt", tag: "CV-331", name: "Pebble conveyor", x: 36, y: 450, w: 320, drive: "CV-331" },
      { k: "crusher", tag: "CR-341", name: "Pebble crusher", x: 420, y: 416, drive: "CR-341" },
      { k: "valve", tag: "FV-301", name: "Dilution", x: 399, y: 270, form: "control", act: "air" },
      { k: "pump", tag: "PU-311A", name: "SAG lube", x: 150, y: 540, drive: "PU-311A", dir: "n" },
      { k: "bubble", tag: "LIT-301", x: 399, y: 48, loc: "field" },
      { k: "bubble", tag: "DIT-323", x: 760, y: 48, loc: "field" },
    ],
    signals: ["M 399 63 V 78", "M 723 48 V 76"],
    pipes: [
      { d: "M 8 125 H 36", fluid: "slurry", label: "From stockpile", lx: 12, ly: 84 },
      { d: "M 286 125 H 360", fluid: "slurry", label: "Discharge", lx: 292, ly: 116, run: "ML-301A" },
      { d: "M 438 108 H 514", fluid: "slurry", run: "PU-321A" },
      { d: "M 438 188 H 514", fluid: "slurry" },
      { d: "M 552 108 H 700", fluid: "slurry", label: "Cyclone feed", lx: 560, ly: 98, run: "PU-321A" },
      { d: "M 552 196 H 640 V 108", fluid: "slurry" },
      { d: "M 746 93 H 1160", fluid: "slurry", label: "Overflow to ball mill", lx: 760, ly: 84, run: "PU-321A" },
      { d: "M 723 162 V 400 H 459 V 416", fluid: "slurry", label: "Underflow", lx: 732, ly: 210, recycle: true },
      { d: "M 356 458 H 427", fluid: "slurry", label: "Pebbles", lx: 360, ly: 448, run: "CV-331" },
      { d: "M 459 502 V 590 H 16 V 125 H 36", fluid: "slurry", label: "Pebble return", lx: 180, ly: 580, recycle: true, run: "CR-341" },
      { d: "M 1160 270 H 412", fluid: "water", label: "Process water", lx: 900, ly: 260 },
      { d: "M 399 257 V 190", fluid: "water" },
      { d: "M 150 524 V 590 H 18 V 250 H 161 V 154", fluid: "water", label: "Lube", lx: 24, ly: 400, run: "PU-311A" },
    ],
  },
  ball: {
    drawing: "PID-400-001",
    note: "Ball-mill discharge is pumped to the cyclones. Overflow, sized near 150 µm, is the rougher feed. Underflow returns to the mill.",
    syms: [
      { k: "mill", tag: "ML-401", name: "Ball mill", x: 36, y: 110, w: 250, drive: "ML-401A" },
      { k: "tank", tag: "SU-401", name: "Mill sump", x: 360, y: 92, w: 78, h: 112, level: "LIT-401", fluid: "slurry" },
      { k: "pump", tag: "PU-421A", name: "Cyclone A", x: 530, y: 122, drive: "PU-421A" },
      { k: "pump", tag: "PU-421B", name: "Cyclone B", x: 530, y: 210, drive: "PU-421B" },
      { k: "cyclone", tag: "CY-401", name: "Cyclone cluster", x: 700, y: 98 },
      { k: "valve", tag: "FV-401", name: "Dilution", x: 399, y: 290, form: "control", act: "air" },
      { k: "pump", tag: "PU-411A", name: "Ball mill lube", x: 160, y: 280, drive: "PU-411A", dir: "n" },
      { k: "bubble", tag: "LIT-401", x: 399, y: 56, loc: "field" },
      { k: "bubble", tag: "AIT-401-P80", x: 760, y: 56, loc: "computer" },
    ],
    signals: ["M 399 71 V 92", "M 723 74 V 90"],
    pipes: [
      { d: "M 8 139 H 36", fluid: "slurry", label: "SAG overflow", lx: 12, ly: 96 },
      { d: "M 286 139 H 360", fluid: "slurry", label: "Discharge", lx: 292, ly: 130, run: "ML-401A" },
      { d: "M 438 122 H 514", fluid: "slurry", run: "PU-421A" },
      { d: "M 438 202 H 514", fluid: "slurry" },
      { d: "M 552 122 H 700", fluid: "slurry", label: "Cyclone feed", lx: 560, ly: 112, run: "PU-421A" },
      { d: "M 552 210 H 640 V 122", fluid: "slurry" },
      { d: "M 746 107 H 1160", fluid: "slurry", label: "Overflow to rougher", lx: 760, ly: 98, run: "PU-421A" },
      { d: "M 723 176 V 520 H 16 V 139 H 36", fluid: "slurry", label: "Underflow return", lx: 360, ly: 508, recycle: true },
      { d: "M 1160 290 H 412", fluid: "water", label: "Process water", lx: 860, ly: 280 },
      { d: "M 399 277 V 204", fluid: "water" },
      { d: "M 160 264 V 200 H 161 V 168", fluid: "water", label: "Lube", lx: 168, ly: 190, run: "PU-411A" },
    ],
  },
  rough: {
    drawing: "PID-500-001",
    note: "Conditioned slurry feeds eight rougher cells in series. Concentrate leaves along the top launder. Tails leave along the bottom to the thickener.",
    syms: [
      { k: "tank", tag: "TK-501", name: "Conditioner", x: 28, y: 172, w: 90, h: 110, level: "AIT-520", drive: "AG-520", agitator: true, fluid: "slurry" },
      { k: "pump", tag: "PU-501", name: "Feed", x: 200, y: 227, drive: "PU-501" },
      ...cells(501, 8, "FC-", 300, 84, 188, (i) => `Cell ${i}`),
      { k: "fan", tag: "BL-501A", name: "Blower A", x: 70, y: 500, drive: "BL-501A" },
      { k: "fan", tag: "BL-501B", name: "Blower B", x: 190, y: 500, drive: "BL-501B" },
      { k: "bubble", tag: "AIT-520", x: 73, y: 130, loc: "field" },
      { k: "bubble", tag: "PIT-510", x: 70, y: 430, loc: "field" },
    ],
    signals: ["M 73 145 V 158", "M 70 445 V 482"],
    pipes: [
      { d: "M 8 227 H 28", fluid: "slurry", label: "Overflow", lx: 124, ly: 216 },
      { d: "M 118 227 H 184", fluid: "slurry", run: "PU-501" },
      { d: "M 222 227 H 300", fluid: "slurry", label: "Rougher feed", lx: 226, ly: 216, run: "PU-501" },
      { d: "M 364 227 H 384", fluid: "slurry" },
      { d: "M 448 227 H 468", fluid: "slurry" },
      { d: "M 532 227 H 552", fluid: "slurry" },
      { d: "M 616 227 H 636", fluid: "slurry" },
      { d: "M 700 227 H 720", fluid: "slurry" },
      { d: "M 784 227 H 804", fluid: "slurry" },
      { d: "M 868 227 H 888", fluid: "slurry" },
      { d: "M 356 188 V 150 H 1140", fluid: "conc", label: "Concentrate to cleaner", lx: 620, ly: 142, run: "AG-501" },
      { d: "M 440 188 V 150", fluid: "conc" },
      { d: "M 524 188 V 150", fluid: "conc" },
      { d: "M 608 188 V 150", fluid: "conc" },
      { d: "M 692 188 V 150", fluid: "conc" },
      { d: "M 776 188 V 150", fluid: "conc" },
      { d: "M 860 188 V 150", fluid: "conc" },
      { d: "M 944 188 V 150", fluid: "conc" },
      { d: "M 332 266 V 340 H 1140", fluid: "tails", label: "Tails to thickener", lx: 140, ly: 332, run: "AG-501" },
      { d: "M 416 266 V 340", fluid: "tails" },
      { d: "M 500 266 V 340", fluid: "tails" },
      { d: "M 584 266 V 340", fluid: "tails" },
      { d: "M 668 266 V 340", fluid: "tails" },
      { d: "M 752 266 V 340", fluid: "tails" },
      { d: "M 836 266 V 340", fluid: "tails" },
      { d: "M 920 266 V 340", fluid: "tails" },
      { d: "M 88 500 H 12 V 118 H 1140", fluid: "air", label: "Flotation air", lx: 400, ly: 110, run: "BL-501A" },
      { d: "M 208 500 H 88", fluid: "air" },
    ],
  },
  clean: {
    drawing: "PID-600-001",
    note: "Regrind feeds four cleaners and two columns. Scavenger tails are pumped back upstream. Final concentrate leaves for the thickener.",
    syms: [
      { k: "mill", tag: "ML-601", name: "Regrind", x: 24, y: 70, w: 160, drive: "ML-601" },
      { k: "pump", tag: "PU-601", name: "Feed", x: 270, y: 99, drive: "PU-601" },
      ...cells(601, 4, "FC-", 360, 110, 60, (i) => `Cleaner ${i}`),
      { k: "column", tag: "COL-611", name: "Column 1", x: 820, y: 40 },
      { k: "column", tag: "COL-612", name: "Column 2", x: 920, y: 40 },
      ...cells(621, 4, "FC-", 24, 130, 400, (i) => `Scavenger ${i}`),
      { k: "pump", tag: "PU-631", name: "Return", x: 580, y: 439, drive: "PU-631" },
    ],
    pipes: [
      { d: "M 8 99 H 24", fluid: "conc", label: "Rougher concentrate", lx: 12, ly: 56 },
      { d: "M 184 99 H 254", fluid: "conc", run: "ML-601" },
      { d: "M 292 99 H 360", fluid: "conc", run: "PU-601" },
      { d: "M 424 99 H 470", fluid: "conc" },
      { d: "M 534 99 H 580", fluid: "conc" },
      { d: "M 644 99 H 690", fluid: "conc" },
      { d: "M 754 99 H 820", fluid: "conc", label: "Cleaner conc", lx: 758, ly: 48 },
      { d: "M 856 100 H 920", fluid: "conc" },
      { d: "M 956 100 H 1160", fluid: "conc", label: "To concentrate thickener", lx: 964, ly: 90 },
      { d: "M 392 138 V 360 H 56 V 400", fluid: "slurry", label: "Cleaner tails", lx: 400, ly: 250 },
      { d: "M 88 439 H 154", fluid: "slurry" },
      { d: "M 218 439 H 284", fluid: "slurry" },
      { d: "M 348 439 H 414", fluid: "slurry" },
      { d: "M 478 439 H 564", fluid: "slurry", run: "PU-631" },
      { d: "M 602 439 H 1000 V 250 H 12 V 99 H 24", fluid: "slurry", label: "Scavenger return", lx: 700, ly: 240, recycle: true, run: "PU-631" },
    ],
  },
  conc: {
    drawing: "PID-700-001",
    note: "Cleaner concentrate is thickened, filtered, and stacked on the covered pad.",
    syms: [
      { k: "thickener", tag: "TH-701", name: "Concentrate thickener", x: 120, y: 250, r: 62, drive: "TH-701" },
      { k: "pump", tag: "PU-701A", name: "Underflow A", x: 300, y: 210, drive: "PU-701A" },
      { k: "pump", tag: "PU-701B", name: "Underflow B", x: 300, y: 300, drive: "PU-701B" },
      { k: "filter", tag: "FL-701", name: "Disc filter", x: 480, y: 223, drive: "FL-701" },
      { k: "belt", tag: "CV-701", name: "Cake conveyor", x: 680, y: 242, w: 180, drive: "CV-701" },
      { k: "pile", tag: "BN-701", name: "Concentrate pad", x: 940, y: 190, w: 160, h: 110 },
      { k: "bubble", tag: "LIT-701", x: 120, y: 150, loc: "field" },
      { k: "bubble", tag: "AIT-710", x: 1020, y: 150, loc: "field" },
    ],
    signals: ["M 120 165 V 188", "M 1020 165 V 190"],
    pipes: [
      { d: "M 8 250 H 58", fluid: "conc", label: "From columns", lx: 12, ly: 200 },
      { d: "M 182 210 H 284", fluid: "conc", label: "Underflow", lx: 186, ly: 200, run: "PU-701A" },
      { d: "M 182 290 H 284", fluid: "conc" },
      { d: "M 322 210 H 400", fluid: "conc", run: "PU-701A" },
      { d: "M 322 300 H 400", fluid: "conc" },
      { d: "M 400 210 V 300", fluid: "conc" },
      { d: "M 400 250 H 480", fluid: "conc" },
      { d: "M 566 250 H 680", fluid: "conc", label: "Filter cake", lx: 572, ly: 240, run: "FL-701" },
      { d: "M 860 250 H 980", fluid: "conc", label: "To pad", lx: 868, ly: 240, run: "CV-701" },
    ],
  },
  tails: {
    drawing: "PID-800-001",
    note: "Rougher tails are thickened and pumped to the TSF. Return water is collected and sent back to the plant.",
    syms: [
      { k: "thickener", tag: "TH-801", name: "Tailings thickener", x: 130, y: 170, r: 64, drive: "TH-801" },
      { k: "pump", tag: "PU-801A", name: "TSF A", x: 320, y: 110, drive: "PU-801A" },
      { k: "pump", tag: "PU-801B", name: "TSF B", x: 320, y: 190, drive: "PU-801B" },
      { k: "pump", tag: "PU-801C", name: "TSF C", x: 320, y: 270, drive: "PU-801C" },
      { k: "tank", tag: "TK-851", name: "Return water", x: 720, y: 390, w: 130, h: 100, level: "LIT-851", fluid: "water" },
      { k: "pump", tag: "PU-851A", name: "Return A", x: 940, y: 415, drive: "PU-851A" },
      { k: "pump", tag: "PU-851B", name: "Return B", x: 940, y: 490, drive: "PU-851B" },
      { k: "bubble", tag: "LIT-801", x: 130, y: 70, loc: "field" },
      { k: "bubble", tag: "LIT-851", x: 785, y: 350, loc: "field" },
    ],
    signals: ["M 130 85 V 106", "M 785 365 V 390"],
    pipes: [
      { d: "M 8 170 H 66", fluid: "tails", label: "Rougher tails", lx: 12, ly: 120 },
      { d: "M 152 110 H 304", fluid: "tails", run: "PU-801A" },
      { d: "M 190 190 H 304", fluid: "tails", run: "PU-801B" },
      { d: "M 170 220 V 270 H 304", fluid: "tails" },
      { d: "M 342 110 H 420", fluid: "tails", run: "PU-801A" },
      { d: "M 342 190 H 420", fluid: "tails" },
      { d: "M 342 270 H 420", fluid: "tails" },
      { d: "M 420 110 V 270", fluid: "tails" },
      { d: "M 420 170 H 1160", fluid: "tails", label: "To TSF", lx: 980, ly: 160, run: "PU-801A" },
      { d: "M 130 234 V 440 H 720", fluid: "water", label: "Decant", lx: 360, ly: 430 },
      { d: "M 850 420 H 924", fluid: "water", run: "PU-851A" },
      { d: "M 850 480 H 924", fluid: "water" },
      { d: "M 962 415 H 1080", fluid: "water", run: "PU-851A" },
      { d: "M 962 490 H 1080 V 415", fluid: "water" },
      { d: "M 1080 415 H 1160", fluid: "water", label: "To process water", lx: 1000, ly: 404, run: "PU-851A" },
    ],
  },
  reag: {
    drawing: "PID-900-001",
    note: "Each reagent tank doses through its own pump onto the common header that feeds flotation. Lime pump A is the pH-loop output.",
    syms: [
      { k: "tank", tag: "SL-901", name: "Lime slaker", x: 40, y: 36, w: 80, h: 70, drive: "SL-901", agitator: true, fluid: "reag" },
      { k: "tank", tag: "TK-901", name: "Lime", x: 30, y: 150, w: 100, h: 110, level: "LIT-901", fluid: "reag" },
      { k: "tank", tag: "TK-902", name: "Collector", x: 280, y: 150, w: 100, h: 110, level: "LIT-902", fluid: "reag" },
      { k: "tank", tag: "TK-903", name: "Frother", x: 530, y: 150, w: 100, h: 110, level: "LIT-903", fluid: "reag" },
      { k: "tank", tag: "TK-904", name: "Depressant", x: 780, y: 150, w: 100, h: 110, level: "LIT-904", fluid: "reag" },
      { k: "pump", tag: "PU-901A", name: "Lime", x: 80, y: 360, drive: "PU-901A", dir: "n" },
      { k: "pump", tag: "PU-902A", name: "Collector", x: 330, y: 360, drive: "PU-902A", dir: "n" },
      { k: "pump", tag: "PU-903A", name: "Frother", x: 580, y: 360, drive: "PU-903A", dir: "n" },
      { k: "pump", tag: "PU-904A", name: "Depressant", x: 830, y: 360, drive: "PU-904A", dir: "n" },
      { k: "bubble", tag: "FIT-901", x: 140, y: 360, loc: "field" },
    ],
    signals: ["M 125 360 H 96"],
    pipes: [
      { d: "M 80 106 V 150", fluid: "reag", label: "Slaked lime", lx: 88, ly: 132, run: "SL-901" },
      { d: "M 80 260 V 344", fluid: "reag" },
      { d: "M 330 260 V 344", fluid: "reag" },
      { d: "M 580 260 V 344", fluid: "reag" },
      { d: "M 830 260 V 344", fluid: "reag" },
      { d: "M 80 376 V 470 H 1160", fluid: "reag", label: "To flotation", lx: 980, ly: 460, run: "PU-901A" },
      { d: "M 330 376 V 470", fluid: "reag" },
      { d: "M 580 376 V 470", fluid: "reag" },
      { d: "M 830 376 V 470", fluid: "reag" },
    ],
  },
  util: {
    drawing: "PID-950-001",
    note: "Process water, gland water, instrument air and cooling water each leave on their own header. The diesel feeds the essential board only.",
    syms: [
      { k: "tank", tag: "TK-951", name: "Process water", x: 28, y: 20, w: 100, h: 210, level: "LIT-951", fluid: "water" },
      { k: "pump", tag: "PU-951A", name: "Water A", x: 230, y: 56, drive: "PU-951A" },
      { k: "pump", tag: "PU-951B", name: "Water B", x: 230, y: 140, drive: "PU-951B" },
      { k: "pump", tag: "PU-951C", name: "Water C", x: 230, y: 210, drive: "PU-951C" },
      { k: "pump", tag: "PU-961A", name: "Gland A", x: 150, y: 300, drive: "PU-961A" },
      { k: "pump", tag: "PU-961B", name: "Gland B", x: 150, y: 380, drive: "PU-961B" },
      { k: "compressor", tag: "CA-971A", name: "Air A", x: 140, y: 530, drive: "CA-971A" },
      { k: "compressor", tag: "CA-971B", name: "Air B", x: 280, y: 530, drive: "CA-971B" },
      { k: "pump", tag: "PU-981", name: "Cooling water", x: 160, y: 660, drive: "PU-981" },
      { k: "diesel", tag: "EDG-991", name: "Diesel generator", x: 520, y: 680, drive: "EDG-991" },
      { k: "bubble", tag: "PIT-951", x: 360, y: 28, loc: "field" },
      { k: "bubble", tag: "PIT-971", x: 280, y: 450, loc: "field" },
    ],
    signals: ["M 360 43 V 56", "M 280 465 V 512"],
    pipes: [
      { d: "M 128 56 H 214", fluid: "water", run: "PU-951A" },
      { d: "M 128 140 H 214", fluid: "water" },
      { d: "M 128 210 H 214", fluid: "water" },
      { d: "M 252 56 H 310", fluid: "water", run: "PU-951A" },
      { d: "M 252 140 H 310", fluid: "water" },
      { d: "M 252 210 H 310", fluid: "water" },
      { d: "M 310 56 V 210", fluid: "water" },
      { d: "M 310 120 H 1160", fluid: "water", label: "Process water header", lx: 700, ly: 110, run: "PU-951A" },
      { d: "M 172 300 H 240", fluid: "water", run: "PU-961A" },
      { d: "M 172 380 H 240", fluid: "water" },
      { d: "M 240 300 V 380", fluid: "water" },
      { d: "M 240 340 H 1160", fluid: "water", label: "Gland water", lx: 700, ly: 330, run: "PU-961A" },
      { d: "M 164 530 H 220 V 610", fluid: "air", run: "CA-971A" },
      { d: "M 304 530 H 360 V 610", fluid: "air" },
      { d: "M 220 610 H 1160", fluid: "air", label: "Instrument air", lx: 700, ly: 600, run: "CA-971A" },
      { d: "M 182 660 H 1160", fluid: "water", label: "Cooling water", lx: 700, ly: 650, run: "PU-981" },
      { d: "M 628 696 H 1160", fluid: "slurry", label: "Essential board", lx: 700, ly: 686 },
    ],
  },
};

export function areaOfScreen(screen: string): Exclude<AreaId, "sys"> | null {
  return screen in SHEETS ? (screen as Exclude<AreaId, "sys">) : null;
}

export const SYMBOL_CARDS: { id: string; group: string; name: string; note: string }[] = [
  { id: "field", group: "Instruments", name: "Field instrument", note: "Circle. Transmitter or local indicator." },
  { id: "board", group: "Instruments", name: "Central control panel", note: "Circle with one horizontal line." },
  { id: "panel", group: "Instruments", name: "Local control panel", note: "Circle with two horizontal lines." },
  { id: "dcs", group: "Instruments", name: "Shared display, DCS", note: "Circle inside a square. Controller or drive value." },
  { id: "computer", group: "Instruments", name: "Computer function", note: "Diamond. Analyser or calculated point." },
  { id: "pump", group: "Pumps and drivers", name: "Centrifugal pump", note: "Circle and discharge nozzle, with the impeller." },
  { id: "motor", group: "Pumps and drivers", name: "Electric motor", note: "Circle marked M, on the shaft of the driven machine." },
  { id: "fan", group: "Pumps and drivers", name: "Centrifugal fan", note: "Circle with fan blades. Blowers use this symbol." },
  { id: "compressor", group: "Pumps and drivers", name: "Centrifugal compressor", note: "Scroll with a discharge nozzle." },
  { id: "diesel", group: "Pumps and drivers", name: "Diesel motor", note: "Engine block marked D, with the exhaust." },
  { id: "cv", group: "Valves", name: "Control valve", note: "Bowtie with a pneumatic diaphragm." },
  { id: "gate", group: "Valves", name: "Gate valve", note: "Bowtie with the gate drawn through the body." },
  { id: "globe", group: "Valves", name: "Globe valve", note: "Bowtie with a filled seat." },
  { id: "ball", group: "Valves", name: "Ball valve", note: "Bowtie with an open ball." },
  { id: "check", group: "Valves", name: "Check valve", note: "Flow triangle and a downstream stop." },
  { id: "butterfly", group: "Valves", name: "Butterfly valve", note: "Bowtie with the disc across the body." },
  { id: "vessel", group: "Vessels", name: "Open tank", note: "Open top. Sumps, conditioner and reagent tanks." },
  { id: "hopper", group: "Vessels", name: "Bin", note: "Hopper bottom. Used for the ROM bin." },
  { id: "crusher", group: "Process", name: "Cone crusher", note: "Outer shell and the mantle." },
  { id: "mill", group: "Process", name: "Tumbling mill", note: "Horizontal drum. SAG, ball and regrind." },
  { id: "conveyor", group: "Process", name: "Belt conveyor", note: "Head and tail pulleys with the belt." },
  { id: "cyclone", group: "Process", name: "Cyclone separator", note: "Body, cone and vortex finder." },
  { id: "cell", group: "Process", name: "Flotation cell and agitator", note: "Open cell, froth band and turbine impeller." },
  { id: "column", group: "Process", name: "Packed column", note: "Tall vessel with the packing marks." },
  { id: "thickener", group: "Process", name: "Thickener", note: "Plan view, rake arms and the centre well." },
  { id: "filter", group: "Process", name: "Filter", note: "Shell with the filter medium." },
  { id: "magnet", group: "Process", name: "Permanent magnet", note: "Horseshoe over the belt." },
  { id: "detector", group: "Process", name: "Specialty item", note: "Diamond. Tramp-metal detector." },
];

export function SymbolTile({ id }: { id: string }) {
  return (
    <svg viewBox="-60 -56 120 112" className="symbol-svg">
      <rect x="-60" y="-56" width="120" height="112" fill={PAPER} />
      {id === "field" ? <BubbleGlyph loc="field" alarm={false} /> : null}
      {id === "board" ? <BubbleGlyph loc="board" alarm={false} /> : null}
      {id === "panel" ? <BubbleGlyph loc="panel" alarm={false} /> : null}
      {id === "dcs" ? <BubbleGlyph loc="dcs" alarm={false} /> : null}
      {id === "computer" ? <BubbleGlyph loc="computer" alarm={false} /> : null}
      {id === "pump" ? <PumpGlyph dir="e" stroke={INK} /> : null}
      {id === "motor" ? <Motor x={0} y={0} state="running" /> : null}
      {id === "fan" ? (
        <g stroke={INK} fill={PAPER}><circle r="18" /><path d="M 0,-12 L 8,8 L -8,8 Z" /></g>
      ) : null}
      {id === "compressor" ? (
        <g stroke={INK} fill={PAPER}><circle r="16" /><path d="M 4,-9 L 24,0 L 4,9 Z" /></g>
      ) : null}
      {id === "diesel" ? (
        <g stroke={INK} fill={PAPER}><rect x="-30" y="-16" width="60" height="32" /><text y="5" textAnchor="middle" fontSize="12">D</text></g>
      ) : null}
      {id === "cv" ? <ValveGlyph form="control" act="air" /> : null}
      {id === "gate" ? <ValveGlyph form="gate" /> : null}
      {id === "globe" ? <ValveGlyph form="globe" /> : null}
      {id === "ball" ? <ValveGlyph form="ball" /> : null}
      {id === "check" ? <ValveGlyph form="check" /> : null}
      {id === "butterfly" ? <ValveGlyph form="butterfly" /> : null}
      {id === "vessel" ? (
        <g stroke={INK} fill={PAPER}><line x1="-22" y1="-30" x2="22" y2="-30" /><rect x="-22" y="-30" width="44" height="58" /></g>
      ) : null}
      {id === "hopper" ? (
        <g stroke={INK} fill={PAPER}><rect x="-20" y="-36" width="40" height="36" /><polygon points="-20,0 20,0 12,28 -12,28" /></g>
      ) : null}
      {id === "crusher" ? (
        <g stroke={INK} fill={PAPER}><polygon points="-28,-30 28,-30 18,30 -18,30" /><polygon points="0,-20 10,22 -10,22" /></g>
      ) : null}
      {id === "mill" ? (
        <g stroke={INK} fill={PAPER}><rect x="-24" y="-16" width="48" height="32" /><ellipse cx="-24" cy="0" rx="12" ry="16" /><ellipse cx="24" cy="0" rx="12" ry="16" /></g>
      ) : null}
      {id === "conveyor" ? (
        <g stroke={INK} fill={PAPER}><line x1="-30" y1="-8" x2="30" y2="-8" /><line x1="-30" y1="8" x2="30" y2="8" /><circle cx="-30" cy="0" r="8" /><circle cx="30" cy="0" r="8" /></g>
      ) : null}
      {id === "cyclone" ? (
        <g stroke={INK} fill={PAPER}><rect x="-16" y="-28" width="32" height="14" /><polygon points="-16,-14 16,-14 8,28 -8,28" /></g>
      ) : null}
      {id === "cell" ? (
        <g stroke={INK} fill={PAPER}><rect x="-22" y="-28" width="44" height="56" /><line x1="0" y1="-28" x2="0" y2="16" /><path d="M -12 12 L 0 22 L 12 12" fill="none" /></g>
      ) : null}
      {id === "column" ? (
        <g stroke={INK} fill={PAPER}><rect x="-12" y="-36" width="24" height="72" /><line x1="-8" y1="-10" x2="8" y2="-10" strokeDasharray="2 2" /></g>
      ) : null}
      {id === "thickener" ? (
        <g stroke={INK} fill={PAPER}><circle r="28" /><line x1="-20" y1="0" x2="20" y2="0" /><line x1="0" y1="-20" x2="0" y2="20" /><circle r="5" /></g>
      ) : null}
      {id === "filter" ? (
        <g stroke={INK} fill={PAPER}><rect x="-28" y="-18" width="56" height="36" /><line x1="-22" y1="12" x2="22" y2="-12" /></g>
      ) : null}
      {id === "magnet" ? <path d="M -16 16 L -16 0 Q 0 -24 16 0 L 16 16" fill="none" stroke={INK} strokeWidth="3" /> : null}
      {id === "detector" ? <polygon points="0,-16 16,0 0,16 -16,0" fill={PAPER} stroke={INK} /> : null}
    </svg>
  );
}
