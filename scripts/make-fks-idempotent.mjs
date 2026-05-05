import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const inPath =
  process.argv[2] ||
  path.join(repoRoot, "CRM-dev", "db", "deploy", "from-main", "02_foreign_keys.sql");
const outPath =
  process.argv[3] ||
  path.join(repoRoot, "CRM-dev", "db", "deploy", "from-main", "02_foreign_keys_idempotent.sql");

const input = fs.readFileSync(inPath, "utf8");
const lines = input
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const blocks = [];
for (const line of lines) {
  // Expect: alter table ... add constraint CONNAME ...
  const m = line.match(/add constraint\s+([a-zA-Z0-9_"]+)\s+/i);
  if (!m) continue;
  const conname = m[1].replaceAll('"', "");

  blocks.push(
    [
      "do $$",
      "begin",
      `  if not exists (select 1 from pg_constraint where conname = '${conname}') then`,
      `    ${line}`,
      "  end if;",
      "end",
      "$$;",
      "",
    ].join("\n"),
  );
}

fs.writeFileSync(outPath, blocks.join("\n"), "utf8");
console.log(`Wrote ${path.relative(repoRoot, outPath)}`);

