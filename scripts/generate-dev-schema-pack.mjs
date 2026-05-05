import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const sqlDir = path.join(repoRoot, "sql");
const outDir = path.join(repoRoot, "CRM-dev", "db", "deploy", "generated");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readAllSqlFiles() {
  const entries = fs.readdirSync(sqlDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .filter((name) => name.toLowerCase() !== "clean_swipe.sql");

  // Exclude non-schema scripts (seeds/backfills/cleanup/rollbacks).
  const excludedNameFragments = [
    "seed",
    "backfill",
    "cleanup",
    "revert",
    "fix_",
    "analytics_",
    "announcements_seed",
    "product_guides_seed",
  ];

  const schemaFiles = files.filter((name) => {
    const lower = name.toLowerCase();
    return !excludedNameFragments.some((frag) => lower.includes(frag));
  });

  // Rough dependency ordering: core auth/permissions first, then tables, then patches.
  const weights = new Map([
    ["authentication_module.sql", 10],
    ["permissions_module.sql", 20],
    ["departments_module.sql", 30],
    ["carriers_and_bpo_management.sql", 40],
    ["agent_hierarchy.sql", 50],
    ["pipelines_and_stages_seed.sql", 60], // schema + RLS, despite name
    ["leads_pipeline_fk_alignment.sql", 70],
    ["leads_drop_pipeline_text_column.sql", 71],
    ["lead_notes.sql", 80],
    ["verification_sessions_and_items.sql", 90],
    ["daily_deal_flow.sql", 100],
    ["disposition_flows_schema.sql", 110],
    ["tickets_module.sql", 120],
    ["callback_requests.sql", 130],
    ["lead_queue_management.sql", 140],
    ["lead_queue_management_permissions.sql", 150],
    ["center_thresholds.sql", 160],
  ]);

  const weightOf = (name) => {
    const w = weights.get(name);
    if (typeof w === "number") return w;
    if (name.endsWith("_module.sql")) return 200;
    if (name.endsWith("_schema.sql")) return 210;
    if (name.includes("rls")) return 900;
    return 500;
  };

  const ordered = schemaFiles.sort((a, b) => {
    const wa = weightOf(a);
    const wb = weightOf(b);
    if (wa !== wb) return wa - wb;
    return a.localeCompare(b);
  });

  return ordered.map((name) => {
    const fullPath = path.join(sqlDir, name);
    const content = fs.readFileSync(fullPath, "utf8");
    return { name, content };
  });
}

function stripLineCommentsOutsideStrings(sql) {
  // Used only for heuristics; does not need to preserve positions.
  let out = "";
  let inSingle = false;
  let inDollar = false;
  let dollarTag = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (!inDollar && ch === "'" && !inSingle) {
      inSingle = true;
      out += ch;
      continue;
    }
    if (!inDollar && ch === "'" && inSingle) {
      if (next === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = false;
      out += ch;
      continue;
    }

    if (!inSingle && ch === "$") {
      const m = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        const tag = m[0];
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
          out += tag;
          i += tag.length - 1;
          continue;
        }
        if (inDollar && tag === dollarTag) {
          inDollar = false;
          dollarTag = "";
          out += tag;
          i += tag.length - 1;
          continue;
        }
      }
    }

    if (!inSingle && !inDollar && ch === "-" && next === "-") {
      // consume to end of line
      while (i < sql.length && sql[i] !== "\n") i++;
      out += "\n";
      continue;
    }

    out += ch;
  }
  return out;
}

function splitStatements(sql) {
  const statements = [];
  let buf = "";

  let inSingle = false;
  let inDollar = false;
  let dollarTag = "";
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      buf += ch;
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === "*" && next === "/") {
        buf += "/";
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDollar && ch === "-" && next === "-") {
      buf += "--";
      i++;
      inLineComment = true;
      continue;
    }
    if (!inSingle && !inDollar && ch === "/" && next === "*") {
      buf += "/*";
      i++;
      inBlockComment = true;
      continue;
    }

    if (!inDollar && ch === "'" && !inSingle) {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (!inDollar && ch === "'" && inSingle) {
      if (next === "'") {
        buf += "''";
        i++;
        continue;
      }
      inSingle = false;
      buf += ch;
      continue;
    }

    if (!inSingle && ch === "$") {
      const m = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        const tag = m[0];
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
          buf += tag;
          i += tag.length - 1;
          continue;
        }
        if (inDollar && tag === dollarTag) {
          inDollar = false;
          dollarTag = "";
          buf += tag;
          i += tag.length - 1;
          continue;
        }
      }
    }

    buf += ch;

    if (!inSingle && !inDollar && ch === ";") {
      const s = buf.trim();
      if (s) statements.push(s);
      buf = "";
    }
  }

  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

function shouldDropStatement(stmt) {
  const heuristic = stripLineCommentsOutsideStrings(stmt).toLowerCase().trim();
  // Drop any DML — we want schema only. Must be statement-leading, not e.g. "ON DELETE CASCADE".
  if (/^(insert|update|delete|truncate|copy)\b/.test(heuristic)) return true;
  // Exclude explicit transaction wrappers from operational scripts.
  if (/^\s*(begin|commit|rollback)\b/.test(heuristic)) return true;
  // Avoid destructive schema wipes if they slip in.
  if (/\bdrop\s+schema\b/.test(heuristic)) return true;
  return false;
}

function buildPack() {
  const files = readAllSqlFiles();

  const header = [
    "-- Auto-generated DDL-only schema pack",
    "-- Source: /sql/*.sql (excluding clean_swipe.sql)",
    "-- DML stripped: INSERT/UPDATE/DELETE/TRUNCATE/COPY",
    "",
  ].join("\n");

  const allStatements = [];
  for (const f of files) {
    allStatements.push(`-- BEGIN ${f.name}`);
    const stmts = splitStatements(f.content);
    for (const s of stmts) {
      if (!shouldDropStatement(s)) allStatements.push(s);
    }
    allStatements.push(`-- END ${f.name}`);
    allStatements.push("");
  }

  const combined = header + allStatements.join("\n") + "\n";
  return combined;
}

function splitIntoParts(sql, maxChars) {
  const stmts = splitStatements(sql);
  const parts = [];
  let current = "";

  for (const s of stmts) {
    const candidate = (current ? current + "\n\n" : "") + s;
    if (candidate.length > maxChars && current) {
      parts.push(current.trim() + "\n");
      current = s;
      continue;
    }
    current = candidate;
  }
  if (current.trim()) parts.push(current.trim() + "\n");
  return parts;
}

ensureDir(outDir);

const combined = buildPack();
fs.writeFileSync(path.join(outDir, "schema_ddl_only.sql"), combined, "utf8");

// Keep comfortably under typical tool argument limits.
const parts = splitIntoParts(combined, 80_000);
parts.forEach((p, idx) => {
  const n = String(idx + 1).padStart(2, "0");
  fs.writeFileSync(path.join(outDir, `part_${n}.sql`), p, "utf8");
});

console.log(`Wrote ${parts.length} part(s) to ${path.relative(repoRoot, outDir)}/`);
