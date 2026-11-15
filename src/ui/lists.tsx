import { useMemo, useState } from "react";
import { MODEL } from "../model/build";
import type { Point } from "../model/types";
import { AREA_BY_ID, AREAS } from "../model/types";
import { downloadCsv, fmt, motorWord } from "./format";
import { SingleLine } from "./sld";
import { usePlant } from "./state";

type Sort<T> = { key: keyof T; dir: 1 | -1 };

function useSort<T>(initial: keyof T) {
  const [sort, setSort] = useState<Sort<T>>({ key: initial, dir: 1 });
  const toggle = (key: keyof T) => setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 1 ? -1 : 1 }));
  return { sort, toggle };
}

export function IoList() {
  const { live, open } = usePlant();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [io, setIo] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<Point>("tag");
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = MODEL.points.filter((point) => {
      if (area !== "all" && point.area !== area) return false;
      if (io !== "all" && point.io !== io) return false;
      if (source !== "all" && point.source !== source) return false;
      if (!query) return true;
      return `${point.tag} ${point.desc} ${point.equip} ${point.device} ${point.plc}`.toLowerCase().includes(query);
    });
    const dir = sort.dir;
    list.sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? "")) * dir);
    return list;
  }, [q, area, io, source, sort]);
  const size = 80;
  const slice = rows.slice(page * size, page * size + size);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const point of MODEL.points) map[point.io] = (map[point.io] ?? 0) + 1;
    return map;
  }, []);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Field and soft points</div>
          <h1>IO List</h1>
          <p>
            {MODEL.points.length} points · {Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(" · ")}. Click a tag to open the analog or discrete faceplate.
          </p>
        </div>
        <button
          className="btn"
          onClick={() =>
            downloadCsv(
              "cobre-norte-io-list.csv",
              [
                ["Tag", "Description", "Area", "Equipment", "Type", "Signal", "Source", "PLC", "Address", "Card", "EU", "Min", "Max", "LL", "L", "H", "HH", "P&ID", "Cable", "Device", "Fail"],
                ...MODEL.points.map((p) => [p.tag, p.desc, AREA_BY_ID[p.area].name, p.equip, p.io, p.signal, p.source, p.plc, p.address, p.card, p.eu, p.min, p.max, p.ll ?? "", p.l ?? "", p.h ?? "", p.hh ?? "", p.pid, p.cable, p.device, p.fail]),
              ],
            )
          }
        >
          Export CSV
        </button>
      </div>
      <div className="filters">
        <input placeholder="Search tag, description, device" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select value={area} onChange={(e) => { setArea(e.target.value); setPage(0); }}>
          <option value="all">All areas</option>
          {AREAS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={io} onChange={(e) => { setIo(e.target.value); setPage(0); }}>
          <option value="all">All types</option>
          {["AI", "AO", "DI", "DO", "RTD", "COMM", "CALC"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(0); }}>
          <option value="all">All sources</option>
          <option>Field</option>
          <option>Drive</option>
          <option>Calculated</option>
        </select>
        <span className="note">{rows.length} shown</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {(["tag", "desc", "area", "equip", "io", "plc", "address"] as const).map((key) => (
                <th key={key} onClick={() => toggle(key)}>{key}</th>
              ))}
              <th>EU</th>
              <th className="num">Value</th>
              <th>LL</th>
              <th>L</th>
              <th>H</th>
              <th>HH</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((point) => (
              <tr key={point.tag}>
                <td>
                  <button className="tagbtn" onClick={() => open({ kind: point.words ? "discrete" : "analog", tag: point.tag })}>
                    {point.tag}
                  </button>
                </td>
                <td>{point.desc}</td>
                <td>{AREA_BY_ID[point.area].short}</td>
                <td>{point.equip}</td>
                <td>{point.io}</td>
                <td>{point.plc}</td>
                <td>{point.address}</td>
                <td>{point.eu}</td>
                <td className="num">{fmt(live.values[point.index], point.dec)}</td>
                <td>{point.ll ?? ""}</td>
                <td>{point.l ?? ""}</td>
                <td>{point.h ?? ""}</td>
                <td>{point.hh ?? ""}</td>
                <td>{point.device}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="btn" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Previous</button>
        <span>
          {rows.length === 0 ? "0" : `${page * size + 1}–${Math.min(rows.length, (page + 1) * size)}`} of {rows.length}
        </span>
        <button className="btn" disabled={(page + 1) * size >= rows.length} onClick={() => setPage((n) => n + 1)}>Next</button>
      </div>
    </>
  );
}

export function LoadList() {
  const { live, open } = usePlant();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [mcc, setMcc] = useState("all");
  const [duty, setDuty] = useState("all");
  const mccs = useMemo(() => [...new Set(MODEL.motors.map((m) => m.mcc))].sort(), []);
  const rows = MODEL.motors.filter((motor) => {
    if (area !== "all" && motor.area !== area) return false;
    if (mcc !== "all" && motor.mcc !== mcc) return false;
    if (duty !== "all" && motor.duty !== duty) return false;
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return `${motor.tag} ${motor.name} ${motor.mcc} ${motor.bus}`.toLowerCase().includes(query);
  });
  const connected = MODEL.motors.filter((m) => m.start !== "Diesel").reduce((sum, m) => sum + m.kw, 0);
  const running = MODEL.motors.filter((m) => m.start !== "Diesel").reduce((sum, m) => sum + live.motors[m.index].kw, 0);
  const byVolt = [415, 690, 3300, 11000].map((volts) => {
    const group = MODEL.motors.filter((m) => m.volts === volts && m.start !== "Diesel");
    return {
      volts,
      connected: group.reduce((s, m) => s + m.kw, 0),
      running: group.reduce((s, m) => s + live.motors[m.index].kw, 0),
    };
  });

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">Electrical schedule</div>
          <h1>Load List</h1>
          <p>
            Connected {fmt(connected / 1000, 1)} MW · running {fmt(running / 1000, 1)} MW · demand {fmt(connected ? running / connected : 0, 2)}. Diesel rating is not counted as a load.
          </p>
        </div>
        <button
          className="btn"
          onClick={() =>
            downloadCsv("cobre-norte-load-list.csv", [
              ["Tag", "Description", "Area", "kW", "Volts", "FLC", "PF", "Eff", "Start", "Duty", "MCC", "Cell", "Feeder", "Bus", "Cable", "Essential"],
              ...MODEL.motors.map((m) => [m.tag, m.name, AREA_BY_ID[m.area].name, m.kw, m.volts, Math.round(m.flc), m.pf, m.eff, m.start, m.duty, m.mcc, m.cell, m.feeder, m.bus, m.cable, m.essential ? "Yes" : "No"]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <div className="bars">
        {byVolt.map((row) => (
          <div className="barline" key={row.volts}>
            <span>{row.volts >= 1000 ? `${row.volts / 1000} kV` : `${row.volts} V`}</span>
            <div className="track"><span style={{ width: `${Math.min(100, (row.running / Math.max(row.connected, 1)) * 100)}%` }} /></div>
            <span>{fmt(row.running, 0)} kW</span>
          </div>
        ))}
      </div>
      <div className="filters">
        <input placeholder="Search tag or MCC" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="all">All areas</option>
          {AREAS.filter((a) => a.id !== "sys").map((a) => <option key={a.id} value={a.id}>{a.short}</option>)}
        </select>
        <select value={mcc} onChange={(e) => setMcc(e.target.value)}>
          <option value="all">All MCCs</option>
          {mccs.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={duty} onChange={(e) => setDuty(e.target.value)}>
          <option value="all">All duties</option>
          <option>Continuous</option>
          <option>Intermittent</option>
          <option>Standby</option>
        </select>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Tag</th><th>Description</th><th>Area</th><th className="num">kW</th><th>V</th>
              <th className="num">FLC A</th><th>Start</th><th>Duty</th><th>MCC</th><th>Cell</th>
              <th>Bus</th><th>State</th><th className="num">kW now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((motor) => {
              const rt = live.motors[motor.index];
              return (
                <tr key={motor.tag}>
                  <td>
                    <button className="tagbtn" onClick={() => open({ kind: "motor", tag: motor.tag })}>{motor.tag}</button>
                  </td>
                  <td>{motor.name}</td>
                  <td>{AREA_BY_ID[motor.area].short}</td>
                  <td className="num">{fmt(motor.kw, 0)}</td>
                  <td>{motor.volts}</td>
                  <td className="num">{fmt(motor.flc, 0)}</td>
                  <td>{motor.start}</td>
                  <td>{motor.duty}</td>
                  <td>{motor.mcc}</td>
                  <td>{motor.cell}</td>
                  <td>{motor.bus}</td>
                  <td>{motorWord(rt.state)}</td>
                  <td className="num">{fmt(rt.kw, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PowerSystem() {
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">66 / 11 / 3.3 / 0.69 / 0.415 kV</div>
          <h1>Power system</h1>
          <p>Single line from the 66 kV incomers to the unit substations. A filled breaker is closed. Click a machine to open it.</p>
        </div>
      </div>
      <SingleLine />
    </>
  );
}
