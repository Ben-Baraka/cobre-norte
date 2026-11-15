import type { ReactNode } from "react";
import { MODEL } from "../model/build";
import type { AreaId, MotorState, Target } from "../model/types";
import { fmt, limitOf } from "./format";
import { usePlant } from "./state";

type Fluid = "slurry" | "water" | "conc" | "tails" | "reag" | "air";
type Loc = "field" | "board" | "panel" | "dcs" | "computer";
type Head = "dished" | "hopper" | "open" | "cone";
type ValveForm = "control" | "gate" | "globe" | "check" | "butterfly" | "ball";
type Act = "air" | "motor" | "solenoid" | "hand";

type Item =
  | { k: "line"; d: string; fluid: Fluid; run?: string; branch?: boolean }
  | { k: "signal"; d: string }
  | { k: "bubble"; x: number; y: number; tag: string; loc: Loc }
  | { k: "vessel"; x: number; y: number; w: number; h: number; tag: string; head: Head; fluid?: Fluid; level?: string; drive?: string; agitator?: boolean }
  | { k: "pump"; x: number; y: number; tag: string; drive?: string; dir?: "e" | "n" }
  | { k: "valve"; x: number; y: number; tag: string; form: ValveForm; act?: Act }
  | { k: "conveyor"; x: number; y: number; w: number; tag: string; drive?: string }
  | { k: "crusher"; x: number; y: number; tag: string; drive?: string }
  | { k: "mill"; x: number; y: number; w: number; tag: string; drive?: string }
  | { k: "cyclone"; x: number; y: number; tag: string }
  | { k: "cell"; x: number; y: number; tag: string; drive?: string }
  | { k: "column"; x: number; y: number; tag: string }
  | { k: "thickener"; x: number; y: number; r: number; tag: string; drive?: string }
  | { k: "filter"; x: number; y: number; tag: string; drive?: string }
  | { k: "fan"; x: number; y: number; tag: string; drive?: string }
  | { k: "compressor"; x: number; y: number; tag: string; drive?: string }
  | { k: "diesel"; x: number; y: number; tag: string; drive?: string }
  | { k: "magnet"; x: number; y: number; tag: string }
  | { k: "detector"; x: number; y: number; tag: string }
  | { k: "text"; x: number; y: number; text: string };

interface Sheet {
  note: string;
  drawing: string;
  items: Item[];
}

const INK = "#c5d2de";
const DIM = "#8ea0b3";
const PAPER = "#101820";

function stateColor(state?: MotorState): string {
  if (state === "running") return "#3cba7c";
  if (state === "starting" || state === "stopping") return "#e2b340";
  if (state === "tripped") return "#e15b5b";
  return "#8b97a6";
}

function motorOf(tag: string | undefined, motors: { state: MotorState }[]): MotorState | undefined {
  if (!tag) return undefined;
  const spec = MODEL.motorByTag.get(tag);
  return spec ? motors[spec.index].state : undefined;
}

function targetFor(tag: string): Target | null {
  if (MODEL.motorByTag.has(tag)) return { kind: "motor", tag };
  if (MODEL.equipByTag.has(tag)) return { kind: "equip", tag };
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

function Tag({ x, y, tag }: { x: number; y: number; tag: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fill={INK} fontSize="11">
      {tag}
    </text>
  );
}

function Motor({ x, y, tag, state }: { x: number; y: number; tag?: string; state?: MotorState }) {
  const stroke = stateColor(state);
  const body = (
    <g>
      <circle cx={x} cy={y} r="11" fill={PAPER} stroke={stroke} strokeWidth="1.4" />
      <text x={x} y={y + 4} textAnchor="middle" fill={stroke} fontSize="11" fontFamily="IBM Plex Mono, monospace">
        M
      </text>
    </g>
  );
  return tag ? <Hit tag={tag}>{body}</Hit> : body;
}

function BubbleGlyph({ loc, alarm }: { loc: Loc; alarm: boolean }) {
  const stroke = alarm ? "#e15b5b" : INK;
  if (loc === "computer") {
    return <polygon points="0,-18 16,0 0,18 -16,0" fill={PAPER} stroke={stroke} />;
  }
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
      ) : (
        bowtie()
      )}
      {form === "gate" ? <line x1="0" y1="-9" x2="0" y2="9" stroke={INK} /> : null}
      {form === "globe" ? <circle r="3.5" fill={INK} /> : null}
      {form === "ball" ? <circle r="4" fill={PAPER} stroke={INK} /> : null}
      {form === "butterfly" ? <line x1="-6" y1="-7" x2="6" y2="7" stroke={INK} /> : null}
    </g>
  );
}

function PumpGlyph({ dir, stroke }: { dir: "e" | "n"; stroke: string }) {
  const rot = dir === "n" ? -90 : 0;
  return (
    <g transform={`rotate(${rot})`} stroke={stroke}>
      <circle r="16" fill={PAPER} strokeWidth="1.4" />
      <path d="M 4,-9 L 22,0 L 4,9 Z" fill={PAPER} strokeWidth="1.4" />
      <path d="M -8,5 Q 0,-6 7,4" fill="none" strokeWidth="1.2" />
    </g>
  );
}

function levelFill(w: number, h: number, level: number | undefined, fluid?: Fluid) {
  const pct = level == null ? 0.45 : Math.max(0.04, Math.min(0.96, level / 100));
  const color = fluid === "water" ? "#1f6f8a" : fluid === "conc" ? "#c4893a" : fluid === "tails" ? "#6a6158" : fluid === "reag" ? "#5f6b38" : "#8a5a32";
  const top = h * (1 - pct);
  return <rect x="3" y={top} width={w - 6} height={h * pct - 3} fill={color} opacity="0.85" />;
}

export function PidView({ sheet }: { sheet: Sheet }) {
  const { live } = usePlant();
  return (
    <div className="mimic-wrap">
      <svg className="pid" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="#0c141b" />
        {sheet.items.filter((item) => item.k === "line" || item.k === "signal").map((item, i) => {
          if (item.k === "signal") return <path key={i} d={item.d} className="signal" />;
          const running = !item.run || motorOf(item.run, live.motors) === "running";
          const cls = `pipe ${item.fluid}${item.branch ? " branch" : ""}${running ? " flow" : ""}`;
          return <path key={i} d={item.d} className={cls} />;
        })}
        {sheet.items.map((item, i) => (
          <SheetItem key={i} item={item} />
        ))}
        <g>
          <rect x="968" y="648" width="292" height="58" fill={PAPER} stroke="#2c3d4e" />
          <text x="980" y="666" fill={INK} fontSize="11">COBRE NORTE · TRAINING P&ID</text>
          <text x="980" y="682" fill={DIM} fontSize="11">{sheet.drawing} · REV A</text>
          <text x="980" y="698" fill={DIM} fontSize="10">ISA-5.1 symbols · sample data</text>
        </g>
      </svg>
      <div className="legend">
        <span><i className="sw run" /> Running</span>
        <span><i className="sw stop" /> Stopped</span>
        <span><i className="sw trip" /> Tripped</span>
        <span><i className="sw slurry" /> Slurry</span>
        <span><i className="sw water" /> Water</span>
        <span><i className="sw air" /> Air</span>
        <span>Circle, field. Line through the circle, central panel. Square and circle, DCS. Diamond, computer. Dashed line, electrical signal.</span>
      </div>
    </div>
  );
}

