create schema if not exists cobre;

create table if not exists cobre.plant (
  id text primary key,
  name text not null,
  design_feed_tph numeric not null,
  stockpile_live_t numeric not null
);

create table if not exists cobre.areas (
  id text primary key,
  code text not null unique,
  name text not null,
  short_name text not null,
  plc_id text not null
);

create table if not exists cobre.plcs (
  id text primary key,
  name text not null,
  ip inet not null,
  cpu text not null
);

create table if not exists cobre.buses (
  id text primary key,
  name text not null,
  volts integer not null,
  mva numeric not null,
  fed_from text not null
);

create table if not exists cobre.equipment (
  tag text primary key,
  name text not null,
  area_id text not null references cobre.areas (id),
  kind text not null,
  maker text not null,
  model text not null,
  blurb text not null
);

create table if not exists cobre.equipment_design (
  equip_tag text not null references cobre.equipment (tag),
  sort_order integer not null,
  label text not null,
  value text not null,
  primary key (equip_tag, sort_order)
);

create table if not exists cobre.equipment_drawings (
  equip_tag text not null references cobre.equipment (tag),
  pid text not null,
  primary key (equip_tag, pid)
);

create table if not exists cobre.motors (
  tag text primary key,
  name text not null,
  area_id text not null references cobre.areas (id),
  equip_tag text not null references cobre.equipment (tag),
  kw numeric not null,
  volts integer not null,
  power_factor numeric not null,
  efficiency numeric not null,
  flc_amps numeric not null,
  start_method text not null,
  duty text not null,
  mcc text not null,
  cell text not null,
  feeder text not null,
  bus_id text not null references cobre.buses (id),
  cable text not null,
  essential boolean not null,
  pair_tag text,
  load_factor numeric not null,
  rated_rpm numeric,
  fault_priority smallint not null,
  initial_state text not null,
  initial_speed numeric not null,
  local_handoff boolean not null,
  trip_reason text not null,
  ys_tag text not null,
  xa_tag text not null,
  xl_tag text not null,
  hs_start_tag text not null,
  hs_stop_tag text not null,
  ii_tag text not null,
  ei_tag text,
  si_tag text,
  sc_tag text,
  tt_tag text,
  gh_tag text not null
);

create table if not exists cobre.io_points (
  tag text primary key,
  description text not null,
  area_id text not null references cobre.areas (id),
  equip_tag text not null,
  io_type text not null,
  signal text not null,
  plc_id text not null references cobre.plcs (id),
  address text not null,
  card text not null,
  eu text not null,
  range_min double precision not null,
  range_max double precision not null,
  decimals smallint not null,
  hh double precision,
  h double precision,
  l_limit double precision,
  ll double precision,
  device text not null,
  pid text not null,
  cable text not null,
  fail_state text not null,
  word_off text,
  word_on text,
  alarm_when smallint,
  alarm_condition text,
  alarm_priority smallint,
  latched boolean,
  wander double precision not null,
  period_s double precision not null,
  base_value double precision not null,
  initial_quality smallint not null,
  trend boolean not null,
  source text not null,
  feature boolean not null
);

create table if not exists cobre.valves (
  tag text primary key,
  name text not null,
  area_id text not null references cobre.areas (id),
  equip_tag text not null references cobre.equipment (tag),
  fail_position text not null,
  pid text not null,
  device text not null,
  zt_tag text not null,
  zc_tag text not null,
  zso_tag text not null,
  zsc_tag text not null
);

create table if not exists cobre.loops (
  id text primary key,
  name text not null,
  area_id text not null references cobre.areas (id),
  pv_tag text not null references cobre.io_points (tag),
  op_tag text references cobre.io_points (tag),
  actuator_tag text references cobre.motors (tag),
  action text not null,
  kp numeric not null,
  pv_at_0 double precision not null,
  pv_at_100 double precision not null,
  pv_stopped double precision,
  feature boolean not null,
  configured_mode text not null,
  configured_sp double precision not null,
  configured_op double precision not null
);

create table if not exists cobre.narratives (
  area_code text primary key,
  title text not null,
  area_id text not null references cobre.areas (id)
);

create table if not exists cobre.narrative_sections (
  area_code text not null references cobre.narratives (area_code),
  sort_order integer not null,
  heading text not null,
  body text not null,
  primary key (area_code, sort_order)
);

