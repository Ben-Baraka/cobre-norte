import { useMemo, useState } from "react";
import { MODEL } from "../model/build";
import { RUN_TRIPS, startChecks } from "../model/permissives";
import type { AreaId } from "../model/types";
import { AREAS } from "../model/types";
import { fmt, limitOf } from "./format";
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

const NARRATIVES: { area: string; title: string; blocks: { h: string; text: string }[] }[] = [
  {
    area: "100",
    title: "Primary crushing",
    blocks: [
      { h: "Purpose", text: "BN-101 receives ROM. FE-101 draws the bin into the 60-89 gyratory CR-101. CV-102 carries the product to the stockpile, under the magnet MA-101 and the metal detector MD-101. DC-101 is the crusher dust collector. PU-111 and PU-112 are the crusher lube pair." },
      { h: "Normal operation", text: "Start CV-102, then a lube pump, then CR-101, then FE-101. Design fresh feed is 1,750 t/h. FC-102, the DCS bubble on the crushing sheet, changes the apron-feeder speed to hold WIT-102 at the setpoint. The closed-side setting is ZT-114. DC-101 is started in an overload trip so the sheet opens with a priority 1 fault." },
      { h: "Alarms", text: "Bin level LIT-101 alarms at L 25, H 85, LL 12 and HH 92. Crusher lube PIT-111 alarms below 180 kPa and trips the narrative at 160 kPa for a start. Shell vibration VT-115 has a high alarm. XA-DC-101 is the dust-collector fault. XA-MD-101 is tramp metal on the discharge belt." },
      { h: "Interlocks", text: "FE-101 will not start unless CV-102 and CR-101 are running, the metal detector is clear, and the bin is under 92%. CR-101 will not start unless CV-102 is running and at least one lube pump is running with PIT-111 above 160 kPa. Loss of CV-102 trips the feeder in 2 s and the crusher in 3 s. A pull-wire on CV-102 trips the conveyor immediately. MA-101 is local: the HMI cannot start or stop it." },
    ],
  },
  {
    area: "200",
    title: "Coarse ore stockpile",
    blocks: [
      { h: "Purpose", text: "ST-201 is an 18,000 t live pocket. Three reclaim feeders drop onto CV-201, which feeds CV-202 into the SAG. MD-201 watches CV-202 for tramp metal." },
      { h: "Normal operation", text: "Feeders A and C run. Feeder B is the standby. FC-202 trims reclaim so WIT-202 matches the SAG feed. The pocket level LIT-201 is the live-tonnes indication." },
      { h: "Alarms", text: "LIT-201 uses the stockpile high and low limits. XA-MD-201 latches when metal is seen. The training load starts with that latch still set, so the feeders will not start until the discrete is reset." },
      { h: "Interlocks", text: "A reclaim feeder needs CV-201 running, LIT-201 above 12%, and XA-MD-201 reset. CV-201 needs CV-202 running. If the collection conveyor stops, the feeders trip in 2 s. If the SAG-feed conveyor stops, CV-201 trips in 2 s." },
    ],
  },
  {
    area: "300",
    title: "SAG mill circuit",
    blocks: [
      { h: "Purpose", text: "ML-301 is a 36 ft by 20 ft SAG with two 7.8 MW LCI pinions. Discharge falls into SU-301. PU-321A feeds the CY-301 cluster. PU-321B is standby. Oversize returns on CV-331 through the pebble crusher CR-341. PU-311A and PU-311B are the mill lube pair. FV-301 is the dilution valve." },
      { h: "Normal operation", text: "Both pinions are one machine to the operator: a start or stop on either acts on both. Inching drive ML-301I is only used with both pinions stopped. LC-301 holds the sump by the lead cyclone-pump speed. DC-323 holds cyclone-feed density by moving FV-301. Design mill speed is about 72% of critical." },
      { h: "Alarms", text: "Sump LIT-301 alarms outside 12 / 20 / 85 / 92%. Feed-end bearing TIT-311A starts above its 70°C high alarm, so the sheet opens in alarm. The trip permissive is 82°C. Lube PIT-311 start permissive is 160 kPa. Cyclone pressure and flow are PIT-322 and FIT-321." },
      { h: "Interlocks", text: "A pinion start needs the other pinion not tripped, the inching drive stopped, a lube pump running, lube pressure above 160 kPa, CV-202 and CV-331 running, and the feed-end bearing under 82°C. Lube pressure under 140 kPa for 3 s trips both pinions. A cyclone pump will not start with the sump under 8%." },
    ],
  },
  {
    area: "400",
    title: "Ball mill circuit",
    blocks: [
      { h: "Purpose", text: "ML-401 is the 22 ft by 36 ft ball mill, two 5.0 MW pinions. SU-401 and PU-421A feed CY-401. Overflow is the rougher new feed. FV-401 adds dilution water. PU-411A and PU-411B are the lube pair." },
      { h: "Normal operation", text: "The pinions start and stop as a pair. LC-401 holds the sump on the lead pump. DC-423 holds cyclone-feed density with FV-401. AIT-401-P80 is the overflow size, nominally 150 µm." },
      { h: "Alarms", text: "Sump, density, cyclone pressure and P80 each carry their own high and low limits on the alarm-setpoint list. Lube pressure uses the same 160 kPa start line and 140 kPa trip line as the SAG." },
      { h: "Interlocks", text: "A pinion needs its pair not tripped, a lube pump running, and PIT-411 above 160 kPa. Lube under 140 kPa for 3 s trips both pinions. PU-421A and PU-421B need the sump above 8%." },
    ],
  },
  {
    area: "500",
    title: "Rougher flotation",
    blocks: [
      { h: "Purpose", text: "TK-501 conditions the cyclone overflow. PU-501 feeds eight 300 m³ cells, FC-501 to FC-508. Each cell has its own level dart and air valve. BL-501A is the duty blower and BL-501B is standby. AN-501 is the on-stream analyser." },
      { h: "Normal operation", text: "Cell 1 on the P&ID carries the typical loop: LIT-501 to LC-501 to LV-501, and FIT-501 to the air valve FV-501. Cells 2 to 8 repeat that pair of loops. AC-520 holds conditioner pH by the speed of lime pump PU-901A. Design pH sits near 10.5 and cell level near 52%." },
      { h: "Alarms", text: "Each cell level has LL 18, L 30, H 72 and HH 80. Air flow has L 6 and H 22 Nm³/min. Conditioner level LIT-520 has a low alarm that is already returned in the journal. AIT-510-FE, the feed iron channel, is uncertain, so it raises a priority 3 communication alarm. Feed, concentrate and tails copper are AIT-510-CU, AIT-511-CU and AIT-512-CU." },
      { h: "Interlocks", text: "The cell agitators and the blower use the area emergency stop, remote, and no-fault checks. There is no hard cell-to-cell sequence in this simulator. Stopping the duty blower drops air until the standby is started. The analyser does not trip the bank." },
    ],
  },
  {
    area: "600",
    title: "Cleaner flotation and regrind",
    blocks: [
      { h: "Purpose", text: "ML-601 regrinds rougher concentrate. PU-601 feeds four cleaner cells, then two packed columns COL-611 and COL-612. Four scavenger cells retreat the cleaner tails, and PU-631 returns that stream." },
      { h: "Normal operation", text: "Cleaner 1 is drawn in full. Cells 2 to 4 use the same level loop. The columns are level-controlled. AIT-601-P80 is the regrind size. AIT-610-CU is the cleaner concentrate grade. Final concentrate leaves toward TH-701." },
      { h: "Alarms", text: "Column and cell levels use the same style of high and low bands as the roughers. Regrind power EI-ML-601 is a drive value on the DCS bubble. A coarse regrind P80 is an operator alarm, not a mill trip." },
      { h: "Interlocks", text: "Drives in this area start on remote, no fault, and the area emergency stop. The return pump PU-631 has no sump trip in this simulator. Loss of the regrind mill does not automatically stop the cleaner cells." },
    ],
  },
  {
    area: "700",
    title: "Concentrate handling",
    blocks: [
      { h: "Purpose", text: "TH-701 is the 25 m concentrate thickener, drawn in plan with the rake. PU-701A feeds the ceramic disc filter FL-701, with PU-701B on standby. Cake leaves on CV-701 to the covered pad BN-701." },
      { h: "Normal operation", text: "Bed level LIT-701 and underflow density DIT-701 set the pump speed the operator leaves in automatic. Rake torque JT-701 is watched against the drive limit. Cake moisture is AIT-702. Final grade AIT-710 and pad tonnes WIT-703 close the production tally." },
      { h: "Alarms", text: "High rake torque and a high bed are the two alarms that stop a thickener in the narrative, before a mechanical trip. Low underflow density means the filter is being fed too thin. Moisture above the high limit holds the cake on the pad for blending." },
      { h: "Interlocks", text: "The thickener rake, underflow pumps, filter and conveyor use the dewatering emergency stop plus remote and no-fault. The standby underflow pump does not auto-start in this simulator. The filter will run with the conveyor stopped, so the operator keeps CV-701 ahead of FL-701." },
    ],
  },
  {
    area: "800",
    title: "Tailings and return water",
    blocks: [
      { h: "Purpose", text: "TH-801 is the 65 m tailings thickener. PU-801A and PU-801B run to the TSF. PU-801C is standby. TK-851 collects return water and PU-851A sends it back, with PU-851B on standby." },
      { h: "Normal operation", text: "Two underflow pumps share the line. FIT-801 and PIT-802 are the line flow and pressure. Bed level LIT-801, density DIT-801 and rake load JT-801 describe the thickener. Final tails grade is AIT-801-CU, about 0.06% Cu when the plant is at design." },
      { h: "Alarms", text: "A high bed or high rake load is the same class of alarm as the concentrate thickener. Low return-water level LIT-851 trips the narrative before the return pumps lose suction. Line pressure PIT-802 high means a blocked TSF line." },
      { h: "Interlocks", text: "Underflow and return pumps use the dewatering emergency stop, remote, and no-fault. This simulator does not auto-start pump C. Stopping both running underflow pumps leaves the thickener bed to rise. The return pumps do not feed the process-water tank directly." },
    ],
  },
  {
    area: "900",
    title: "Reagents",
    blocks: [
      { h: "Purpose", text: "SL-901 slakes lime into TK-901. TK-902, TK-903 and TK-904 hold collector, frother and depressant. Each tank has a duty metering pump, PU-901A through PU-904A." },
      { h: "Normal operation", text: "Lime density is DIT-901. FIT-901 is the lime flow. PU-901A speed is the output of AC-520, so the pH loop and the lime pump are one circuit. Collector, frother and depressant are flow-dosed. Tank levels LIT-901 to LIT-904 are the reorder points." },
      { h: "Alarms", text: "A low tank level is a supply alarm, not a flotation trip. Loss of lime flow while AC-520 is in auto lets the conditioner pH fall. The pH high and low limits sit on AIT-520." },
      { h: "Interlocks", text: "Metering pumps start on remote, no fault, and the reagent emergency stop. They do not wait for flotation air or for a cell to be running. The slaker agitator is part of SL-901 and runs with the lime circuit." },
    ],
  },
  {
    area: "950",
    title: "Water, air and power",
    blocks: [
      { h: "Purpose", text: "TK-951 is the process-water tank. PU-951A is duty, with B and C standby. PU-961A and PU-961B are gland water and are essential. CA-971A and CA-971B are the instrument-air compressors. PU-981 is cooling water. EDG-991 is a 1,250 kW diesel source for the essential board. UPS-001 feeds the control network." },
      { h: "Normal operation", text: "PC-951 holds header pressure PIT-951 by the duty pump speed. FIT-951 is the header flow. One air compressor runs. Gland water stays up whenever slurry pumps are running. The diesel is stopped in the normal lineup and is not counted as a process load." },
      { h: "Alarms", text: "Low header pressure, low gland pressure and low air pressure are the three utility alarms that show up on the mills and the flotation air as a loss of service. Tank level LIT-951 low is a supply alarm. Cooling-water flow FIT-981 low is an alarm on the mill lubrication coolers." },
      { h: "Interlocks", text: "Utility drives use the utilities emergency stop, remote, and no-fault. This simulator does not auto-start a water or air standby when the duty unit trips, except the lube pairs on the crusher and the mills, which do start their standby. Stopping the duty water pump drops the header until an operator starts a standby. The diesel starts only from its faceplate and does not close onto a live board by itself." },
    ],
  },
];

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
