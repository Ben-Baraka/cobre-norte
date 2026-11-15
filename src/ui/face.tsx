import { useEffect, useState } from "react";
import { MODEL } from "../model/build";
import { startChecks } from "../model/permissives";
import { readSeries } from "../model/simulate";
import type { Point, Target } from "../model/types";
import { AREA_BY_ID } from "../model/types";
import { fmt, fmtTime, limitOf, motorWord } from "./format";
import { usePlant } from "./state";

const PEN = ["#79d0e6", "#e2b340", "#3cba7c", "#d4894c", "#e07a7a", "#7eb0e0"];

export function Spark({ tag, windowMs = 20 * 60 * 1000 }: { tag: string; windowMs?: number }) {
  const { live } = usePlant();
  const pts = readSeries(live, tag, windowMs);
  if (pts.length < 2) return null;
  const width = 360;
  const height = 56;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * width;
      const y = height - ((p.v - min) / span) * (height - 6) - 3;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${tag} recent trend`}>
      <path d={d} />
    </svg>
  );
}

function Close() {
  const { closeFace } = usePlant();
  return (
    <button className="x" onClick={closeFace} aria-label="Close faceplate">
      ×
    </button>
  );
}

function pointValue(tag: string) {
  const point = MODEL.byTag.get(tag);
  return point;
}

export function FaceHost() {
  const { stack, closeFace } = usePlant();
  const target = stack[stack.length - 1];
  if (!target) return null;
  return (
    <aside className="face" aria-label="Faceplate">
      <div className="fp">
        {stack.length > 1 ? (
          <button className="linkish" onClick={closeFace}>
            Back
          </button>
        ) : null}
        <FaceBody target={target} />
      </div>
    </aside>
  );
}

function FaceBody({ target }: { target: Target }) {
  if (target.kind === "analog") return <AnalogFace tag={target.tag} />;
  if (target.kind === "discrete") return <DiscreteFace tag={target.tag} />;
  if (target.kind === "motor") return <MotorFace tag={target.tag} />;
  if (target.kind === "valve") return <ValveFace tag={target.tag} />;
  if (target.kind === "equip") return <EquipFace tag={target.tag} />;
  if (target.kind === "plc") return <PlcFace id={target.id} />;
  return <BasisFace />;
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <div className="fp-top">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <Close />
    </div>
  );
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <table className="meta">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnalogFace({ tag }: { tag: string }) {
  const { live, cmd, open } = usePlant();
  const point = pointValue(tag);
  if (!point) return <Header title={tag} text="Tag not in the IO list" />;
  const value = live.values[point.index];
  const loop = MODEL.loopByPv.get(tag);
  const rt = loop ? live.loops[loop.index] : undefined;
  const alarm = limitOf(point, value);
  const span = point.max - point.min || 1;
  const pct = (n: number) => ((n - point.min) / span) * 100;
  return (
    <>
      <Header title={point.tag} text={point.desc} />
      <div className="note">
        {point.io} · {point.signal} · {AREA_BY_ID[point.area].name}
      </div>
      <div className="loop-grid">
        <div className="vbar" aria-hidden>
          <div className={`vbar-fill ${alarm === "HH" || alarm === "LL" ? "bad" : alarm ? "warn" : ""}`} style={{ height: `${Math.max(0, Math.min(100, pct(value)))}%` }} />
          {point.hh != null ? <i className="tick" style={{ bottom: `${pct(point.hh)}%` }} /> : null}
          {point.h != null ? <i className="tick h" style={{ bottom: `${pct(point.h)}%` }} /> : null}
          {point.l != null ? <i className="tick l" style={{ bottom: `${pct(point.l)}%` }} /> : null}
          {point.ll != null ? <i className="tick" style={{ bottom: `${pct(point.ll)}%` }} /> : null}
          {rt ? <i className="vbar-sp" style={{ bottom: `${pct(rt.sp)}%` }} /> : null}
        </div>
        <div>
          <div className="fp-pv">
            {fmt(value, point.dec)} <em>{point.eu}</em>
          </div>
          {alarm ? <div className={alarm === "HH" || alarm === "LL" ? "pri p1" : "pri p2"}>{alarm}</div> : <div className="note">Within limits</div>}
          {rt && loop ? (
            <>
              <div className="fp-actions">
                {(["AUTO", "MAN", "CAS"] as const).map((mode) => (
                  <button key={mode} className={rt.mode === mode ? "btn on" : "btn"} onClick={() => cmd({ type: "mode", id: loop.id, mode })}>
                    {mode}
                  </button>
                ))}
              </div>
              <div className="note">
                SP {fmt(rt.sp, point.dec)} {point.eu} · OP {fmt(rt.op, 1)} %
              </div>
              <div className="sp-row">
                <button onClick={() => cmd({ type: "sp", id: loop.id, value: rt.sp - stepOf(point) })}>−</button>
                <button onClick={() => cmd({ type: "sp", id: loop.id, value: rt.sp + stepOf(point) })}>+</button>
                {rt.mode !== "AUTO" ? (
                  <>
                    <button onClick={() => cmd({ type: "op", id: loop.id, value: rt.op - 2 })}>OP−</button>
                    <button onClick={() => cmd({ type: "op", id: loop.id, value: rt.op + 2 })}>OP+</button>
                  </>
                ) : null}
              </div>
              <div className="note">
                {loop.id} {loop.name} · {loop.action} acting
              </div>
            </>
          ) : (
            <div className="note">Indicator</div>
          )}
        </div>
      </div>
      <Spark tag={tag} />
      <Meta
        rows={[
          ["Quality", live.quality[point.index] === 2 ? "Forced" : live.quality[point.index] === 3 ? "Uncertain" : live.quality[point.index] === 1 ? "Bad" : "Good"],
          ["Range", `${fmt(point.min, point.dec)} – ${fmt(point.max, point.dec)} ${point.eu}`],
          ["HH / H", `${point.hh ?? "—"} / ${point.h ?? "—"}`],
          ["L / LL", `${point.l ?? "—"} / ${point.ll ?? "—"}`],
          ["PLC", point.plc],
          ["Address", `${point.address} · ${point.card}`],
          ["Cable", point.cable || "—"],
          ["Device", point.device],
          ["P&ID", point.pid],
          ["Fail", point.fail],
          ["Source", point.source],
        ]}
      />
      {MODEL.equipByTag.get(point.equip) ? (
        <button className="linkish" onClick={() => open({ kind: "equip", tag: point.equip })}>
          Open {point.equip}
        </button>
      ) : null}
    </>
  );
}

function stepOf(point: Point): number {
  const span = point.max - point.min;
  if (span <= 5) return 0.1;
  if (span <= 20) return 0.5;
  if (span <= 200) return 1;
  return 10;
}

function DiscreteFace({ tag }: { tag: string }) {
  const { live, cmd } = usePlant();
  const point = MODEL.byTag.get(tag);
  if (!point) return <Header title={tag} text="Unknown discrete" />;
  const raw = live.values[point.index] >= 0.5 ? 1 : 0;
  const word = point.words ? point.words[raw] : raw ? "ON" : "OFF";
  const alarmed = point.alarmWhen != null && raw === point.alarmWhen;
  return (
    <>
      <Header title={point.tag} text={point.desc} />
      <div className={alarmed ? "state trip" : raw ? "state run" : "state stop"}>{word}</div>
      <Meta
        rows={[
          ["Raw", String(raw)],
          ["Quality", live.quality[point.index] === 2 ? "Forced" : "Good"],
          ["Type", `${point.io} · ${point.signal}`],
          ["PLC", `${point.plc} ${point.address}`],
          ["Card", point.card],
          ["Cable", point.cable || "—"],
          ["Device", point.device],
          ["P&ID", point.pid],
          ["Fail", point.fail],
          ["Alarm", point.alarmWhen == null ? "None" : `When ${point.words?.[point.alarmWhen] ?? point.alarmWhen}`],
        ]}
      />
      {point.io === "DI" ? (
        <div className="fp-actions">
          <button className="btn" onClick={() => cmd({ type: "force", tag, value: 1 })}>
            Force 1
          </button>
          <button className="btn" onClick={() => cmd({ type: "force", tag, value: 0 })}>
            Force 0
          </button>
          <button className="btn" onClick={() => cmd({ type: "unforce", tag })}>
            Remove force
          </button>
          {point.latched ? (
            <button className="btn" onClick={() => cmd({ type: "latchReset", tag })}>
              Reset latch
            </button>
          ) : null}
        </div>
      ) : (
        <p className="note">Output. The drive faceplate is the command for this point.</p>
      )}
    </>
  );
}

function MotorFace({ tag }: { tag: string }) {
  const { live, cmd, open } = usePlant();
  const spec = MODEL.motorByTag.get(tag);
  if (!spec) return <Header title={tag} text="Not a motor" />;
  const rt = live.motors[spec.index];
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const id = window.setTimeout(() => setArm(false), 4000);
    return () => window.clearTimeout(id);
  }, [arm]);
  const checks = spec.start === "Static" ? [] : startChecks(live, tag);
  const reject = live.reject?.tag === tag ? live.reject.text : "";
  const stop = () => {
    if (spec.kw >= 500 && !arm) {
      setArm(true);
      return;
    }
    setArm(false);
    cmd({ type: "stop", tag });
  };
  return (
    <>
      <Header title={spec.tag} text={spec.name} />
      <div className={`state ${rt.state === "running" ? "run" : rt.state === "tripped" ? "trip" : rt.state === "starting" || rt.state === "stopping" ? "start" : "stop"}`}>
        {spec.start === "Static" ? "ENERGISED" : motorWord(rt.state)}
        {rt.local ? " · LOCAL" : ""}
      </div>
      {rt.tripReason ? <div className="reject">{rt.tripReason}</div> : null}
      {reject ? <div className="reject">{reject}</div> : null}
      {spec.pair ? <p className="note">Paired with {spec.pair}. Start and stop act on both drives.</p> : null}
      {spec.start !== "Static" ? (
        <div className="fp-actions">
          <button className="btn good" disabled={rt.local || rt.state !== "stopped"} onClick={() => cmd({ type: "start", tag })}>
            Start
          </button>
          <button className="btn danger" disabled={rt.local || (rt.state !== "running" && rt.state !== "starting")} onClick={stop}>
            {arm ? "Confirm stop" : "Stop"}
          </button>
          <button className="btn" disabled={rt.state !== "tripped"} onClick={() => cmd({ type: "reset", tag })}>
            Reset
          </button>
        </div>
      ) : null}
      <div className="fp-pv">
        {fmt(rt.amps, spec.kw >= 200 ? 0 : 1)} <em>A</em>
      </div>
      <div className="note">
        {fmt(rt.kw, 0)} kW · {fmt(rt.speed, 1)} % speed
        {spec.ratedRpm ? ` · ${fmt((spec.ratedRpm * rt.speed) / 100, 1)} rpm` : ""}
      </div>
      {(spec.start === "VFD" || spec.start === "LCI") && rt.state === "running" ? (
        <label className="note">
          Speed reference {fmt(rt.speedSp, 0)} %
          <input className="range" type="range" min={0} max={100} value={rt.speedSp} onChange={(e) => cmd({ type: "speed", tag, value: Number(e.target.value) })} />
        </label>
      ) : null}
      {spec.ei ? <Spark tag={spec.ei} /> : <Spark tag={spec.ii} />}
      <h3>Permissives</h3>
      {checks.length === 0 ? <p className="note">No start permissives. This load stays energised.</p> : null}
      {checks.map((check) => (
        <div className="check" key={check.label}>
          <span>{check.label}</span>
          <i className={check.ok ? "ok" : "bad"}>{check.ok ? "OK" : "BLOCK"}</i>
        </div>
      ))}
      <Meta
        rows={[
          ["Rating", `${fmt(spec.kw, 0)} kW · ${spec.volts >= 1000 ? spec.volts / 1000 + " kV" : spec.volts + " V"}`],
          ["FLC", `${fmt(spec.flc, 0)} A`],
          ["PF / eff", `${spec.pf.toFixed(2)} / ${spec.eff.toFixed(3)}`],
          ["Start", spec.start],
          ["Duty", spec.duty],
          ["MCC", `${spec.mcc} cell ${spec.cell}`],
          ["Feeder", spec.feeder],
          ["Bus", spec.bus],
          ["Cable", spec.cable],
          ["Essential", spec.essential ? "Yes" : "No"],
          ["Run hours", fmt(rt.hours, 0)],
          ["Starts", String(rt.starts)],
        ]}
      />
      <button className="linkish" onClick={() => open({ kind: "equip", tag: spec.equip })}>
        Equipment {spec.equip}
      </button>
    </>
  );
}

function ValveFace({ tag }: { tag: string }) {
  const { live, open, cmd } = usePlant();
  const valve = MODEL.valves.find((v) => v.tag === tag);
  if (!valve) return <Header title={tag} text="Unknown valve" />;
  const pos = MODEL.byTag.get(valve.zt);
  const position = pos ? live.values[pos.index] : 0;
  const loop = MODEL.loops.find((l) => l.opTag === valve.zc);
  const rt = loop ? live.loops[loop.index] : undefined;
  return (
    <>
      <Header title={valve.tag} text={valve.name} />
      <div className="fp-pv">
        {fmt(position, 1)} <em>% open</em>
      </div>
      <div className="track">
        <span style={{ width: `${Math.max(0, Math.min(100, position))}%` }} />
      </div>
      <div className="note" style={{ marginTop: 8 }}>
        {live.values[MODEL.byTag.get(valve.zso)!.index] > 0.5 ? "Open limit" : "Not at open limit"} ·{" "}
        {live.values[MODEL.byTag.get(valve.zsc)!.index] > 0.5 ? "Closed limit" : "Not at closed limit"}
      </div>
      {loop && rt ? (
        <>
          <div className="fp-actions">
            <button className={rt.mode === "AUTO" ? "btn on" : "btn"} onClick={() => cmd({ type: "mode", id: loop.id, mode: "AUTO" })}>
              Auto
            </button>
            <button className={rt.mode === "MAN" ? "btn on" : "btn"} onClick={() => cmd({ type: "mode", id: loop.id, mode: "MAN" })}>
              Manual
            </button>
            <button className="btn" onClick={() => cmd({ type: "op", id: loop.id, value: rt.op - 5 })}>
              Close
            </button>
            <button className="btn" onClick={() => cmd({ type: "op", id: loop.id, value: rt.op + 5 })}>
              Open
            </button>
          </div>
          <div className="note">
            {loop.id} command {fmt(rt.op, 0)} % · setpoint on {loop.pv}
          </div>
          <button className="linkish" onClick={() => open({ kind: "analog", tag: loop.pv })}>
            Open {loop.pv}
          </button>
        </>
      ) : null}
      <Meta
        rows={[
          ["Fail", valve.fail === "FC" ? "Fail closed" : "Fail open"],
          ["Device", valve.device],
          ["P&ID", valve.pid],
          ["Position", valve.zt],
          ["Command", valve.zc],
        ]}
      />
    </>
  );
}

function EquipFace({ tag }: { tag: string }) {
  const { live, open } = usePlant();
  const equip = MODEL.equipByTag.get(tag);
  if (!equip) return <Header title={tag} text="Unknown equipment" />;
  const motors = equip.motors.map((m) => MODEL.motorByTag.get(m)!).filter(Boolean);
  const points = (MODEL.pointsByEquip.get(tag) ?? []).slice(0, 14);
  return (
    <>
      <Header title={equip.tag} text={equip.name} />
      <p className="note">
        {equip.maker} · {equip.model}
      </p>
      <p>{equip.blurb}</p>
      <h3>Design</h3>
      <Meta rows={equip.design.map((row) => [row.label, row.value])} />
      {motors.length ? <h3>Drives</h3> : null}
      {motors.map((spec) => {
        const rt = live.motors[spec.index];
        return (
          <div className="check" key={spec.tag}>
            <button className="tagbtn" onClick={() => open({ kind: "motor", tag: spec.tag })}>
              {spec.tag}
            </button>
            <span>
              {motorWord(rt.state)} · {fmt(rt.amps, 0)} A
            </span>
          </div>
        );
      })}
      <h3>Related IO</h3>
      {points.map((point) => (
        <div className="check" key={point.tag}>
          <button className="tagbtn" onClick={() => open({ kind: point.words ? "discrete" : "analog", tag: point.tag })}>
            {point.tag}
          </button>
          <span>{fmt(live.values[point.index], point.dec)} {point.eu}</span>
        </div>
      ))}
      <p className="note">P&ID {equip.pids.join(", ")}</p>
    </>
  );
}

function PlcFace({ id }: { id: string }) {
  const { live } = usePlant();
  const plc = MODEL.plcs.find((p) => p.id === id);
  const scan = MODEL.byTag.get(`XI-${id}`);
  const beat = MODEL.byTag.get(`HS-${id}`);
  return (
    <>
      <Header title={id} text={plc?.name ?? "Controller"} />
      <div className={beat && live.values[beat.index] > 0.5 ? "state run" : "state trip"}>
        {beat && live.values[beat.index] > 0.5 ? "HEARTBEAT OK" : "HEARTBEAT LOST"}
      </div>
      <Meta
        rows={[
          ["CPU", plc?.cpu ?? "—"],
          ["Address", plc?.ip ?? "—"],
          ["Scan", scan ? `${fmt(live.values[scan.index], 0)} ms` : "—"],
        ]}
      />
    </>
  );
}

function BasisFace() {
  return (
    <>
      <Header title="Cobre Norte" text="Concentrator 1 basis of design" />
      <p>Training simulator for a 42,000 t/d porphyry copper concentrator. Numbers are sample process data, not a live plant connection.</p>
      <Meta
        rows={[
          ["Fresh feed", "1,750 t/h"],
          ["Head grade", "0.62 % Cu"],
          ["Recovery", "89 % design"],
          ["Final concentrate", "27 % Cu"],
          ["Grind P80", "150 µm"],
          ["Primary", "Metso Superior 60-89"],
          ["SAG", "36 ft × 20 ft, 2 × 7.8 MW"],
          ["Ball mill", "22 ft × 36 ft, 2 × 5.0 MW"],
          ["Roughers", "8 × 300 m³"],
          ["Tailings", "65 m high-rate"],
          ["Control", "ControlLogix, six PLCs"],
          ["Incoming", "66 kV, two 45 MVA"],
        ]}
      />
      <p className="note">Station CR-01 · {fmtTime(Date.now(), true)}</p>
    </>
  );
}

export const TREND_COLORS = PEN;
