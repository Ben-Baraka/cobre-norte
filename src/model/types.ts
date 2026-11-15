export type AreaId =
  | "crush"
  | "stock"
  | "sag"
  | "ball"
  | "rough"
  | "clean"
  | "conc"
  | "tails"
  | "reag"
  | "util"
  | "sys";

export type ScreenId =
  | "overview"
  | AreaId
  | "io"
  | "loads"
  | "power"
  | "trends"
  | "alarms"
  | "setpoints"
  | "interlocks"
  | "narratives"
  | "symbols";

export type EquipKind =
  | "bin"
  | "feeder"
  | "crusher"
  | "conveyor"
  | "magnet"
  | "dust"
  | "detector"
  | "pile"
  | "mill"
  | "pump"
  | "sump"
  | "cyclone"
  | "tank"
  | "agitator"
  | "blower"
  | "cell"
  | "column"
  | "analyzer"
  | "thickener"
  | "filter"
  | "compressor"
  | "diesel"
  | "static"
  | "valve"
  | "generic";

export type MotorState = "stopped" | "starting" | "running" | "stopping" | "tripped";

export type IoType = "AI" | "AO" | "DI" | "DO" | "RTD" | "COMM" | "CALC";

export type StartMethod = "DOL" | "VFD" | "Soft Start" | "LCI" | "Diesel" | "Static";

export type Duty = "Continuous" | "Intermittent" | "Standby";

export type Mode = "AUTO" | "MAN" | "CAS";

export type Quality = 0 | 1 | 2 | 3;

export interface AreaInfo {
  id: AreaId;
  code: string;
  name: string;
  short: string;
  plc: string;
}

export interface PlcInfo {
  id: string;
  name: string;
  ip: string;
  cpu: string;
}

export interface BusInfo {
  id: string;
  name: string;
  volts: number;
  mva: number;
  from: string;
}

export interface MotorSpec {
  tag: string;
  name: string;
  kw: number;
  volts: number;
  pf?: number;
  eff?: number;
  start: StartMethod;
  duty: Duty;
  mcc: string;
  cell: string;
  feeder: string;
  bus: string;
  essential?: boolean;
  pair?: string;
  initial?: MotorState;
  load?: number;
  speed?: number;
  local?: boolean;
  tripReason?: string;
  ratedRpm?: number;
  faultPriority?: 1 | 2;
  featurePower?: boolean;
}

export interface EquipSpec {
  tag: string;
  name: string;
  area: AreaId;
  kind: EquipKind;
  maker: string;
  model: string;
  blurb: string;
  design: { label: string; value: string }[];
  motors: MotorSpec[];
  pids: string[];
}

export interface AnalogSpec {
  tag: string;
  desc: string;
  area: AreaId;
  equip: string;
  io: "AI" | "AO" | "RTD" | "COMM" | "CALC";
  signal: string;
  eu: string;
  min: number;
  max: number;
  pv: number;
  dec: number;
  hh?: number;
  h?: number;
  l?: number;
  ll?: number;
  device: string;
  pid: string;
  fail: string;
  wander?: number;
  period?: number;
  feature?: boolean;
  trend?: boolean;
  quality?: "Good" | "Uncertain" | "Bad";
  source?: "Field" | "Drive" | "Calculated";
}

export interface DiscreteSpec {
  tag: string;
  desc: string;
  area: AreaId;
  equip: string;
  io: "DI" | "DO";
  signal?: string;
  words: [string, string];
  initial: 0 | 1;
  alarmWhen?: 0 | 1;
  alarmCond?: string;
  priority?: 1 | 2 | 3 | 4;
  device: string;
  pid: string;
  fail?: string;
  latched?: boolean;
}

export interface ValveSpec {
  tag: string;
  name: string;
  area: AreaId;
  equip: string;
  fail: "FC" | "FO";
  pid: string;
  device: string;
}

export interface LoopSpec {
  id: string;
  name: string;
  area: AreaId;
  pv: string;
  opTag?: string;
  actuator?: string;
  action: "direct" | "reverse";
  kp: number;
  sp: number;
  op: number;
  mode: Mode;
  pvAt0: number;
  pvAt100: number;
  pvStopped?: number;
  feature?: boolean;
}

export interface Point {
  index: number;
  tag: string;
  desc: string;
  area: AreaId;
  equip: string;
  io: IoType;
  signal: string;
  plc: string;
  address: string;
  card: string;
  eu: string;
  min: number;
  max: number;
  dec: number;
  hh?: number;
  h?: number;
  l?: number;
  ll?: number;
  device: string;
  pid: string;
  cable: string;
  fail: string;
  words?: [string, string];
  alarmWhen?: 0 | 1;
  alarmCond?: string;
  priority?: 1 | 2 | 3 | 4;
  latched?: boolean;
  wander: number;
  period: number;
  base: number;
  quality0: Quality;
  trend: boolean;
  source: "Field" | "Drive" | "Calculated";
  feature: boolean;
}

