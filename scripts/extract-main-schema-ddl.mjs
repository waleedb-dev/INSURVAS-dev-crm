import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const inputPath =
  process.argv[2] ||
  "/Users/mc/.cursor/projects/Users-mc-unlimited-insurance-INSURVAS-CRM/agent-tools/e3d24c74-54c9-46f5-91aa-9921a642f0a8.txt";

const outDir = path.join(repoRoot, "CRM-dev", "db", "deploy", "from-main");
fs.mkdirSync(outDir, { recursive: true });

const raw = fs.readFileSync(inputPath, "utf8");

// Tool output format: JSON with { result: "... <untrusted-data> [ ... ] </untrusted-data> ..." }
let outer;
try {
  outer = JSON.parse(raw);
} catch {
  throw new Error(`Cannot parse outer JSON from ${inputPath}`);
}

const s = String(outer.result || "");
// The result string mentions the tag in prose first; use the actual tag line.
const openTagStart = s.indexOf("\n<untrusted-data-");
if (openTagStart === -1) throw new Error("Could not find untrusted-data open tag.");
const openTagEnd = s.indexOf(">", openTagStart + 1);
if (openTagEnd === -1) throw new Error("Could not find end of untrusted-data open tag.");
const closeTagStart = s.indexOf("</untrusted-data-", openTagEnd + 1);
if (closeTagStart === -1) throw new Error("Could not find untrusted-data close tag.");

const payload = s.slice(openTagEnd + 1, closeTagStart).trim();
let data;
try {
  data = JSON.parse(payload);
} catch (e) {
  throw new Error(`Could not parse payload JSON array: ${e?.message || e}`);
}

const bySection = new Map(data.map((x) => [x.section, x.sql || ""]));

fs.writeFileSync(path.join(outDir, "01_create_tables.sql"), bySection.get("---CREATE_TABLES---") || "", "utf8");
fs.writeFileSync(path.join(outDir, "02_foreign_keys.sql"), bySection.get("---FOREIGN_KEYS---") || "", "utf8");
fs.writeFileSync(path.join(outDir, "03_indexes_raw.sql"), bySection.get("---INDEXES---") || "", "utf8");

console.log(`Wrote extracted SQL to ${path.relative(repoRoot, outDir)}/`);
