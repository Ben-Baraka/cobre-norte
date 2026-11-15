# Cobre Norte Postgres dump

This loads every plant record in the HMI into a Postgres database on your computer: areas, PLCs, buses, equipment, the IO list, the load list, valves, control loops, alarm setpoints, interlocks, narratives, symbols, screens, and one settled operating snapshot (point values, motor states, loop modes, alarms, events, and plant totals).

Running the dump again replaces the previous load. It does not keep earlier snapshots.

## 1. Install Postgres

Use Postgres 15 or newer.

### Windows

1. Install from https://www.postgresql.org/download/windows/ (the EDB installer) or with winget:

   ```
   winget install PostgreSQL.PostgreSQL.17
   ```

2. During the installer, set a password for the `postgres` superuser and remember it. Leave the port at `5432`.
3. Open **SQL Shell (psql)** from the Start menu, press Enter through the defaults, and enter that password.

### macOS

```
brew install postgresql@17
brew services start postgresql@17
```

If `psql` is not found, add the brew path once in that terminal:

```
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Linux

```
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

## 2. Create the database

In `psql`, as a superuser (`postgres` on Windows and Linux, your macOS user after Homebrew):

```sql
create user cobre with password 'choose-a-password';
create database cobre_norte owner cobre;
grant all privileges on database cobre_norte to cobre;
\q
```

On Linux, if peer authentication blocks the create, use:

```
sudo -u postgres psql
```

and run the same SQL.

## 3. Load the plant

From this project folder, after `npm install`:

```
DATABASE_URL=postgresql://cobre:choose-a-password@localhost:5432/cobre_norte npm run db:dump
```

On Windows PowerShell:

```
$env:DATABASE_URL = "postgresql://cobre:choose-a-password@localhost:5432/cobre_norte"
npm run db:dump
```

On Windows Command Prompt:

```
set DATABASE_URL=postgresql://cobre:choose-a-password@localhost:5432/cobre_norte
npm run db:dump
```

The command prints row counts. It does not print the connection string. Keep the password out of git. A `.env` file is ignored if you want to store the URL locally, but the command only reads `DATABASE_URL` from the environment.

## 4. Check the load

```
psql "postgresql://cobre:choose-a-password@localhost:5432/cobre_norte"
```

```sql
select count(*) as io_points from cobre.io_points;
select count(*) as motors from cobre.motors;
select tag, description, io_type, address from cobre.io_list where area_id = 'sag' order by tag limit 20;
select tag, kw, bus_id, state, kw as live_kw
from cobre.load_list
join cobre.motor_readings using (tag)
order by kw desc
limit 15;
select tag, eu, ll, l, h, hh from cobre.alarm_setpoints where hh is not null order by tag limit 15;
select kind, motor_tag, cause, healthy from cobre.interlocks where not healthy order by motor_tag;
select title, heading from cobre.narratives join cobre.narrative_sections using (area_code) order by area_code, sort_order;
```

Tables live in the `cobre` schema. `cobre.io_list`, `cobre.load_list`, and `cobre.alarm_setpoints` are views of the engineering lists. `cobre.point_readings`, `cobre.motor_readings`, and `cobre.loop_readings` are the values from the settled simulator state.
