import { useState } from "react";
import { MODEL } from "../model/build";
import type { AreaId, ScreenId } from "../model/types";
import { AREA_BY_ID, PLCS, PROCESS_SCREENS } from "../model/types";
import { FaceHost } from "./face";
import { fmtTime, limitOf } from "./format";
import { IoList, LoadList, PowerSystem } from "./lists";
import { Alarms, Trends } from "./monitor";
import { SCENES, SceneView, areaOfScreen } from "./mimic";
import { Overview, areaTone } from "./overview";
import { PlantProvider, usePlant } from "./state";

function plantWord(live: ReturnType<typeof usePlant>["live"]): { text: string; tone: string } {
  const mills = ["ML-301A", "ML-301B", "ML-401A", "ML-401B"];
  if (mills.some((tag) => live.motors[MODEL.motorByTag.get(tag)!.index].state === "tripped")) return { text: "MILL TRIP", tone: "trip" };
  if (live.kpis.feed < 200) return { text: "FEED OFF", tone: "off" };
  if (live.alarms.some((a) => a.state !== "CLEAR" && a.priority === 1)) return { text: "UPSET", tone: "upset" };
  if (live.alarms.some((a) => a.state !== "CLEAR" && a.priority === 2)) return { text: "ALARM", tone: "alarm" };
  return { text: "RUNNING", tone: "run" };
}

function Shell() {
  const { live, screen, go, open, cmd, stack } = usePlant();
  const word = plantWord(live);
  const banner = live.alarms.find((a) => a.state === "UNACK") ?? live.alarms.find((a) => a.state === "RTN");
  const unacked = live.alarms.filter((a) => a.state === "UNACK").length;
  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <b>COBRE NORTE</b>
            <span>CONCENTRATOR HMI</span>
          </div>
        </div>
        <div className={`plant-word ${word.tone}`}>{word.text}</div>
        <Search />
        <div className="top-meta">
          <div className="plcs">
            {PLCS.filter((plc) => plc.id.startsWith("PLC")).map((plc) => {
              const scan = MODEL.byTag.get(`XI-${plc.id}`);
              const hot = scan ? live.values[scan.index] > 40 : false;
              return <button key={plc.id} className={hot ? "plc warn" : "plc"} title={`${plc.id} ${plc.ip}`} onClick={() => open({ kind: "plc", id: plc.id })} />;
            })}
          </div>
          <div className="clock">
            {fmtTime(live.now)}
            <small>
              {new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", day: "2-digit", month: "short", year: "numeric" }).format(new Date(live.now))} · CR-01
            </small>
          </div>
          <div className="simchip">Simulator</div>
        </div>
      </header>
      <div className="body">
        <nav className="nav">
          {["Process", "Lists", "System"].map((group) => (
            <div key={group}>
              <div className="nav-group">{group}</div>
              {PROCESS_SCREENS.filter((item) => item.group === group).map((item) => (
                <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => go(item.id)}>
                  {item.label}
                  {item.id === "alarms" && unacked ? <span className="badge">{unacked}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="main">
          <div className="stage" data-screen={screen}>
            <Screen id={screen} />
          </div>
          {stack.length ? <FaceHost /> : null}
        </div>
      </div>
      <footer className={live.horn && !live.silenced ? "alarmbar horn" : "alarmbar"}>
        {banner ? (
          <>
            <span className={`pri p${banner.priority}`}>P{banner.priority}</span>
            <span>{fmtTime(banner.time)}</span>
            <span className="grow">{banner.tag} · {banner.text} · {banner.value} · {banner.state}</span>
            {banner.state === "UNACK" || banner.state === "RTN" ? (
              <button className="btn" onClick={() => cmd({ type: "ack", id: banner.id })}>Ack</button>
            ) : null}
            <button className="btn" onClick={() => cmd({ type: "silence" })}>Silence</button>
          </>
        ) : (
          <span className="quiet">No unacknowledged alarms</span>
        )}
      </footer>
    </div>
  );
}

function Search() {
  const { open, go } = usePlant();
  const [q, setQ] = useState("");
  const hits = q.trim().length < 2 ? [] : MODEL.points.filter((p) => `${p.tag} ${p.desc}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return (
    <div className="search">
      <input placeholder="Tag search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tag search" />
      {hits.length ? (
        <div className="hits">
          {hits.map((point) => (
            <button
              key={point.tag}
              onClick={() => {
                open({ kind: point.words ? "discrete" : "analog", tag: point.tag });
                if (point.area !== "sys") go(point.area);
                setQ("");
              }}
            >
              {point.tag}
              <small>{point.desc}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Screen({ id }: { id: ScreenId }) {
  if (id === "overview") return <Overview />;
  if (id === "io") return <IoList />;
  if (id === "loads") return <LoadList />;
  if (id === "power") return <PowerSystem />;
  if (id === "trends") return <Trends />;
  if (id === "alarms") return <Alarms />;
  const area = areaOfScreen(id);
  if (!area) return <Overview />;
  return <AreaScreen id={area} />;
}

function AreaScreen({ id }: { id: Exclude<AreaId, "sys"> }) {
  const area = AREA_BY_ID[id];
  const scene = SCENES[id];
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="kicker">{area.code} · {area.plc}</div>
          <h1>{area.name}</h1>
          <p>{scene.note}</p>
        </div>
      </div>
      <SceneView scene={scene} />
      <Tiles area={id} />
    </>
  );
}

function Tiles({ area }: { area: AreaId }) {
  const { live, open } = usePlant();
  const loops = MODEL.loops.filter((loop) => loop.area === area && loop.feature);
  const used = new Set(loops.map((loop) => loop.pv));
  const points = MODEL.points.filter((point) => point.area === area && point.feature && !used.has(point.tag));
  const tone = areaTone(area, live);
  return (
    <>
      <div className="note" style={{ marginTop: 8 }}>Group display · area {tone}</div>
      <div className="tiles">
        {loops.map((loop) => {
          const point = MODEL.byTag.get(loop.pv);
          if (!point) return null;
          const value = live.values[point.index];
          const alarm = limitOf(point, value);
          const rt = live.loops[loop.index];
          return (
            <button key={loop.id} className={`tile ${alarm === "HH" || alarm === "LL" ? "bad" : alarm ? "warn" : ""}`} onClick={() => open({ kind: "analog", tag: loop.pv })}>
              <small>{loop.pv}</small>
              <b>{fmtNum(value, point.dec)} {point.eu}</b>
              <span className="sub">SP {fmtNum(rt.sp, point.dec)} · {rt.mode} · {loop.id}</span>
            </button>
          );
        })}
        {points.map((point) => {
          const value = live.values[point.index];
          const alarm = limitOf(point, value);
          return (
            <button key={point.tag} className={`tile ${alarm === "HH" || alarm === "LL" ? "bad" : alarm ? "warn" : ""}`} onClick={() => open({ kind: point.words ? "discrete" : "analog", tag: point.tag })}>
              <small>{point.tag}</small>
              <b>{fmtNum(value, point.dec)} {point.eu}</b>
              <span className="sub">{point.desc}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function fmtNum(n: number, dec: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function App() {
  return (
    <PlantProvider>
      <Shell />
    </PlantProvider>
  );
}
