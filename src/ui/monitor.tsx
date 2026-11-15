import { useMemo, useState } from "react";
import { MODEL } from "../model/build";
import { readSeries } from "../model/simulate";
import { fmt, fmtTime } from "./format";
import { TREND_COLORS } from "./face";
import { usePlant } from "./state";

const WINDOWS = [
  { id: "15m", ms: 15 * 60 * 1000, label: "15 min" },
  { id: "1h", ms: 60 * 60 * 1000, label: "1 hour" },
  { id: "4h", ms: 4 * 60 * 60 * 1000, label: "4 hours" },
  { id: "8h", ms: 8 * 60 * 60 * 1000, label: "8 hours" },
];

const DEFAULT_PENS = ["WIT-102", "AIT-510-CU", "CALC-REC", "LIT-301", "EI-ML-301A", "DIT-323"];

export function Trends() {
  const { live, open } = usePlant();
  const [pens, setPens] = useState(DEFAULT_PENS.filter((tag) => MODEL.byTag.has(tag)));
  const [windowId, setWindowId] = useState("1h");
  const [query, setQuery] = useState("");
  const windowMs = WINDOWS.find((item) => item.id === windowId)?.ms ?? WINDOWS[1].ms;
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return MODEL.trendTags.filter((tag) => {
      const point = MODEL.byTag.get(tag)!;
      return tag.toLowerCase().includes(q) || point.desc.toLowerCase().includes(q);
    }).slice(0, 8);
  }, [query]);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Historian sample · 15 s</div>
          <h1>Trends</h1>
          <p>Each pen is scaled to its own instrument range so different units share one chart. The trace is sample process data from this training simulator.</p>
        </div>
        <div className="sp-row">
          {WINDOWS.map((item) => (
            <button key={item.id} className={item.id === windowId ? "btn on" : "btn"} onClick={() => setWindowId(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>
      <TrendChart pens={pens} windowMs={windowMs} />
      <div className="layout-2">
        <div className="panel">
          <h2>Pens</h2>
          <div className="pens">
            {pens.map((tag, index) => {
              const point = MODEL.byTag.get(tag);
              if (!point) return null;
              return (
                <div className="pen" key={tag}>
                  <button className="tagbtn" onClick={() => open({ kind: "analog", tag })}>
                    <i className="dot" style={{ background: TREND_COLORS[index % TREND_COLORS.length] }} />
                    {tag}
                  </button>
                  <span>
                    {fmt(live.values[point.index], point.dec)} {point.eu}
                    <button className="linkish" onClick={() => setPens((prev) => prev.filter((item) => item !== tag))} style={{ marginLeft: 8 }}>Remove</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel">
          <h2>Add a tag</h2>
          <input placeholder="Search WIT-102, level, copper…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {hits.map((tag) => (
            <div className="check" key={tag}>
              <span>{tag} · {MODEL.byTag.get(tag)?.desc}</span>
              <button
                className="btn"
                disabled={pens.includes(tag) || pens.length >= 6}
                onClick={() => {
                  setPens((prev) => prev.includes(tag) ? prev : [...prev, tag].slice(0, 6));
                  setQuery("");
                }}
              >
                Add
              </button>
            </div>
          ))}
          <p className="note">Up to 6 pens. Axis is percent of each tag’s instrument range.</p>
        </div>
      </div>
    </>
  );
}

function TrendChart({ pens, windowMs }: { pens: string[]; windowMs: number }) {
  const { live } = usePlant();
  const width = 980;
  const height = 340;
  const pad = { l: 48, r: 16, t: 16, b: 32 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const series = pens.map((tag) => {
    const point = MODEL.byTag.get(tag)!;
    const pts = readSeries(live, tag, windowMs);
    return { tag, point, pts };
  });
  const t0 = live.now - windowMs;
  const t1 = live.now;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Process trend, percent of instrument range">
      <rect width={width} height={height} fill="#101820" />
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = pad.t + innerH - (tick / 100) * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#2c3d4e" />
            <text x={pad.l - 6} y={y + 4} fill="#8ea0b3" fontSize="10" textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {[0, 0.5, 1].map((frac) => {
        const x = pad.l + frac * innerW;
        const label = fmtTime(t0 + frac * (t1 - t0));
        return <text key={frac} x={x} y={height - 8} fill="#8ea0b3" fontSize="10" textAnchor={frac === 1 ? "end" : frac === 0 ? "start" : "middle"}>{label.replace(" CT", "")}</text>;
      })}
      <text x={14} y={pad.t + innerH / 2} fill="#8ea0b3" fontSize="10" transform={`rotate(-90 14 ${pad.t + innerH / 2})`}>% of range</text>
      {series.map((item, index) => {
        if (item.pts.length < 2) return null;
        const span = item.point.max - item.point.min || 1;
        const d = item.pts.map((pt, i) => {
          const x = pad.l + ((pt.t - t0) / (t1 - t0)) * innerW;
          const y = pad.t + innerH - ((pt.v - item.point.min) / span) * innerH;
          return `${i ? "L" : "M"}${x.toFixed(1)},${Math.max(pad.t, Math.min(pad.t + innerH, y)).toFixed(1)}`;
        }).join(" ");
        return <path key={item.tag} d={d} fill="none" stroke={TREND_COLORS[index % TREND_COLORS.length]} strokeWidth="1.6" />;
      })}
    </svg>
  );
}

export function Alarms() {
  const { live, cmd } = usePlant();
  const [pri, setPri] = useState("all");
  const [tab, setTab] = useState<"alarms" | "events">("alarms");
  const rows = live.alarms.filter((alarm) => pri === "all" || String(alarm.priority) === pri);
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">ISA-style journal</div>
          <h1>Alarms</h1>
          <p>Unacknowledged alarms stay on the banner. Acknowledging a returned alarm clears it. Priority 1 is a trip or high-high.</p>
        </div>
        <div className="sp-row">
          <button className={tab === "alarms" ? "btn on" : "btn"} onClick={() => setTab("alarms")}>Alarms</button>
          <button className={tab === "events" ? "btn on" : "btn"} onClick={() => setTab("events")}>Events</button>
          <button className="btn" onClick={() => cmd({ type: "ackAll" })}>Ack all</button>
        </div>
      </div>
      {tab === "events" ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Time</th><th>Event</th></tr></thead>
            <tbody>
              {live.events.map((event, index) => (
                <tr key={event.time + event.text + index}>
                  <td>{fmtTime(event.time, true)}</td>
                  <td>{event.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="filters">
            {["all", "1", "2", "3", "4"].map((item) => (
              <button key={item} className={pri === item ? "btn on" : "btn"} onClick={() => setPri(item)}>{item === "all" ? "All" : `P${item}`}</button>
            ))}
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Pri</th><th>State</th><th>Tag</th><th>Condition</th><th>Description</th><th>Value</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((alarm) => (
                  <tr key={alarm.id} className={alarm.state === "UNACK" ? "row-unack" : alarm.state === "RTN" ? "row-rtn" : ""}>
                    <td>{fmtTime(alarm.time, true)}</td>
                    <td><span className={`pri p${alarm.priority}`}>P{alarm.priority}</span></td>
                    <td>{alarm.state}</td>
                    <td>{alarm.tag}</td>
                    <td>{alarm.cond}</td>
                    <td>{alarm.text}</td>
                    <td>{alarm.value}</td>
                    <td>{alarm.state === "UNACK" || alarm.state === "RTN" ? <button className="btn" onClick={() => cmd({ type: "ack", id: alarm.id })}>Ack</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