function SheetItem({ item }: { item: Item }) {
  const { live } = usePlant();
  if (item.k === "line" || item.k === "signal") return null;
  if (item.k === "text") {
    return (
      <text x={item.x} y={item.y} fill={DIM} fontSize="11">
        {item.text}
      </text>
    );
  }
  if (item.k === "bubble") {
    const loop = MODEL.loopById.get(item.tag);
    const point = MODEL.byTag.get(item.tag) ?? (loop ? MODEL.byTag.get(loop.pv) : undefined);
    const value = point ? live.values[point.index] : undefined;
    const shown = loop ? live.loops[loop.index].sp : value;
    const alarm = point && value != null && (limitOf(point, value) != null || (point.alarmWhen != null && (value >= 0.5 ? 1 : 0) === point.alarmWhen));
    const [fn, ...rest] = item.tag.split("-");
    const num = rest.join("-");
    const click = point?.tag ?? item.tag;
    return (
      <Hit tag={click}>
        <g transform={`translate(${item.x} ${item.y})`}>
          <BubbleGlyph loc={item.loc} alarm={!!alarm} />
          <text y={num ? -1 : 3} textAnchor="middle" fill={INK} fontSize="8">{fn}</text>
          {num ? <text y="9" textAnchor="middle" fill={DIM} fontSize="7">{num.length > 8 ? num.slice(0, 8) : num}</text> : null}
          {point && shown != null ? (
            <text y="-22" textAnchor="middle" fill={alarm ? "#ffb4b4" : "#79d0e6"} fontSize="10" fontFamily="IBM Plex Mono, monospace">
              {fmt(shown, point.dec)}
            </text>
          ) : null}
        </g>
      </Hit>
    );
  }

  const drive = "drive" in item ? item.drive : undefined;
  const state = motorOf(drive, live.motors);
  const stroke = stateColor(state);

  if (item.k === "vessel") {
    const { x, y, w, h } = item;
    const lvl = item.level ? live.values[MODEL.byTag.get(item.level)?.index ?? -1] : undefined;
    return (
      <Hit tag={item.tag}>
        <g>
          {item.head === "hopper" ? (
            <>
              <rect x={x} y={y} width={w} height={h * 0.62} fill={PAPER} stroke={stroke} />
              <polygon points={`${x},${y + h * 0.62} ${x + w},${y + h * 0.62} ${x + w * 0.72},${y + h} ${x + w * 0.28},${y + h}`} fill={PAPER} stroke={stroke} />
            </>
          ) : null}
          {item.head === "cone" ? (
            <>
              <polygon points={`${x + w / 2},${y} ${x},${y + 28} ${x + w},${y + 28}`} fill={PAPER} stroke={stroke} />
              <rect x={x} y={y + 28} width={w} height={h - 40} fill={PAPER} stroke={stroke} />
              <ellipse cx={x + w / 2} cy={y + h - 12} rx={w / 2} ry="12" fill={PAPER} stroke={stroke} />
            </>
          ) : null}
          {item.head === "open" || item.head === "dished" ? (
            <>
              {item.head === "dished" ? <ellipse cx={x + w / 2} cy={y + 12} rx={w / 2} ry="12" fill={PAPER} stroke={stroke} /> : <line x1={x} y1={y + 8} x2={x + w} y2={y + 8} stroke={stroke} />}
              <rect x={x} y={y + 12} width={w} height={h - 24} fill={PAPER} stroke={stroke} />
              <ellipse cx={x + w / 2} cy={y + h - 12} rx={w / 2} ry="12" fill={PAPER} stroke={stroke} />
              {levelFill(w, h - 24, lvl, item.fluid) && (
                <g transform={`translate(${x} ${y + 12})`}>{levelFill(w, h - 24, lvl, item.fluid)}</g>
              )}
            </>
          ) : null}
          {item.agitator ? (
            <g>
              <line x1={x + w / 2} y1={y + 4} x2={x + w / 2} y2={y + h - 28} stroke={stroke} />
              <path d={`M ${x + w / 2 - 16} ${y + h - 36} L ${x + w / 2} ${y + h - 28} L ${x + w / 2 + 16} ${y + h - 36}`} fill="none" stroke={stroke} />
              <Motor x={x + w / 2} y={y - 16} tag={item.drive} state={state} />
            </g>
          ) : null}
          <Tag x={x + w / 2} y={y + h + 16} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  if (item.k === "pump") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g transform={`translate(${item.x} ${item.y})`}>
            <PumpGlyph dir={item.dir ?? "e"} stroke={stroke} />
          </g>
          <Tag x={item.x} y={item.y + 64} tag={item.tag} />
        </Hit>
        <Motor x={item.x} y={item.y + 40} tag={item.drive ?? item.tag} state={state} />
      </g>
    );
  }

  if (item.k === "valve") {
    return (
      <Hit tag={item.tag}>
        <g transform={`translate(${item.x} ${item.y})`}>
          <ValveGlyph form={item.form} act={item.act} />
          <Tag x={0} y={22} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  if (item.k === "conveyor") {
    const y = item.y;
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <line x1={item.x + 12} y1={y} x2={item.x + item.w - 12} y2={y} strokeWidth="1.4" />
            <line x1={item.x + 12} y1={y + 16} x2={item.x + item.w - 12} y2={y + 16} strokeWidth="1.4" />
            <circle cx={item.x + 12} cy={y + 8} r="8" />
            <circle cx={item.x + item.w - 12} cy={y + 8} r="8" />
          </g>
          <Tag x={item.x + item.w / 2} y={y + 36} tag={item.tag} />
        </Hit>
        <Motor x={item.x + item.w - 12} y={y + 32} tag={item.drive ?? item.tag} state={state} />
      </g>
    );
  }

  if (item.k === "crusher") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <polygon points={`${item.x}, ${item.y} ${item.x + 78}, ${item.y} ${item.x + 64}, ${item.y + 86} ${item.x + 14}, ${item.y + 86}`} />
            <polygon points={`${item.x + 39}, ${item.y + 10} ${item.x + 50}, ${item.y + 74} ${item.x + 28}, ${item.y + 74}`} />
          </g>
          <Tag x={item.x + 39} y={item.y + 104} tag={item.tag} />
        </Hit>
        <Motor x={item.x + 100} y={item.y + 40} tag={item.drive} state={state} />
      </g>
    );
  }

  if (item.k === "mill") {
    const h = 58;
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={item.x + 18} y={item.y} width={item.w - 36} height={h} />
            <ellipse cx={item.x + 18} cy={item.y + h / 2} rx="18" ry={h / 2} />
            <ellipse cx={item.x + item.w - 18} cy={item.y + h / 2} rx="18" ry={h / 2} />
          </g>
          <Tag x={item.x + item.w / 2} y={item.y + h + 16} tag={item.tag} />
        </Hit>
        <Motor x={item.x + item.w - 18} y={item.y + h + 18} tag={item.drive} state={state} />
      </g>
    );
  }

  if (item.k === "cyclone") {
    return (
      <Hit tag={item.tag}>
        <g stroke={INK} fill={PAPER}>
          <rect x={item.x} y={item.y} width="46" height="18" />
          <polygon points={`${item.x},${item.y + 18} ${item.x + 46},${item.y + 18} ${item.x + 30},${item.y + 78} ${item.x + 16},${item.y + 78}`} />
          <line x1={item.x + 23} y1={item.y - 10} x2={item.x + 23} y2={item.y + 16} />
          <Tag x={item.x + 23} y={item.y + 96} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  if (item.k === "cell") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={item.x} y={item.y} width="64" height="78" />
            <rect x={item.x + 3} y={item.y + 4} width="58" height="10" fill="#d7e0ea" opacity="0.25" stroke="none" />
            <line x1={item.x + 32} y1={item.y} x2={item.x + 32} y2={item.y + 62} />
            <path d={`M ${item.x + 18} ${item.y + 58} L ${item.x + 32} ${item.y + 68} L ${item.x + 46} ${item.y + 58}`} fill="none" />
          </g>
          <Tag x={item.x + 32} y={item.y + 94} tag={item.tag} />
        </Hit>
        <Motor x={item.x + 32} y={item.y - 16} tag={item.drive} state={state} />
      </g>
    );
  }

  if (item.k === "column") {
    return (
      <Hit tag={item.tag}>
        <g stroke={INK} fill={PAPER}>
          <rect x={item.x} y={item.y} width="36" height="120" />
          <line x1={item.x + 6} y1={item.y + 30} x2={item.x + 30} y2={item.y + 30} strokeDasharray="3 2" />
          <line x1={item.x + 6} y1={item.y + 48} x2={item.x + 30} y2={item.y + 48} strokeDasharray="3 2" />
          <line x1={item.x + 6} y1={item.y + 66} x2={item.x + 30} y2={item.y + 66} strokeDasharray="3 2" />
          <Tag x={item.x + 18} y={item.y + 136} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  if (item.k === "thickener") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <circle cx={item.x} cy={item.y} r={item.r} />
            <line x1={item.x - item.r + 8} y1={item.y} x2={item.x + item.r - 8} y2={item.y} />
            <line x1={item.x} y1={item.y - item.r + 8} x2={item.x} y2={item.y + item.r - 8} />
            <circle cx={item.x} cy={item.y} r="7" />
          </g>
        </Hit>
        <Motor x={item.x + item.r + 20} y={item.y} tag={item.drive} state={state} />
        <Tag x={item.x} y={item.y + item.r + 18} tag={item.tag} />
      </g>
    );
  }

  if (item.k === "filter") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={item.x} y={item.y} width="86" height="54" />
            <line x1={item.x + 8} y1={item.y + 46} x2={item.x + 78} y2={item.y + 8} />
            <line x1={item.x + 8} y1={item.y + 32} x2={item.x + 50} y2={item.y + 8} />
            <line x1={item.x + 28} y1={item.y + 46} x2={item.x + 78} y2={item.y + 22} />
          </g>
        </Hit>
        <Motor x={item.x + 43} y={item.y + 78} tag={item.drive} state={state} />
        <Tag x={item.x + 43} y={item.y + 104} tag={item.tag} />
      </g>
    );
  }

  if (item.k === "fan" || item.k === "compressor") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g transform={`translate(${item.x} ${item.y})`} stroke={stroke} fill={PAPER}>
            <circle r="18" strokeWidth="1.4" />
            <path d="M 0,-12 L 8,8 L -8,8 Z" />
            {item.k === "compressor" ? <path d="M 6,-10 L 24,0 L 6,10 Z" /> : <path d="M -4,0 Q 8,-14 10,6" fill="none" />}
          </g>
        </Hit>
        <Motor x={item.x} y={item.y + 40} tag={item.drive ?? item.tag} state={state} />
        <Tag x={item.x} y={item.y + 64} tag={item.tag} />
      </g>
    );
  }

  if (item.k === "diesel") {
    return (
      <g>
        <Hit tag={item.tag}>
          <g stroke={stroke} fill={PAPER}>
            <rect x={item.x} y={item.y} width="88" height="40" />
            <polygon points={`${item.x + 88},${item.y + 8} ${item.x + 108},${item.y + 8} ${item.x + 108},${item.y + 20} ${item.x + 88},${item.y + 20}`} />
            <text x={item.x + 44} y={item.y + 25} textAnchor="middle" fill={stroke} fontSize="12">D</text>
          </g>
        </Hit>
        <Tag x={item.x + 44} y={item.y + 58} tag={item.tag} />
      </g>
    );
  }

  if (item.k === "magnet") {
    return (
      <Hit tag={item.tag}>
        <g stroke={INK} fill="none">
          <path d={`M ${item.x} ${item.y + 22} L ${item.x} ${item.y + 8} Q ${item.x + 18} ${item.y - 10} ${item.x + 36} ${item.y + 8} L ${item.x + 36} ${item.y + 22}`} strokeWidth="3" />
          <Tag x={item.x + 18} y={item.y + 38} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  if (item.k === "detector") {
    return (
      <Hit tag={item.tag}>
        <g>
          <polygon points={`${item.x},${item.y} ${item.x + 16},${item.y + 14} ${item.x},${item.y + 28} ${item.x - 16},${item.y + 14}`} fill={PAPER} stroke={INK} />
          <text x={item.x} y={item.y + 18} textAnchor="middle" fill={INK} fontSize="8">MD</text>
          <Tag x={item.x} y={item.y + 44} tag={item.tag} />
        </g>
      </Hit>
    );
  }

  return null;
}

export const SHEETS: Record<Exclude<AreaId, "sys">, Sheet> = {
  crush: {
    drawing: "PID-100-001",
    note: "Primary crushing P&ID. Field bubbles are the transmitters. FC-102 is the DCS feeder controller. DC-101 starts tripped.",
    items: [
      { k: "line", d: "M 90 250 H 230", fluid: "slurry", run: "FE-101" },
      { k: "line", d: "M 310 250 H 430", fluid: "slurry", run: "CR-101" },
      { k: "line", d: "M 1180 244 H 1240", fluid: "slurry", run: "CV-102" },
      { k: "signal", d: "M 36 120 H 70" },
      { k: "signal", d: "M 250 360 H 400" },
      { k: "signal", d: "M 980 180 V 230" },
      { k: "vessel", x: 40, y: 70, w: 90, h: 160, tag: "BN-101", head: "hopper", fluid: "slurry", level: "LIT-101" },
      { k: "bubble", x: 18, y: 120, tag: "LIT-101", loc: "field" },
      { k: "conveyor", x: 36, y: 242, w: 120, tag: "FE-101", drive: "FE-101" },
      { k: "crusher", x: 230, y: 150, tag: "CR-101", drive: "CR-101" },
      { k: "bubble", x: 210, y: 400, tag: "ZT-114", loc: "field" },
      { k: "bubble", x: 400, y: 150, tag: "VT-115", loc: "field" },
      { k: "bubble", x: 430, y: 360, tag: "EI-CR-101", loc: "dcs" },
      { k: "bubble", x: 560, y: 360, tag: "FC-102", loc: "dcs" },
      { k: "pump", x: 150, y: 470, tag: "PU-111", drive: "PU-111" },
      { k: "pump", x: 250, y: 470, tag: "PU-112", drive: "PU-112" },
      { k: "bubble", x: 360, y: 470, tag: "PIT-111", loc: "field" },
      { k: "text", x: 130, y: 560, text: "Crusher lube, duty / standby" },
      { k: "fan", x: 280, y: 70, tag: "DC-101", drive: "DC-101" },
      { k: "text", x: 250, y: 48, text: "Dust collector" },
      { k: "conveyor", x: 430, y: 236, w: 760, tag: "CV-102", drive: "CV-102" },
      { k: "magnet", x: 640, y: 180, tag: "MA-101" },
      { k: "detector", x: 820, y: 186, tag: "MD-101" },
      { k: "bubble", x: 980, y: 180, tag: "WIT-102", loc: "field" },
      { k: "bubble", x: 820, y: 130, tag: "XA-MD-101", loc: "field" },
      { k: "text", x: 430, y: 300, text: "Discharge to stockpile. Pull-wire and belt alignment trip CV-102." },
    ],
  },
  stock: {
    drawing: "PID-200-001",
    note: "Coarse-ore stockpile P&ID. Feeders A and C draw. Feeder B is standby. The tramp-metal diamond on CV-202 stays latched until it is reset.",
    items: [
      { k: "line", d: "M 20 120 H 160", fluid: "slurry", run: "CV-102" },
      { k: "line", d: "M 200 300 H 700", fluid: "slurry", run: "CV-201" },
      { k: "line", d: "M 760 300 H 1200", fluid: "slurry", run: "CV-202" },
      { k: "vessel", x: 160, y: 70, w: 280, h: 150, tag: "ST-201", head: "open", fluid: "slurry", level: "LIT-201" },
      { k: "bubble", x: 470, y: 110, tag: "LIT-201", loc: "field" },
      { k: "text", x: 180, y: 60, text: "Open stockpile, 18,000 t live pocket" },
      { k: "conveyor", x: 190, y: 250, w: 80, tag: "FE-201A", drive: "FE-201A" },
      { k: "conveyor", x: 290, y: 250, w: 80, tag: "FE-201B", drive: "FE-201B" },
      { k: "conveyor", x: 390, y: 250, w: 80, tag: "FE-201C", drive: "FE-201C" },
      { k: "conveyor", x: 180, y: 360, w: 460, tag: "CV-201", drive: "CV-201" },
      { k: "conveyor", x: 700, y: 360, w: 460, tag: "CV-202", drive: "CV-202" },
      { k: "detector", x: 1040, y: 300, tag: "MD-201" },
      { k: "bubble", x: 1040, y: 250, tag: "XA-MD-201", loc: "field" },
      { k: "bubble", x: 980, y: 470, tag: "WIT-202", loc: "field" },
      { k: "bubble", x: 820, y: 470, tag: "FC-202", loc: "dcs" },
      { k: "text", x: 180, y: 470, text: "Reclaim A and C running. B is the standby feeder. FC-202 trims the SAG feed." },
    ],
  },
  sag: {
    drawing: "PID-300-001",
    note: "SAG circuit P&ID. LC-301 is the sump controller in the DCS. DC-323 moves the dilution valve. Both pinions share one start command.",
    items: [
      { k: "line", d: "M 20 160 H 70", fluid: "slurry", run: "CV-202" },
      { k: "line", d: "M 400 160 H 470", fluid: "slurry", run: "ML-301A" },
      { k: "line", d: "M 560 150 H 690", fluid: "slurry", run: "PU-321A" },
      { k: "line", d: "M 760 80 H 900", fluid: "water", run: "PU-951A", branch: true },
      { k: "line", d: "M 70 430 H 300", fluid: "slurry", run: "CV-331" },
      { k: "signal", d: "M 500 340 H 700" },
      { k: "signal", d: "M 860 200 H 980" },
      { k: "mill", x: 70, y: 120, w: 330, tag: "ML-301", drive: "ML-301A" },
      { k: "text", x: 70, y: 110, text: "36 ft × 20 ft · twin pinion · ML-301B paired" },
      { k: "bubble", x: 110, y: 310, tag: "EI-ML-301A", loc: "dcs" },
      { k: "bubble", x: 250, y: 310, tag: "EI-ML-301B", loc: "dcs" },
      { k: "bubble", x: 390, y: 310, tag: "TIT-311A", loc: "field" },
      { k: "vessel", x: 470, y: 90, w: 70, h: 120, tag: "SU-301", head: "open", fluid: "slurry", level: "LIT-301" },
      { k: "bubble", x: 500, y: 340, tag: "LIT-301", loc: "field" },
      { k: "bubble", x: 700, y: 340, tag: "LC-301", loc: "dcs" },
      { k: "pump", x: 620, y: 120, tag: "PU-321A", drive: "PU-321A" },
      { k: "pump", x: 620, y: 250, tag: "PU-321B", drive: "PU-321B" },
      { k: "text", x: 660, y: 250, text: "Standby" },
      { k: "cyclone", x: 700, y: 70, tag: "CY-301" },
      { k: "bubble", x: 790, y: 70, tag: "DIT-323", loc: "field" },
      { k: "bubble", x: 790, y: 130, tag: "PIT-322", loc: "field" },
      { k: "bubble", x: 980, y: 70, tag: "FIT-321", loc: "field" },
      { k: "bubble", x: 980, y: 140, tag: "DC-323", loc: "dcs" },
      { k: "valve", x: 860, y: 200, tag: "FV-301", form: "control", act: "air" },
      { k: "text", x: 820, y: 240, text: "Dilution water, fail closed" },
      { k: "conveyor", x: 40, y: 470, w: 280, tag: "CV-331", drive: "CV-331" },
      { k: "crusher", x: 380, y: 430, tag: "CR-341", drive: "CR-341" },
      { k: "text", x: 380, y: 420, text: "Pebble crusher" },
      { k: "pump", x: 620, y: 500, tag: "PU-311A", drive: "PU-311A" },
      { k: "bubble", x: 760, y: 500, tag: "PIT-311", loc: "field" },
      { k: "text", x: 600, y: 590, text: "SAG lube. Below 140 kPa for 3 s trips both pinions." },
    ],
  },
  ball: {
    drawing: "PID-400-001",
    note: "Ball-mill P&ID. LC-401 holds the sump. Cyclone overflow is the rougher feed, with P80 on AIT-401.",
    items: [
      { k: "line", d: "M 20 180 H 80", fluid: "slurry", run: "PU-321A" },
      { k: "line", d: "M 430 180 H 520", fluid: "slurry", run: "ML-401A" },
      { k: "line", d: "M 620 160 H 760", fluid: "slurry", run: "PU-421A" },
      { k: "line", d: "M 860 120 H 1000", fluid: "water", run: "PU-951A", branch: true },
      { k: "mill", x: 80, y: 140, w: 340, tag: "ML-401", drive: "ML-401A" },
      { k: "text", x: 80, y: 130, text: "22 ft × 36 ft · ML-401B paired" },
      { k: "bubble", x: 100, y: 280, tag: "EI-ML-401A", loc: "dcs" },
      { k: "bubble", x: 280, y: 280, tag: "EI-ML-401B", loc: "dcs" },
      { k: "vessel", x: 500, y: 120, w: 70, h: 110, tag: "SU-401", head: "open", fluid: "slurry", level: "LIT-401" },
      { k: "bubble", x: 530, y: 270, tag: "LIT-401", loc: "field" },
      { k: "bubble", x: 680, y: 300, tag: "LC-401", loc: "dcs" },
      { k: "pump", x: 660, y: 140, tag: "PU-421A", drive: "PU-421A" },
      { k: "pump", x: 660, y: 250, tag: "PU-421B", drive: "PU-421B" },
      { k: "cyclone", x: 780, y: 80, tag: "CY-401" },
      { k: "bubble", x: 880, y: 70, tag: "DIT-423", loc: "field" },
      { k: "bubble", x: 1080, y: 70, tag: "AIT-401-P80", loc: "field" },
      { k: "bubble", x: 880, y: 140, tag: "FIT-421", loc: "field" },
      { k: "bubble", x: 1080, y: 140, tag: "PIT-422", loc: "field" },
      { k: "bubble", x: 980, y: 220, tag: "DC-423", loc: "dcs" },
      { k: "valve", x: 960, y: 280, tag: "FV-401", form: "control", act: "air" },
      { k: "text", x: 900, y: 320, text: "Dilution, fail closed" },
      { k: "pump", x: 160, y: 460, tag: "PU-411A", drive: "PU-411A" },
      { k: "bubble", x: 300, y: 460, tag: "PIT-411", loc: "field" },
      { k: "text", x: 140, y: 560, text: "Ball-mill lube. Header under 140 kPa trips both pinions after 3 s." },
      { k: "text", x: 780, y: 400, text: "Overflow to rougher conditioner" },
    ],
  },
  rough: {
    drawing: "PID-500-001",
    note: "Rougher P&ID. Cell 1 is drawn with its level and air loops. Cells 2 to 8 repeat that loop. AC-520 is the conditioner pH controller.",
    items: [
      { k: "line", d: "M 40 180 H 150", fluid: "slurry", run: "PU-501" },
      { k: "line", d: "M 230 180 H 1180", fluid: "slurry", run: "AG-501" },
      { k: "line", d: "M 40 40 H 1180", fluid: "air", run: "BL-501A", branch: true },
      { k: "vessel", x: 30, y: 80, w: 70, h: 130, tag: "TK-501", head: "open", fluid: "slurry", level: "LIT-520", agitator: true, drive: "AG-520" },
      { k: "bubble", x: 20, y: 250, tag: "LIT-520", loc: "field" },
      { k: "bubble", x: 160, y: 250, tag: "AIT-520", loc: "field" },
      { k: "bubble", x: 300, y: 250, tag: "AC-520", loc: "dcs" },
      { k: "pump", x: 150, y: 140, tag: "PU-501", drive: "PU-501" },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        k: "cell" as const,
        x: 250 + i * 120,
        y: 90,
        tag: `FC-${501 + i}`,
        drive: `AG-${501 + i}`,
      })),
      { k: "bubble", x: 300, y: 300, tag: "LIT-501", loc: "field" },
      { k: "bubble", x: 430, y: 300, tag: "LC-501", loc: "dcs" },
      { k: "valve", x: 282, y: 230, tag: "LV-501", form: "control", act: "air" },
      { k: "bubble", x: 560, y: 40, tag: "FIT-501", loc: "field" },
      { k: "valve", x: 700, y: 40, tag: "FV-501", form: "control", act: "air" },
      { k: "text", x: 760, y: 230, text: "Cells 2–8: same LIT / LC / LV / FIT / FV" },
      { k: "fan", x: 80, y: 400, tag: "BL-501A", drive: "BL-501A" },
      { k: "fan", x: 200, y: 400, tag: "BL-501B", drive: "BL-501B" },
      { k: "bubble", x: 340, y: 400, tag: "PIT-510", loc: "field" },
      { k: "text", x: 40, y: 500, text: "Duty blower A, standby B" },
      { k: "bubble", x: 700, y: 400, tag: "AIT-510-CU", loc: "computer" },
      { k: "bubble", x: 860, y: 400, tag: "AIT-511-CU", loc: "computer" },
      { k: "bubble", x: 1020, y: 400, tag: "AIT-512-CU", loc: "computer" },
      { k: "text", x: 700, y: 460, text: "Courier 6i · feed, concentrate, tails. Iron channel is uncertain." },
    ],
  },
  clean: {
    drawing: "PID-600-001",
    note: "Cleaner P&ID. Regrind mill, four cleaners, two packed columns and four scavengers. Cleaner tails return upstream.",
    items: [
      { k: "line", d: "M 30 160 H 1180", fluid: "conc", run: "ML-601" },
      { k: "line", d: "M 30 430 H 900", fluid: "slurry", run: "PU-631" },
      { k: "mill", x: 30, y: 80, w: 180, tag: "ML-601", drive: "ML-601" },
      { k: "bubble", x: 40, y: 230, tag: "AIT-601-P80", loc: "field" },
      { k: "bubble", x: 180, y: 230, tag: "EI-ML-601", loc: "dcs" },
      { k: "pump", x: 250, y: 110, tag: "PU-601", drive: "PU-601" },
      ...[1, 2, 3, 4].map((i) => ({
        k: "cell" as const,
        x: 300 + (i - 1) * 100,
        y: 80,
        tag: `FC-60${i}`,
        drive: `AG-60${i}`,
      })),
      { k: "bubble", x: 332, y: 220, tag: "LIT-601", loc: "field" },
      { k: "text", x: 430, y: 230, text: "Cleaner 1 shown. Cells 2–4 repeat." },
      { k: "column", x: 740, y: 50, tag: "COL-611" },
      { k: "column", x: 830, y: 50, tag: "COL-612" },
      { k: "bubble", x: 758, y: 220, tag: "LIT-611", loc: "field" },
      ...[1, 2, 3, 4].map((i) => ({
        k: "cell" as const,
        x: 40 + (i - 1) * 110,
        y: 340,
        tag: `FC-62${i}`,
        drive: `AG-62${i}`,
      })),
      { k: "text", x: 40, y: 470, text: "Scavenger bank. Cell 1 instruments are typical of 2–4." },
      { k: "pump", x: 560, y: 380, tag: "PU-631", drive: "PU-631" },
      { k: "text", x: 620, y: 400, text: "Scavenger tails return" },
      { k: "bubble", x: 980, y: 80, tag: "AIT-610-CU", loc: "computer" },
      { k: "text", x: 960, y: 130, text: "Final cleaner grade" },
    ],
  },
  conc: {
    drawing: "PID-700-001",
    note: "Concentrate handling P&ID. Thickener is shown in plan with the rake. Underflow pumps feed the disc filter.",
    items: [
      { k: "line", d: "M 250 180 H 430", fluid: "conc", run: "PU-701A" },
      { k: "line", d: "M 620 180 H 820", fluid: "conc", run: "FL-701" },
      { k: "thickener", x: 140, y: 160, r: 70, tag: "TH-701", drive: "TH-701" },
      { k: "bubble", x: 40, y: 280, tag: "LIT-701", loc: "field" },
      { k: "bubble", x: 180, y: 280, tag: "DIT-701", loc: "field" },
      { k: "bubble", x: 40, y: 350, tag: "JT-701", loc: "dcs" },
      { k: "text", x: 40, y: 80, text: "25 m thickener, plan view" },
      { k: "pump", x: 340, y: 140, tag: "PU-701A", drive: "PU-701A" },
      { k: "pump", x: 340, y: 250, tag: "PU-701B", drive: "PU-701B" },
      { k: "text", x: 390, y: 270, text: "Standby" },
      { k: "filter", x: 460, y: 140, tag: "FL-701", drive: "FL-701" },
      { k: "bubble", x: 620, y: 140, tag: "AIT-702", loc: "field" },
      { k: "text", x: 460, y: 130, text: "Ceramic disc filter" },
      { k: "conveyor", x: 760, y: 170, w: 220, tag: "CV-701", drive: "CV-701" },
      { k: "vessel", x: 1040, y: 110, w: 120, h: 100, tag: "BN-701", head: "cone", fluid: "conc" },
      { k: "bubble", x: 1100, y: 280, tag: "AIT-710", loc: "computer" },
      { k: "bubble", x: 960, y: 280, tag: "WIT-703", loc: "field" },
      { k: "text", x: 1040, y: 90, text: "Covered pad" },
    ],
  },
  tails: {
    drawing: "PID-800-001",
    note: "Tailings P&ID. Two thickener-underflow pumps run to the TSF. Pump C is standby. Return water is a separate tank and pump pair.",
    items: [
      { k: "line", d: "M 250 170 H 620", fluid: "tails", run: "PU-801A" },
      { k: "line", d: "M 860 200 H 1100", fluid: "water", run: "PU-851A" },
      { k: "thickener", x: 130, y: 160, r: 78, tag: "TH-801", drive: "TH-801" },
      { k: "text", x: 30, y: 60, text: "65 m tailings thickener, plan" },
      { k: "bubble", x: 30, y: 290, tag: "LIT-801", loc: "field" },
      { k: "bubble", x: 180, y: 290, tag: "DIT-801", loc: "field" },
      { k: "bubble", x: 30, y: 360, tag: "JT-801", loc: "dcs" },
      { k: "bubble", x: 180, y: 360, tag: "AIT-801-CU", loc: "computer" },
      { k: "pump", x: 340, y: 140, tag: "PU-801A", drive: "PU-801A" },
      { k: "pump", x: 450, y: 140, tag: "PU-801B", drive: "PU-801B" },
      { k: "pump", x: 560, y: 140, tag: "PU-801C", drive: "PU-801C" },
      { k: "text", x: 520, y: 230, text: "C standby" },
      { k: "bubble", x: 360, y: 280, tag: "FIT-801", loc: "field" },
      { k: "bubble", x: 520, y: 280, tag: "PIT-802", loc: "field" },
      { k: "text", x: 340, y: 360, text: "TSF discharge line" },
      { k: "vessel", x: 760, y: 90, w: 70, h: 140, tag: "TK-851", head: "dished", fluid: "water", level: "LIT-851" },
      { k: "bubble", x: 860, y: 120, tag: "LIT-851", loc: "field" },
      { k: "pump", x: 980, y: 140, tag: "PU-851A", drive: "PU-851A" },
      { k: "pump", x: 1100, y: 140, tag: "PU-851B", drive: "PU-851B" },
      { k: "text", x: 760, y: 70, text: "Return-water tank" },
    ],
  },
  reag: {
    drawing: "PID-900-001",
    note: "Reagent P&ID. Lime, collector, frother and depressant. Lime pump A is the output of the conditioner pH loop AC-520.",
    items: [
      { k: "line", d: "M 80 280 H 1180", fluid: "reag", run: "PU-901A" },
      { k: "vessel", x: 40, y: 80, w: 70, h: 110, tag: "SL-901", head: "open", agitator: true, drive: "SL-901", fluid: "reag" },
      { k: "text", x: 30, y: 70, text: "Lime slaker" },
      { k: "vessel", x: 200, y: 60, w: 70, h: 140, tag: "TK-901", head: "dished", fluid: "reag", level: "LIT-901" },
      { k: "vessel", x: 460, y: 60, w: 70, h: 140, tag: "TK-902", head: "dished", fluid: "reag", level: "LIT-902" },
      { k: "vessel", x: 720, y: 60, w: 70, h: 140, tag: "TK-903", head: "dished", fluid: "reag", level: "LIT-903" },
      { k: "vessel", x: 980, y: 60, w: 70, h: 140, tag: "TK-904", head: "dished", fluid: "reag", level: "LIT-904" },
      { k: "bubble", x: 200, y: 240, tag: "LIT-901", loc: "field" },
      { k: "bubble", x: 460, y: 240, tag: "LIT-902", loc: "field" },
      { k: "bubble", x: 720, y: 240, tag: "LIT-903", loc: "field" },
      { k: "bubble", x: 980, y: 240, tag: "LIT-904", loc: "field" },
      { k: "pump", x: 235, y: 340, tag: "PU-901A", drive: "PU-901A" },
      { k: "pump", x: 495, y: 340, tag: "PU-902A", drive: "PU-902A" },
      { k: "pump", x: 755, y: 340, tag: "PU-903A", drive: "PU-903A" },
      { k: "pump", x: 1015, y: 340, tag: "PU-904A", drive: "PU-904A" },
      { k: "bubble", x: 300, y: 460, tag: "FIT-901", loc: "field" },
      { k: "bubble", x: 500, y: 460, tag: "FIT-902", loc: "field" },
      { k: "bubble", x: 720, y: 460, tag: "FIT-903", loc: "field" },
      { k: "bubble", x: 960, y: 460, tag: "FIT-904", loc: "field" },
      { k: "bubble", x: 40, y: 340, tag: "DIT-901", loc: "field" },
      { k: "text", x: 200, y: 560, text: "PU-901A speed is the AC-520 output. Collector, frother and depressant dose on flow." },
    ],
  },
  util: {
    drawing: "PID-950-001",
    note: "Utilities P&ID. PC-951 holds the process-water header by the duty pump speed. Gland water and instrument air have a running standby. The diesel is a source, not a process load.",
    items: [
      { k: "line", d: "M 150 160 H 520", fluid: "water", run: "PU-951A" },
      { k: "line", d: "M 700 160 H 1100", fluid: "air", run: "CA-971A" },
      { k: "vessel", x: 30, y: 70, w: 80, h: 160, tag: "TK-951", head: "dished", fluid: "water", level: "LIT-951" },
      { k: "bubble", x: 40, y: 270, tag: "LIT-951", loc: "field" },
      { k: "pump", x: 180, y: 120, tag: "PU-951A", drive: "PU-951A" },
      { k: "pump", x: 290, y: 120, tag: "PU-951B", drive: "PU-951B" },
      { k: "pump", x: 400, y: 120, tag: "PU-951C", drive: "PU-951C" },
      { k: "bubble", x: 180, y: 240, tag: "PIT-951", loc: "field" },
      { k: "bubble", x: 340, y: 240, tag: "FIT-951", loc: "field" },
      { k: "bubble", x: 500, y: 240, tag: "PC-951", loc: "dcs" },
      { k: "text", x: 160, y: 60, text: "Process water, one duty and two standby" },
      { k: "pump", x: 180, y: 400, tag: "PU-961A", drive: "PU-961A" },
      { k: "pump", x: 300, y: 400, tag: "PU-961B", drive: "PU-961B" },
      { k: "bubble", x: 430, y: 400, tag: "PIT-961", loc: "field" },
      { k: "text", x: 160, y: 490, text: "Gland water, essential" },
      { k: "compressor", x: 700, y: 120, tag: "CA-971A", drive: "CA-971A" },
      { k: "compressor", x: 860, y: 120, tag: "CA-971B", drive: "CA-971B" },
      { k: "bubble", x: 1000, y: 120, tag: "PIT-971", loc: "field" },
      { k: "text", x: 680, y: 60, text: "Instrument air, duty / standby" },
      { k: "pump", x: 700, y: 400, tag: "PU-981", drive: "PU-981" },
      { k: "bubble", x: 840, y: 400, tag: "FIT-981", loc: "field" },
      { k: "text", x: 680, y: 490, text: "Cooling water" },
      { k: "diesel", x: 1040, y: 360, tag: "EDG-991", drive: "EDG-991" },
      { k: "text", x: 1020, y: 450, text: "1,250 kW standby source" },
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
  { id: "cv", group: "Valves", name: "Control valve", note: "Bowtie with a pneumatic diaphragm. Fail position is in the note." },
  { id: "cvm", group: "Valves", name: "Motor-operated valve", note: "Bowtie with an M actuator." },
  { id: "cvs", group: "Valves", name: "Solenoid valve", note: "Bowtie with an S actuator." },
  { id: "gate", group: "Valves", name: "Gate valve", note: "Bowtie with the gate drawn through the body." },
  { id: "globe", group: "Valves", name: "Globe valve", note: "Bowtie with a filled seat." },
  { id: "ball", group: "Valves", name: "Ball valve", note: "Bowtie with an open ball." },
  { id: "check", group: "Valves", name: "Check valve", note: "Flow triangle and a downstream stop." },
  { id: "butterfly", group: "Valves", name: "Butterfly valve", note: "Bowtie with the disc across the body." },
  { id: "vessel", group: "Vessels", name: "Vertical vessel, dished ends", note: "Cylinder with elliptical heads." },
  { id: "hopper", group: "Vessels", name: "Bin", note: "Hopper bottom. Used for the ROM bin." },
  { id: "cone", group: "Vessels", name: "Cone-roof tank", note: "Roof and shell. Used for the concentrate pad." },
  { id: "open", group: "Vessels", name: "Open tank", note: "Open top. Sumps, conditioner and stockpile pocket." },
  { id: "crusher", group: "Process", name: "Cone crusher", note: "Outer shell and the mantle. Gyratory and pebble crusher." },
  { id: "mill", group: "Process", name: "Tumbling mill", note: "Horizontal drum. SAG, ball and regrind." },
  { id: "conveyor", group: "Process", name: "Belt conveyor", note: "Head and tail pulleys with the belt." },
  { id: "cyclone", group: "Process", name: "Cyclone separator", note: "Body, cone and vortex finder." },
  { id: "cell", group: "Process", name: "Flotation cell and agitator", note: "Open cell, froth band and turbine impeller." },
  { id: "column", group: "Process", name: "Packed column", note: "Tall vessel with the packing marks." },
  { id: "thickener", group: "Process", name: "Thickener", note: "Plan view, rake arms and the centre well." },
  { id: "filter", group: "Process", name: "Filter", note: "Shell with the filter medium." },
  { id: "magnet", group: "Process", name: "Permanent magnet", note: "Horseshoe over the belt." },
  { id: "detector", group: "Process", name: "Specialty item", note: "Diamond. Tramp-metal detector." },
  { id: "line", group: "Lines", name: "Major process line", note: "Solid line. Colour is the fluid." },
  { id: "signal", group: "Lines", name: "Electrical signal", note: "Dashed line from a field device to the DCS bubble." },
];

export function SymbolTile({ id }: { id: string }) {
  return (
    <svg viewBox="-60 -56 120 112" className="symbol-svg">
      <rect x="-60" y="-56" width="120" height="112" fill="#0c141b" />
      {id === "field" ? <g transform="translate(0 0)"><BubbleGlyph loc="field" alarm={false} /></g> : null}
      {id === "board" ? <BubbleGlyph loc="board" alarm={false} /> : null}
      {id === "panel" ? <BubbleGlyph loc="panel" alarm={false} /> : null}
      {id === "dcs" ? <BubbleGlyph loc="dcs" alarm={false} /> : null}
      {id === "computer" ? <BubbleGlyph loc="computer" alarm={false} /> : null}
      {id === "pump" ? <PumpGlyph dir="e" stroke={INK} /> : null}
      {id === "motor" ? <Motor x={0} y={0} state="running" /> : null}
      {id === "fan" ? (
        <g stroke={INK} fill={PAPER}>
          <circle r="18" />
          <path d="M 0,-12 L 8,8 L -8,8 Z" />
        </g>
      ) : null}
      {id === "compressor" ? (
        <g stroke={INK} fill={PAPER}>
          <circle r="16" />
          <path d="M 4,-9 L 24,0 L 4,9 Z" />
        </g>
      ) : null}
      {id === "diesel" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-30" y="-16" width="60" height="32" />
          <text y="5" textAnchor="middle" fontSize="12">D</text>
        </g>
      ) : null}
      {id === "cv" ? <ValveGlyph form="control" act="air" /> : null}
      {id === "cvm" ? <ValveGlyph form="control" act="motor" /> : null}
      {id === "cvs" ? <ValveGlyph form="control" act="solenoid" /> : null}
      {id === "gate" ? <ValveGlyph form="gate" /> : null}
      {id === "globe" ? <ValveGlyph form="globe" /> : null}
      {id === "ball" ? <ValveGlyph form="ball" /> : null}
      {id === "check" ? <ValveGlyph form="check" /> : null}
      {id === "butterfly" ? <ValveGlyph form="butterfly" /> : null}
      {id === "vessel" ? (
        <g stroke={INK} fill={PAPER}>
          <ellipse cx="0" cy="-28" rx="22" ry="8" />
          <rect x="-22" y="-28" width="44" height="56" />
          <ellipse cx="0" cy="28" rx="22" ry="8" />
        </g>
      ) : null}
      {id === "hopper" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-20" y="-36" width="40" height="36" />
          <polygon points="-20,0 20,0 12,28 -12,28" />
        </g>
      ) : null}
      {id === "cone" ? (
        <g stroke={INK} fill={PAPER}>
          <polygon points="0,-36 -24,-16 24,-16" />
          <rect x="-24" y="-16" width="48" height="40" />
        </g>
      ) : null}
      {id === "open" ? (
        <g stroke={INK} fill={PAPER}>
          <line x1="-22" y1="-30" x2="22" y2="-30" />
          <rect x="-22" y="-30" width="44" height="58" />
        </g>
      ) : null}
      {id === "crusher" ? (
        <g stroke={INK} fill={PAPER}>
          <polygon points="-28,-30 28,-30 18,30 -18,30" />
          <polygon points="0,-20 10,22 -10,22" />
        </g>
      ) : null}
      {id === "mill" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-24" y="-16" width="48" height="32" />
          <ellipse cx="-24" cy="0" rx="12" ry="16" />
          <ellipse cx="24" cy="0" rx="12" ry="16" />
        </g>
      ) : null}
      {id === "conveyor" ? (
        <g stroke={INK} fill={PAPER}>
          <line x1="-30" y1="-8" x2="30" y2="-8" />
          <line x1="-30" y1="8" x2="30" y2="8" />
          <circle cx="-30" cy="0" r="8" />
          <circle cx="30" cy="0" r="8" />
        </g>
      ) : null}
      {id === "cyclone" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-16" y="-28" width="32" height="14" />
          <polygon points="-16,-14 16,-14 8,28 -8,28" />
        </g>
      ) : null}
      {id === "cell" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-22" y="-28" width="44" height="56" />
          <line x1="0" y1="-28" x2="0" y2="16" />
          <path d="M -12 12 L 0 22 L 12 12" fill="none" />
        </g>
      ) : null}
      {id === "column" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-12" y="-36" width="24" height="72" />
          <line x1="-8" y1="-10" x2="8" y2="-10" strokeDasharray="2 2" />
          <line x1="-8" y1="6" x2="8" y2="6" strokeDasharray="2 2" />
        </g>
      ) : null}
      {id === "thickener" ? (
        <g stroke={INK} fill={PAPER}>
          <circle r="28" />
          <line x1="-20" y1="0" x2="20" y2="0" />
          <line x1="0" y1="-20" x2="0" y2="20" />
          <circle r="5" />
        </g>
      ) : null}
      {id === "filter" ? (
        <g stroke={INK} fill={PAPER}>
          <rect x="-28" y="-18" width="56" height="36" />
          <line x1="-22" y1="12" x2="22" y2="-12" />
        </g>
      ) : null}
      {id === "magnet" ? <path d="M -16 16 L -16 0 Q 0 -24 16 0 L 16 16" fill="none" stroke={INK} strokeWidth="3" /> : null}
      {id === "detector" ? <polygon points="0,-16 16,0 0,16 -16,0" fill={PAPER} stroke={INK} /> : null}
      {id === "line" ? <line x1="-40" y1="0" x2="40" y2="0" stroke="#8a5a32" strokeWidth="5" /> : null}
      {id === "signal" ? <line x1="-40" y1="0" x2="40" y2="0" stroke="#9eb0c2" strokeWidth="1.4" strokeDasharray="4 3" /> : null}
    </svg>
  );
}
