import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "CRM-dev", "db", "deploy", "from-main");
fs.mkdirSync(outDir, { recursive: true });

// Read from stdin and write to file. Expected input: the raw SQL string.
const input = fs.readFileSync(0, "utf8");
fs.writeFileSync(path.join(outDir, "03_indexes.sql"), input.trim() + "\n", "utf8");
console.log("Wrote CRM-dev/db/deploy/from-main/03_indexes.sql");

