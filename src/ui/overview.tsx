import { MODEL } from "../model/build";
import type { AreaId } from "../model/types";
import { AREA_BY_ID } from "../model/types";
import { fmt } from "./format";
import { usePlant } from "./state";

const FLOW: { id: AreaId; label: string; x: number; y: number }[] = [
  { id: "crush", label: "Crushing", x: 16, y: 36 },
  { id: "stock", label: "Stockpile", x: 190, y: 36 },
  { id: "sag", label: "SAG", x: 364, y: 36 },
  { id: "ball", label: "Ball mill", x: 538, y: 36 },
  { id: "rough", label: "Rougher", x: 712, y: 36 },
  { id: "clean", label: "Cleaner", x: 886, y: 36 },
  { id: "conc", label: "Concentrate", x: 712, y: 150 },
  { id: "tails", label: "Tailings", x: 364, y: 150 },
  { id: "reag", label: "Reagents", x: 16, y: 150 },
  { id: "util", label: "Water & air", x: 190, y: 150 },
];

export function areaTone(area: AreaId, live: ReturnType<typeof usePlant>["live"]): string {
  const tripped = MODEL.motors.some((m) => m.area === area && live.motors[m.index].state === "tripped");
  if (tripped) return "trip";
  const alarm = live.alarms.some((a) => a.area === area && a.state !== "CLEAR" && a.priority <= 2);
  if (alarm) return "alarm";
  return "run";
}

export function Overview() {
  const { live, go, open, cmd } = usePlant();
  const loop = MODEL.loopById.get("FC-102");
  const sp = loop ? live.loops[loop.index].sp : 1750;
  const k = live.kpis;
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Concentrator 1 · 42,000 t/d design</div>
          <h1>Plant overview</h1>
          <p>Fresh feed to concentrate and tailings. Open an area for its P&ID. Values move with the equipment you start and stop.</p>
        </div>
        <button className="btn" onClick={() => open({ kind: "basis" })}>Basis of design</button>
      </div>
      <div className="hero">
        <div className="kpi feed">
          <span>Fresh feed</span>
          <b>{fmt(k.feed, 0)} <em>t/h</em></b>
          <div className="sp-row">
            <button onClick={() => cmd({ type: "sp", id: "FC-102", value: sp - 100 })}>−100</button>
            <button onClick={() => cmd({ type: "sp", id: "FC-102", value: sp - 25 })}>−25</button>
            <button onClick={() => cmd({ type: "sp", id: "FC-102", value: sp + 25 })}>+25</button>
            <button onClick={() => cmd({ type: "sp", id: "FC-102", value: sp + 100 })}>+100</button>
          </div>
          <div className="note">Setpoint {fmt(sp, 0)} t/h · FC-102</div>
        </div>
        <div className="kpi"><span>Head grade</span><b>{fmt(k.head, 2)} <em>%Cu</em></b></div>
        <div className="kpi"><span>Recovery</span><b>{fmt(k.rec, 1)} <em>%</em></b></div>
        <div className="kpi"><span>Concentrate</span><b>{fmt(k.concGrade, 1)} <em>%Cu</em></b></div>
        <div className="kpi"><span>Copper</span><b>{fmt(k.cuTph, 2)} <em>t/h</em></b></div>
        <div className="kpi"><span>Grind energy</span><b>{fmt(k.sec, 1)} <em>kWh/t</em></b></div>
      </div>
      <div className="mimic-wrap">
        <svg className="mimic" viewBox="0 0 1100 280">
          <rect width="1100" height="280" fill="#101820" />
          <path d="M 150 70 H 190 M 324 70 H 364 M 498 70 H 538 M 672 70 H 712 M 860 70 H 886" className="pipe slurry flow" />
          <path d="M 960 110 V 150 H 850" className="pipe conc flow" />
          <path d="M 780 110 V 150" className="pipe tails" />
          {FLOW.map((block) => (
            <g key={block.id} style={{ cursor: "pointer" }} onClick={() => go(block.id)}>
              <rect x={block.x} y={block.y} width="150" height="64" fill="#17212b" stroke={areaTone(block.id, live) === "trip" ? "#e15b5b" : areaTone(block.id, live) === "alarm" ? "#e2b340" : "#3cba7c"} />
              <text x={block.x + 10} y={block.y + 24} fill="#d7e0ea" fontSize="13">{block.label}</text>
              <text x={block.x + 10} y={block.y + 44} fill="#8ea0b3" fontSize="11">{AREA_BY_ID[block.id].code}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="layout-2">
        <div className="panel">
          <h2>Mass balance</h2>
          <table>
            <thead><tr><th>Stream</th><th className="num">t/h</th><th className="num">% Cu</th><th className="num">t/h Cu</th></tr></thead>
            <tbody>
              <tr><td>Fresh feed</td><td className="num">{fmt(k.feed, 0)}</td><td className="num">{fmt(k.head, 2)}</td><td className="num">{fmt(k.cuIn, 2)}</td></tr>
              <tr><td>Final concentrate</td><td className="num">{fmt(k.concTph, 1)}</td><td className="num">{fmt(k.concGrade, 1)}</td><td className="num">{fmt(k.cuTph, 2)}</td></tr>
              <tr><td>Final tailings</td><td className="num">{fmt(k.tailsTph, 0)}</td><td className="num">{fmt(k.tailsGrade, 3)}</td><td className="num">{fmt(k.cuIn - k.cuTph, 2)}</td></tr>
            </tbody>
          </table>
          <p className="note">Shift to date {fmt(k.shiftTons, 0)} t ore · {fmt(k.shiftCu, 1)} t copper. Sample balance from the feed weigher and the on-stream analyser.</p>
        </div>
        <div className="panel">
          <h2>Circuit</h2>
          <div className="check"><span>SAG feed</span><span>{fmt(k.sagFeed, 0)} t/h</span></div>
          <div className="check"><span>Stockpile live</span><span>{fmt(k.stockPct, 1)} % · {fmt(k.stockTons, 0)} t</span></div>
          <div className="check"><span>Stock change</span><span>{k.stockDelta >= 0 ? "Filling" : "Drawing"} {fmt(Math.abs(k.stockDelta), 0)} t/h</span></div>
          <div className="check"><span>P80</span><span>{fmt(k.p80, 0)} µm</span></div>
          <div className="check"><span>Grinding power</span><span>{fmt(k.grindKw / 1000, 2)} MW</span></div>
          <div className="check"><span>Plant load</span><span>{fmt(k.plantKw / 1000, 1)} MW</span></div>
          <div className="check"><span>Process water</span><span>{fmt(k.water, 0)} m³/h</span></div>
        </div>
      </div>
    </>
  );
}
