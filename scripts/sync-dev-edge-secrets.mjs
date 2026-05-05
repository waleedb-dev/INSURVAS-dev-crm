#!/usr/bin/env node
/**
 * Build a dotenv file of Edge Function secrets for the Dev Supabase project,
 * then run `supabase secrets set --env-file …` when authenticated.
 *
 * Prerequisites:
 *   SUPABASE_ACCESS_TOKEN environment variable set (Dashboard → Account → Access tokens), or run `supabase login`.
 *
 * Reads (in order, later overrides):
 *   - .env
 *   - edge-secrets.local.env (repo root; optional — add Slack / Jotform / DNC provider keys here)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseDotEnv(content) {
  /** @type {Record<string, string>} */
  const out = {};
  const lines = content.split(/\r?\n/);
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFile(relPath) {
  const p = path.join(repoRoot, relPath);
  if (!fs.existsSync(p)) return {};
  return parseDotEnv(fs.readFileSync(p, "utf8"));
}

function projectRefFromSupabaseUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const m = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function escapeEnvValue(val) {
  const s = String(val);
  if (/[\r\n]/.test(s)) {
    throw new Error("Secret values must not contain newline characters");
  }
  if (/^[A-Za-z0-9_@%+./:-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildSecretMap(base, local) {
  const merged = { ...base, ...local };

  const supabaseUrl =
    merged.NEXT_PUBLIC_SUPABASE_URL ||
    merged.SUPABASE_URL ||
    "";
  const ref = merged.SUPABASE_PROJECT_REF || projectRefFromSupabaseUrl(supabaseUrl);
  if (!ref) {
    throw new Error(
      "Could not determine project ref. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_REF in .env.",
    );
  }

  const resolvedSupabaseUrl =
    supabaseUrl || `https://${ref}.supabase.co`;

  /** @type {Record<string, string>} */
  const secrets = {};

  if (merged.SUPABASE_SERVICE_ROLE_KEY) {
    secrets.SUPABASE_SERVICE_ROLE_KEY = merged.SUPABASE_SERVICE_ROLE_KEY;
  }

  const anonForEdge =
    merged.SUPABASE_ANON_KEY ||
    merged.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    merged.EDGE_SUPABASE_ANON_KEY ||
    "";
  if (anonForEdge) secrets.SUPABASE_ANON_KEY = anonForEdge;

  secrets.SUPABASE_URL = merged.SUPABASE_URL || resolvedSupabaseUrl;

  const mailtrap = merged.MAILTRAP || merged.MAILTRAP_API_TOKEN || "";
  if (mailtrap) {
    secrets.MAILTRAP = mailtrap;
    secrets.MAILTRAP_API_TOKEN = mailtrap;
  }

  const slack = merged.SLACK_BOT_TOKEN || "";
  if (slack) secrets.SLACK_BOT_TOKEN = slack;

  const pass = (k) => {
    if (merged[k]) secrets[k] = merged[k];
  };

  pass("APP_FIX_SLACK_CHANNEL");
  pass("PORTAL_BASE_URL");
  pass("MEDALERT_CHANNEL");
  pass("RETENTION_TEAM_SLACK_CHANNEL");
  pass("RETENTION_BUFFER_SLACK_CHANNEL");
  pass("JOTFORM_API_KEY");
  pass("JOTFORM_FORM_ID");
  pass("REALVALIDITO_API_KEY");
  pass("REALVALIDITO_API_SECRET");
  pass("BLACKLIST_ALLIANCE_API_KEY");
  pass("NOTIFY_ELIGIBLE_AGENTS_URL");
  pass("NOTIFY_ELIGIBLE_AGENTS_ANON_KEY");

  if (!secrets.NOTIFY_ELIGIBLE_AGENTS_URL) {
    secrets.NOTIFY_ELIGIBLE_AGENTS_URL = `${resolvedSupabaseUrl}/functions/v1/notify-eligible-agents`;
  }
  if (!secrets.NOTIFY_ELIGIBLE_AGENTS_ANON_KEY) {
    const bearer =
      anonForEdge ||
      merged.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      merged.SUPABASE_ANON_KEY_PUBLISHABLE ||
      "";
    if (bearer) secrets.NOTIFY_ELIGIBLE_AGENTS_ANON_KEY = bearer;
  }

  return { ref, secrets };
}

function writeEnvFile(secrets) {
  const lines = Object.entries(secrets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${escapeEnvValue(v)}`);
  const tmp = path.join(os.tmpdir(), `supabase-edge-secrets-${process.pid}-${Date.now()}.env`);
  fs.writeFileSync(tmp, `${lines.join("\n")}\n`, "utf8");
  return tmp;
}

const dryRun = process.argv.includes("--dry-run");

const base = loadEnvFile(".env");
const local = loadEnvFile("edge-secrets.local.env");
const { ref, secrets } = buildSecretMap(base, local);

if (dryRun) {
  console.log(`Project ref: ${ref}`);
  console.log("Would set the following secret names (values hidden):");
  for (const k of Object.keys(secrets).sort()) console.log(`  - ${k}`);
  process.exit(0);
}

if (!secrets.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env — add it before pushing Edge secrets.",
  );
  process.exit(1);
}

const envFile = writeEnvFile(secrets);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const res = spawnSync(
  npx,
  ["--yes", "supabase@latest", "secrets", "set", "--env-file", envFile, "--project-ref", ref, "--yes"],
  { stdio: "inherit", env: process.env, cwd: repoRoot },
);
try {
  fs.unlinkSync(envFile);
} catch {
  // ignore
}
process.exit(res.status ?? 1);
