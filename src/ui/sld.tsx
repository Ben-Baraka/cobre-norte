import { MODEL } from "../model/build";
import type { MotorState } from "../model/types";
import { fmt } from "./format";
import { usePlant } from "./state";

const INK = "#d5e2ee";
const DIM = "#8ea0b3";
const PAPER = "#101820";

function tone(state?: MotorState): string {
  if (state === "running") return "#3cba7c";
  if (state === "starting" || state === "stopping") return "#e2b340";
  if (state === "tripped") return "#e15b5b";
  return "#8b97a6";
}

function loadText(id: string, kw: number): string {
  const bus = MODEL.buses.find((item) => item.id === id);
  if (!bus) return "";
  const pct = (kw / (bus.mva * 1000 * 0.9)) * 100;
  return `${fmt(kw, 0)} kW · ${fmt(pct, 0)}%`;
}

function hiddenCount(bus: string, shown: string[]): number {
  const keep = new Set(shown);
  return MODEL.motors.filter((motor) => motor.bus === bus && motor.start !== "Diesel" && motor.start !== "Static" && !keep.has(motor.tag)).length;
}

export function SingleLine() {
  const { live, open } = usePlant();
  const kwOf = (id: string) => MODEL.motors
    .filter((motor) => motor.bus === id && motor.start !== "Diesel")
    .reduce((sum, motor) => sum + live.motors[motor.index].kw, 0);

  const feeder = (tag: string, x: number, y: number) => {
    const motor = MODEL.motorByTag.get(tag);
    if (!motor) return null;
    const state = live.motors[motor.index].state;
    const color = tone(state);
    const closed = state === "running" || state === "starting" || state === "stopping";
    return (
      <g key={tag} style={{ cursor: "pointer" }} onClick={() => open({ kind: "motor", tag })}>
        <rect x={x - 26} y={y} width="52" height="108" fill="transparent" />
        <line x1={x} y1={y} x2={x} y2={y + 16} stroke={INK} />
        <rect x={x - 6} y={y + 16} width="12" height="12" fill={closed ? color : PAPER} stroke={color} strokeWidth="1.4" />
        {state === "tripped" ? <path d={`M ${x - 3.5} ${y + 19} L ${x + 3.5} ${y + 25} M ${x + 3.5} ${y + 19} L ${x - 3.5} ${y + 25}`} stroke={color} strokeWidth="1.4" /> : null}
        <line x1={x} y1={y + 28} x2={x} y2={y + 46} stroke={INK} />
        <circle cx={x} cy={y + 60} r="13" fill={PAPER} stroke={color} strokeWidth="1.6" />
        <text x={x} y={y + 64} textAnchor="middle" fill={color} fontSize="11">M</text>
        <text x={x} y={y + 86} textAnchor="middle" fill={INK} fontSize="10">{tag}</text>
        <text x={x} y={y + 99} textAnchor="middle" fill="#79d0e6" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          {fmt(live.motors[motor.index].kw, 0)}
        </text>
      </g>
    );
  };

  const transformer = (x: number, y: number, name: string, anchor: "start" | "end" = "start") => (
    <g key={`${name}-${x}`}>
      <circle cx={x} cy={y - 9} r="13" fill={PAPER} stroke={INK} />
      <circle cx={x} cy={y + 9} r="13" fill={PAPER} stroke={INK} />
      <text x={anchor === "start" ? x + 18 : x - 18} y={y + 4} textAnchor={anchor} fill={DIM} fontSize="11">{name}</text>
    </g>
  );

  const bar = (x: number, y: number, w: number, title: string, sub: string, labelX = x) => (
    <g key={`${title}-${x}`}>
      <text x={labelX} y={y - 26} fill={INK} fontSize="12">{title}</text>
      <text x={labelX} y={y - 13} fill={DIM} fontSize="10">{sub}</text>
      <line x1={x} y1={y} x2={x + w} y2={y} stroke={INK} strokeWidth="4.5" strokeLinecap="square" />
    </g>
  );

  const wire = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} />
  );

  const fltExtra = hiddenCount("BUS-415-FLT", ["AG-520"]);
  const prcExtra = hiddenCount("BUS-415-PRC", ["CA-971B", "PU-981"]);
  const diesel = MODEL.motorByTag.get("EDG-991");
  const dieselState = diesel ? live.motors[diesel.index].state : undefined;
  const dieselColor = tone(dieselState);
  const dieselClosed = dieselState === "running" || dieselState === "starting" || dieselState === "stopping";

  const cru33 = [80, 210, 280];
  const cru690 = [370, 440, 530, 590];
  const grdLeft = [1310, 1385, 1460, 1535];
  const grdRight = [1670, 1735, 1800, 1865, 1930];
  const grdTags = ["PU-321A", "PU-321B", "CV-331", "CR-341", "PU-421A", "PU-421B", "BL-501A", "BL-501B", "ML-601"];
  const dewXs = [1310, 1385, 1460, 1535, 1610, 1685, 1760, 1835];
  const dewTags = ["PU-801A", "PU-801B", "PU-801C", "PU-851A", "PU-851B", "PU-951A", "PU-951B", "PU-951C"];
  const prcXs = [80, 170, 320, 400];
  const prcTags = ["PU-501", "PU-601", "PU-631", "FL-701"];
  const emXs = [1340, 1405, 1470, 1535, 1600, 1665, 1730, 1795, 1860];
  const emTags = ["PU-111", "PU-112", "PU-311A", "PU-311B", "PU-411A", "PU-411B", "PU-961A", "PU-961B", "CA-971A"];

  return (
    <svg className="sld" viewBox="0 0 2160 1080">
      <rect width="2160" height="1080" fill={PAPER} />

      <text x="40" y="24" fill={DIM} fontSize="12">66 kV utility</text>
      <line x1="40" y1="36" x2="2120" y2="36" stroke={INK} strokeWidth="4.5" />
      {wire(400, 36, 400, 66)}
      {wire(1500, 36, 1500, 66)}
      {transformer(400, 88, "TX-101A   45 MVA")}
      {transformer(1500, 88, "TX-101B   45 MVA")}
      {wire(400, 110, 400, 150)}
      {wire(1500, 110, 1500, 150)}

      {bar(40, 150, 830, "11 kV Bus A", loadText("BUS-11A", kwOf("BUS-11A")))}
      {bar(900, 150, 1140, "11 kV Bus B", loadText("BUS-11B", kwOf("BUS-11B")), 1320)}
      {feeder("CR-101", 100, 150)}
      {feeder("ML-301A", 300, 150)}
      {feeder("ML-401A", 560, 150)}
      {feeder("ML-301B", 1240, 150)}
      {feeder("ML-401B", 1760, 150)}

      {wire(175, 150, 175, 270)}
      {wire(470, 150, 470, 270)}
      {wire(850, 150, 850, 270)}
      {transformer(175, 292, "TX-301A")}
      {transformer(470, 292, "TX-401")}
      {transformer(850, 292, "TX-501")}
      {wire(175, 314, 175, 370)}
      {wire(470, 314, 470, 370)}
      {wire(850, 314, 850, 370)}

      {bar(40, 370, 280, "3.3 kV Crushing", loadText("BUS-3.3-CRU", kwOf("BUS-3.3-CRU")))}
      {bar(340, 370, 280, "690 V Crushing", loadText("BUS-690-CRU", kwOf("BUS-690-CRU")))}
      {bar(640, 370, 230, "415 V Flotation", loadText("BUS-415-FLT", kwOf("BUS-415-FLT")))}
      {feeder("CV-102", cru33[0], 370)}
      {feeder("CV-201", cru33[1], 370)}
      {feeder("CV-202", cru33[2], 370)}
      {feeder("FE-101", cru690[0], 370)}
      {feeder("FE-201A", cru690[1], 370)}
      {feeder("FE-201B", cru690[2], 370)}
      {feeder("FE-201C", cru690[3], 370)}
      {feeder("AG-520", 700, 370)}
      <g>
        {wire(780, 370, 780, 404)}
        <rect x="752" y="404" width="56" height="28" fill={PAPER} stroke={INK} />
        <text x="780" y="422" textAnchor="middle" fill={DIM} fontSize="10">+{fltExtra} MCC</text>
      </g>

      {wire(1600, 150, 1600, 270)}
      {transformer(1600, 292, "TX-301B", "end")}
      {wire(1600, 314, 1600, 370)}
      {bar(1280, 370, 680, "3.3 kV Grinding", loadText("BUS-3.3-GRD", kwOf("BUS-3.3-GRD")))}
      {grdTags.map((tag, index) => feeder(tag, [...grdLeft, ...grdRight][index], 370))}

      {wire(2040, 150, 2040, 448)}
      {transformer(2040, 470, "TX-302")}
      {wire(2040, 492, 2040, 560)}
      {bar(1280, 560, 760, "3.3 kV Dewatering", loadText("BUS-3.3-DEW", kwOf("BUS-3.3-DEW")), 1320)}
      {dewTags.map((tag, index) => feeder(tag, dewXs[index], 560))}

      {wire(960, 150, 960, 618)}
      {transformer(960, 640, "TX-402", "end")}
      {wire(960, 662, 960, 700)}
      {wire(960, 700, 240, 700)}
      {wire(240, 700, 240, 760)}

      {wire(1060, 150, 1060, 658)}
      {transformer(1060, 680, "TX-502", "end")}
      {wire(1060, 702, 1060, 712)}
      {wire(1060, 712, 640, 712)}
      {wire(640, 712, 640, 760)}

      {wire(1160, 150, 1160, 688)}
      {transformer(1160, 710, "TX-EM", "end")}
      {wire(1160, 732, 1160, 760)}
      {wire(1160, 760, 1280, 760)}

      {bar(40, 760, 420, "690 V Process", loadText("BUS-690-PRC", kwOf("BUS-690-PRC")))}
      {bar(480, 760, 340, "415 V Process", loadText("BUS-415-PRC", kwOf("BUS-415-PRC")))}
      {bar(1280, 760, 740, "415 V Essential", loadText("BUS-EM", kwOf("BUS-EM")))}
      {prcTags.map((tag, index) => feeder(tag, prcXs[index], 760))}
      {feeder("CA-971B", 540, 760)}
      {feeder("PU-981", 730, 760)}
      <g>
        {wire(790, 760, 790, 794)}
        <rect x="762" y="794" width="56" height="28" fill={PAPER} stroke={INK} />
        <text x="790" y="812" textAnchor="middle" fill={DIM} fontSize="10">+{prcExtra} MCC</text>
      </g>
      {emTags.map((tag, index) => feeder(tag, emXs[index], 760))}

      <g style={{ cursor: "pointer" }} onClick={() => open({ kind: "motor", tag: "EDG-991" })}>
        <rect x="1968" y="760" width="64" height="150" fill="transparent" />
        {wire(2000, 760, 2000, 804)}
        <rect x="1994" y="804" width="12" height="12" fill={dieselClosed ? dieselColor : PAPER} stroke={dieselColor} strokeWidth="1.4" />
        {wire(2000, 816, 2000, 840)}
        <circle cx="2000" cy="856" r="15" fill={PAPER} stroke={dieselColor} strokeWidth="1.6" />
        <text x="2000" y="861" textAnchor="middle" fill={dieselColor} fontSize="12">G</text>
        <text x="2000" y="888" textAnchor="middle" fill={INK} fontSize="10">EDG-991</text>
        <text x="2000" y="902" textAnchor="middle" fill={DIM} fontSize="10">1,250 kW</text>
      </g>

      <g>
        <rect x="40" y="1032" width="12" height="12" fill="#3cba7c" />
        <text x="60" y="1043" fill={DIM} fontSize="12">Breaker closed</text>
        <rect x="190" y="1032" width="12" height="12" fill={PAPER} stroke="#8b97a6" />
        <text x="210" y="1043" fill={DIM} fontSize="12">Breaker open</text>
        <rect x="330" y="1032" width="12" height="12" fill={PAPER} stroke="#e15b5b" />
        <text x="350" y="1043" fill={DIM} fontSize="12">Tripped</text>
        <text x="440" y="1043" fill={DIM} fontSize="12">M is a motor, G is the diesel, and the paired circles are a transformer. Click a machine to open it.</text>
      </g>
    </svg>
  );
}
