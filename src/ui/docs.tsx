import { useMemo, useState } from "react";
import { MODEL } from "../model/build";
import { RUN_TRIPS, startChecks } from "../model/permissives";
import type { AreaId } from "../model/types";
import { AREAS } from "../model/types";
import { fmt, limitOf } from "./format";
import { NARRATIVES } from "../model/narratives";
import { SYMBOL_CARDS, SymbolTile } from "./pid";
import { usePlant } from "./state";

export function Setpoints() {
  const { live, open } = usePlant();
  const [area, setArea] = useState<AreaId | "all">("all");
  const [q, setQ] = useState("");
  const analogs = MODEL.points.filter((point) => point.hh != null || point.h != null || point.l != null || point.ll != null);
  const discretes = MODEL.points.filter((point) => point.alarmWhen != null);
  const query = q.trim().toLowerCase();
  const show = (tag: string, desc: string, pointArea: AreaId) =>
    (area === "all" || pointArea === area) && (!query || `${tag} ${desc}`.toLowerCase().includes(query));
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Cause and effect · configured limits</div>
          <h1>Alarm setpoints</h1>
          <p>HH and LL are priority 1. H and L are priority 2. A bad quality is priority 2 and an uncertain quality is priority 3. These are the training-simulator thresholds, not a commissioned plant list.</p>
        </div>
      </div>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag or description" aria-label="Search setpoints" />
        <select value={area} onChange={(e) => setArea(e.target.value as AreaId | "all")} aria-label="Area">
          <option value="all">All areas</option>
          {AREAS.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <span className="note">{analogs.filter((p) => show(p.tag, p.desc, p.area)).length} analog limits</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Tag</th><th>Description</th><th>Area</th><th className="num">LL</th><th className="num">L</th><th className="num">H</th><th className="num">HH</th><th className="num">Value</th><th>State</th>
            </tr>
          </thead>
          <tbody>
            {analogs.filter((point) => show(point.tag, point.desc, point.area)).map((point) => {
              const value = live.values[point.index];
              const state = limitOf(point, value);
              return (
                <tr key={point.tag} className={state === "HH" || state === "LL" ? "row-unack" : state ? "row-rtn" : ""}>
                  <td><button className="tagbtn" onClick={() => open({ kind: "analog", tag: point.tag })}>{point.tag}</button></td>
                  <td>{point.desc}</td>
                  <td>{AREAS.find((item) => item.id === point.area)?.short}</td>
                  <td className="num">{point.ll ?? "—"}</td>
                  <td className="num">{point.l ?? "—"}</td>
                  <td className="num">{point.h ?? "—"}</td>
                  <td className="num">{point.hh ?? "—"}</td>
                  <td className="num">{fmt(value, point.dec)} {point.eu}</td>
                  <td>{state ?? "OK"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2>Discrete alarms</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Tag</th><th>Description</th><th>Alarms when</th><th>Priority</th><th>Now</th></tr>
          </thead>
          <tbody>
            {discretes.filter((point) => show(point.tag, point.desc, point.area)).map((point) => {
              const on = live.values[point.index] >= 0.5 ? 1 : 0;
              const word = point.words ? point.words[on] : String(on);
              return (
                <tr key={point.tag}>
                  <td><button className="tagbtn" onClick={() => open({ kind: "discrete", tag: point.tag })}>{point.tag}</button></td>
                  <td>{point.desc}</td>
                  <td>{point.words ? point.words[point.alarmWhen ?? 1] : point.alarmCond}</td>
                  <td>P{point.priority ?? 2}</td>
                  <td>{word}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Interlocks() {
  const { live, open } = usePlant();
  const [area, setArea] = useState<AreaId | "all">("all");
  const [kind, setKind] = useState<"all" | "Permissive" | "Trip">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const out: { id: string; type: "Permissive" | "Trip"; equip: string; area: AreaId; cause: string; action: string; delay: string; ok: boolean }[] = [];
    for (const spec of MODEL.motors) {
      if (spec.start === "Static" || spec.area === "sys") continue;
      startChecks(live, spec.tag).forEach((check, index) => {
        out.push({
          id: `P-${spec.tag}-${index + 1}`,
          type: "Permissive",
          equip: spec.tag,
          area: spec.area,
          cause: check.label,
          action: "Start stays blocked while this check is not met",
          delay: "—",
          ok: check.ok,
        });
      });
    }
    for (const trip of RUN_TRIPS) {
      const spec = MODEL.motorByTag.get(trip.motor);
      if (!spec) continue;
      out.push({
        id: `T-${trip.motor}-${trip.reason}`,
        type: "Trip",
        equip: trip.motor,
        area: spec.area,
        cause: trip.reason,
        action: "Drive trips and the fault stays latched until reset",
        delay: trip.delay ? `${trip.delay} s` : "Immediate",
        ok: trip.ok(live),
      });
    }
    return out;
  }, [live]);
  const query = q.trim().toLowerCase();
  const shown = rows.filter((row) => (area === "all" || row.area === area) && (kind === "all" || row.type === kind) && (!query || `${row.equip} ${row.cause}`.toLowerCase().includes(query)));
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Cause and effect</div>
          <h1>Interlock list</h1>
          <p>Permissives are checked at start. Trips are checked while the drive is running. A green row is healthy right now. Paired mill pinions start and stop together. Lube pairs start the standby if the duty pump is not running.</p>
        </div>
      </div>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drive or cause" aria-label="Search interlocks" />
        <select value={area} onChange={(e) => setArea(e.target.value as AreaId | "all")} aria-label="Area">
          <option value="all">All areas</option>
          {AREAS.filter((item) => item.id !== "sys").map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as "all" | "Permissive" | "Trip")} aria-label="Interlock type">
          <option value="all">Permissives and trips</option>
          <option value="Permissive">Permissives</option>
          <option value="Trip">Trips</option>
        </select>
        <span className="note">{shown.length} shown · {shown.filter((row) => !row.ok).length} not healthy</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Id</th><th>Type</th><th>Drive</th><th>Cause</th><th>Action</th><th>Delay</th><th>Now</th></tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="num">{row.id}</td>
                <td>{row.type}</td>
                <td><button className="tagbtn" onClick={() => open({ kind: "motor", tag: row.equip })}>{row.equip}</button></td>
                <td>{row.cause}</td>
                <td>{row.action}</td>
                <td>{row.delay}</td>
                <td className={row.ok ? "ok-cell" : "bad-cell"}>{row.ok ? "Healthy" : "Not met"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Narratives() {
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Operating manual · training</div>
          <h1>Control narratives</h1>
          <p>Each narrative matches the P&ID, the alarm setpoints, and the interlock list. It describes this simulator. It is not a commissioned site procedure.</p>
        </div>
      </div>
      <div className="narrative">
        {NARRATIVES.map((story) => (
          <article key={story.area} className="panel">
            <div className="kicker">Area {story.area}</div>
            <h2>{story.title}</h2>
            {story.blocks.map((block) => (
              <p key={block.h}><b>{block.h}. </b>{block.text}</p>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}

export function SymbolLegend() {
  const groups = [...new Set(SYMBOL_CARDS.map((card) => card.group))];
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">ISA-5.1</div>
          <h1>P&ID symbols</h1>
          <p>The area sheets use these symbols, set out in process order. A line leaves one symbol and the arrow arrives at the next. The italic name is the stream. Click a symbol to open it.</p>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group}>
          <h2>{group}</h2>
          <div className="symbol-grid">
            {SYMBOL_CARDS.filter((card) => card.group === group).map((card) => (
              <div key={card.id} className="symbol-card">
                <SymbolTile id={card.id} />
                <b>{card.name}</b>
                <span>{card.note}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