create table if not exists cobre.symbols (
  id text primary key,
  group_name text not null,
  name text not null,
  note text not null
);

create table if not exists cobre.screens (
  id text primary key,
  label text not null,
  group_name text not null,
  sort_order integer not null
);

create table if not exists cobre.snapshots (
  id bigserial primary key,
  dumped_at timestamptz not null default now(),
  plant_time timestamptz not null,
  tick integer not null
);

create table if not exists cobre.point_readings (
  snapshot_id bigint not null references cobre.snapshots (id),
  tag text not null references cobre.io_points (tag),
  value double precision not null,
  quality smallint not null,
  quality_text text not null,
  forced boolean not null,
  primary key (snapshot_id, tag)
);

create table if not exists cobre.motor_readings (
  snapshot_id bigint not null references cobre.snapshots (id),
  tag text not null references cobre.motors (tag),
  state text not null,
  speed_sp double precision not null,
  speed double precision not null,
  amps double precision not null,
  kw double precision not null,
  run_hours double precision not null,
  starts integer not null,
  local_handoff boolean not null,
  trip_reason text not null,
  state_since timestamptz not null,
  primary key (snapshot_id, tag)
);

create table if not exists cobre.loop_readings (
  snapshot_id bigint not null references cobre.snapshots (id),
  loop_id text not null references cobre.loops (id),
  mode text not null,
  sp double precision not null,
  op double precision not null,
  primary key (snapshot_id, loop_id)
);

create table if not exists cobre.alarms (
  snapshot_id bigint not null references cobre.snapshots (id),
  alarm_id text not null,
  tag text not null,
  condition text not null,
  priority smallint not null,
  raised_at timestamptz not null,
  returned_at timestamptz,
  text text not null,
  state text not null,
  value_text text not null,
  area_id text not null references cobre.areas (id),
  primary key (snapshot_id, alarm_id)
);

create table if not exists cobre.events (
  snapshot_id bigint not null references cobre.snapshots (id),
  sort_order integer not null,
  event_time timestamptz not null,
  text text not null,
  area_id text references cobre.areas (id),
  primary key (snapshot_id, sort_order)
);

create table if not exists cobre.kpis (
  snapshot_id bigint primary key references cobre.snapshots (id),
  feed_tph double precision not null,
  sag_feed_tph double precision not null,
  head_grade double precision not null,
  recovery double precision not null,
  conc_grade double precision not null,
  tails_grade double precision not null,
  conc_tph double precision not null,
  tails_tph double precision not null,
  cu_tph double precision not null,
  cu_in_tph double precision not null,
  p80_um double precision not null,
  grind_kw double precision not null,
  plant_kw double precision not null,
  specific_energy double precision not null,
  water_m3h double precision not null,
  stock_pct double precision not null,
  stock_tons double precision not null,
  stock_delta_tph double precision not null,
  shift_tons double precision not null,
  shift_cu double precision not null
);

create table if not exists cobre.interlocks (
  snapshot_id bigint not null references cobre.snapshots (id),
  interlock_id text not null,
  kind text not null,
  motor_tag text not null references cobre.motors (tag),
  area_id text not null references cobre.areas (id),
  cause text not null,
  action text not null,
  delay_s numeric,
  healthy boolean not null,
  primary key (snapshot_id, interlock_id)
);

create index if not exists io_points_area_idx on cobre.io_points (area_id);
create index if not exists io_points_type_idx on cobre.io_points (io_type);
create index if not exists io_points_equip_idx on cobre.io_points (equip_tag);
create index if not exists motors_bus_idx on cobre.motors (bus_id);
create index if not exists motors_area_idx on cobre.motors (area_id);

create or replace view cobre.io_list as
select
  tag, description, area_id, equip_tag, io_type, signal, plc_id, address, card,
  eu, range_min, range_max, device, pid, cable, source
from cobre.io_points;

create or replace view cobre.load_list as
select
  tag, name, area_id, equip_tag, kw, volts, flc_amps, start_method, duty,
  mcc, cell, feeder, bus_id, cable, essential, pair_tag
from cobre.motors
where start_method <> 'Static';

create or replace view cobre.alarm_setpoints as
select
  tag, description, area_id, eu, ll, l_limit as l, h, hh,
  word_off, word_on, alarm_when, alarm_condition, alarm_priority
from cobre.io_points
where hh is not null or h is not null or l_limit is not null or ll is not null or alarm_when is not null;