export interface Motor {
  index: number;
  tag: string;
  name: string;
  area: AreaId;
  equip: string;
  kw: number;
  volts: number;
  pf: number;
  eff: number;
  flc: number;
  start: StartMethod;
  duty: Duty;
  mcc: string;
  cell: string;
  feeder: string;
  bus: string;
  cable: string;
  essential: boolean;
  pair?: string;
  load: number;
  ratedRpm?: number;
  faultPriority: 1 | 2;
  ys: string;
  xa: string;
  xl: string;
  hsStart: string;
  hsStop: string;
  ii: string;
  ei?: string;
  si?: string;
  sc?: string;
  tt?: string;
  gh: string;
}

export interface Equip {
  tag: string;
  name: string;
  area: AreaId;
  kind: EquipKind;
  maker: string;
  model: string;
  blurb: string;
  design: { label: string; value: string }[];
  motors: string[];
  pids: string[];
}

export interface Valve {
  tag: string;
  name: string;
  area: AreaId;
  equip: string;
  fail: "FC" | "FO";
  pid: string;
  device: string;
  zt: string;
  zc: string;
  zso: string;
  zsc: string;
}

export interface Loop {
  index: number;
  id: string;
  name: string;
  area: AreaId;
  pv: string;
  opTag?: string;
  actuator?: string;
  action: "direct" | "reverse";
  kp: number;
  pvAt0: number;
  pvAt100: number;
  pvStopped?: number;
  feature: boolean;
}

export interface MotorLive {
  state: MotorState;
  speedSp: number;
  speed: number;
  amps: number;
  kw: number;
  hours: number;
  starts: number;
  local: boolean;
  tripReason: string;
  since: number;
}

export interface LoopLive {
  mode: Mode;
  sp: number;
  op: number;
}

export interface Alarm {
  id: string;
  tag: string;
  cond: string;
  priority: 1 | 2 | 3 | 4;
  time: number;
  rtnTime?: number;
  text: string;
  state: "UNACK" | "ACK" | "RTN" | "CLEAR";
  value: string;
  area: AreaId;
}

export interface EventRec {
  time: number;
  text: string;
  area?: AreaId;
}

export interface Kpis {
  feed: number;
  sagFeed: number;
  head: number;
  rec: number;
  concGrade: number;
  tailsGrade: number;
  concTph: number;
  tailsTph: number;
  cuTph: number;
  cuIn: number;
  p80: number;
  grindKw: number;
  plantKw: number;
  sec: number;
  water: number;
  stockPct: number;
  stockTons: number;
  stockDelta: number;
  shiftTons: number;
  shiftCu: number;
}

export interface Live {
  tick: number;
  now: number;
  values: Float32Array;
  quality: Uint8Array;
  forced: Uint8Array;
  motors: MotorLive[];
  loops: LoopLive[];
  alarms: Alarm[];
  horn: boolean;
  silenced: boolean;
  events: EventRec[];
  reject?: { tag: string; text: string; time: number };
  kpis: Kpis;
  stockTons: number;
  hist: Record<string, Float32Array>;
  histHead: number;
  histLast: number;
  tripTimer: Record<string, number>;
  lubeWait: Record<string, number>;
  epoch: number;
}

export type Target =
  | { kind: "equip"; tag: string }
  | { kind: "motor"; tag: string }
  | { kind: "analog"; tag: string }
  | { kind: "discrete"; tag: string }
  | { kind: "valve"; tag: string }
  | { kind: "plc"; id: string }
  | { kind: "basis" };

export const AREAS: AreaInfo[] = [
  { id: "crush", code: "100", name: "Primary Crushing", short: "Crushing", plc: "PLC-CRU" },
  { id: "stock", code: "200", name: "Coarse Ore Stockpile", short: "Stockpile", plc: "PLC-CRU" },
  { id: "sag", code: "300", name: "SAG Mill Circuit", short: "SAG Mill", plc: "PLC-GRD" },
  { id: "ball", code: "400", name: "Ball Mill Circuit", short: "Ball Mill", plc: "PLC-GRD" },
  { id: "rough", code: "500", name: "Rougher Flotation", short: "Rougher", plc: "PLC-FLT" },
  { id: "clean", code: "600", name: "Cleaner Flotation", short: "Cleaner", plc: "PLC-FLT" },
  { id: "conc", code: "700", name: "Concentrate Handling", short: "Concentrate", plc: "PLC-DEW" },
  { id: "tails", code: "800", name: "Tailings & TSF", short: "Tailings", plc: "PLC-DEW" },
  { id: "reag", code: "900", name: "Reagent Plant", short: "Reagents", plc: "PLC-REA" },
  { id: "util", code: "950", name: "Water, Air & Power", short: "Utilities", plc: "PLC-UTL" },
  { id: "sys", code: "000", name: "Plant Systems", short: "Systems", plc: "HMI-SVR" },
];

