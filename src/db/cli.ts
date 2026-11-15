import { dumpDatabase, redactConnection } from "./dump";

const connectionString = process.env.DATABASE_URL?.trim() ?? "";
if (connectionString === "") {
  console.error("Set DATABASE_URL to the Postgres database, then run npm run db:dump again.");
  console.error("Example: DATABASE_URL=postgresql://cobre:YOUR_PASSWORD@localhost:5432/cobre_norte npm run db:dump");
  console.error("Install steps are in db/SETUP.md.");
  process.exit(1);
}

try {
  const counts = await dumpDatabase(connectionString);
  console.log("Loaded Cobre Norte into Postgres.");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`${name}: ${count}`);
  }
} catch (error) {
  console.error(redactConnection(error));
  process.exit(1);
}