export const AREA_BY_ID: Record<AreaId, AreaInfo> = Object.fromEntries(
  AREAS.map((a) => [a.id, a]),
) as Record<AreaId, AreaInfo>;

export const PLCS: PlcInfo[] = [
  { id: "PLC-CRU", name: "Crushing & stockpile", ip: "10.16.20.11", cpu: "1756-L85E" },
  { id: "PLC-GRD", name: "Grinding", ip: "10.16.20.21", cpu: "1756-L85E" },
  { id: "PLC-FLT", name: "Flotation", ip: "10.16.20.31", cpu: "1756-L85E" },
  { id: "PLC-DEW", name: "Dewatering", ip: "10.16.20.41", cpu: "1756-L84E" },
  { id: "PLC-REA", name: "Reagents", ip: "10.16.20.51", cpu: "1756-L83E" },
  { id: "PLC-UTL", name: "Utilities", ip: "10.16.20.61", cpu: "1756-L83E" },
  { id: "HMI-SVR", name: "HMI server", ip: "10.16.20.10", cpu: "Historian" },
];

export const BUSES: BusInfo[] = [
  { id: "BUS-11A", name: "11 kV Bus A", volts: 11000, mva: 45, from: "TX-101A 66/11 kV" },
  { id: "BUS-11B", name: "11 kV Bus B", volts: 11000, mva: 45, from: "TX-101B 66/11 kV" },
  { id: "BUS-3.3-CRU", name: "3.3 kV Crushing", volts: 3300, mva: 8, from: "TX-301A 11/3.3 kV" },
  { id: "BUS-3.3-GRD", name: "3.3 kV Grinding", volts: 3300, mva: 16, from: "TX-301B 11/3.3 kV" },
  { id: "BUS-3.3-DEW", name: "3.3 kV Dewatering", volts: 3300, mva: 10, from: "TX-302 11/3.3 kV" },
  { id: "BUS-690-CRU", name: "690 V Crushing", volts: 690, mva: 2.5, from: "TX-401 11/0.69 kV" },
  { id: "BUS-690-PRC", name: "690 V Process", volts: 690, mva: 2.5, from: "TX-402 11/0.69 kV" },
  { id: "BUS-415-FLT", name: "415 V Flotation", volts: 415, mva: 2.0, from: "TX-501 11/0.415 kV" },
  { id: "BUS-415-PRC", name: "415 V Process", volts: 415, mva: 1.6, from: "TX-502 11/0.415 kV" },
  { id: "BUS-EM", name: "415 V Essential", volts: 415, mva: 1.6, from: "TX-EM / EDG-991" },
];

export const DESIGN_FEED = 1750;
export const STOCK_LIVE_T = 18000;
export const HIST_N = 1920;
export const HIST_DT = 15000;

export const PROCESS_SCREENS: { id: ScreenId; label: string; group: string }[] = [
  { id: "overview", label: "Overview", group: "Process" },
  { id: "crush", label: "Crushing", group: "Process" },
  { id: "stock", label: "Stockpile", group: "Process" },
  { id: "sag", label: "SAG Mill", group: "Process" },
  { id: "ball", label: "Ball Mill", group: "Process" },
  { id: "rough", label: "Rougher", group: "Process" },
  { id: "clean", label: "Cleaner", group: "Process" },
  { id: "conc", label: "Concentrate", group: "Process" },
  { id: "tails", label: "Tailings", group: "Process" },
  { id: "reag", label: "Reagents", group: "Process" },
  { id: "util", label: "Water & Air", group: "Process" },
  { id: "io", label: "IO List", group: "Lists" },
  { id: "loads", label: "Load List", group: "Lists" },
  { id: "power", label: "Power System", group: "Lists" },
  { id: "setpoints", label: "Alarm Setpoints", group: "Lists" },
  { id: "trends", label: "Trends", group: "System" },
  { id: "alarms", label: "Alarms", group: "System" },
  { id: "interlocks", label: "Interlocks", group: "System" },
  { id: "narratives", label: "Narratives", group: "System" },
  { id: "symbols", label: "P&ID Symbols", group: "System" },
];
