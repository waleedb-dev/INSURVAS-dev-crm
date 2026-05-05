/**
 * Creates a single dev system_admin (auth + public.users) using the service role.
 * Idempotent: if public.users already has this email, ensures role is system_admin and exits.
 *
 * Usage (from repo root):
 *   node scripts/seed-dev-system-admin.mjs
 *
 * Optional env overrides:
 *   DEV_SYSTEM_ADMIN_EMAIL
 *   DEV_SYSTEM_ADMIN_PASSWORD
 *   DEV_SYSTEM_ADMIN_NAME
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email =
  process.env.DEV_SYSTEM_ADMIN_EMAIL || "dev-system-admin@insurvas.test";
const password =
  process.env.DEV_SYSTEM_ADMIN_PASSWORD || "DevSystemAdmin2026!";
const fullName = process.env.DEV_SYSTEM_ADMIN_NAME || "Dev System Admin";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: roleRow, error: roleErr } = await admin
  .from("roles")
  .select("id")
  .eq("key", "system_admin")
  .maybeSingle();

if (roleErr || !roleRow?.id) {
  console.error("Could not load system_admin role:", roleErr?.message || "not found");
  process.exit(1);
}

const roleId = roleRow.id;

const { data: existingProfile, error: existingErr } = await admin
  .from("users")
  .select("id, role_id")
  .eq("email", email)
  .maybeSingle();

if (existingErr) {
  console.error("Profile lookup failed:", existingErr.message);
  process.exit(1);
}

if (existingProfile?.id) {
  if (existingProfile.role_id !== roleId) {
    const { error: updErr } = await admin
      .from("users")
      .update({ role_id: roleId, status: "active", full_name: fullName })
      .eq("id", existingProfile.id);
    if (updErr) {
      console.error("Failed to upgrade existing user to system_admin:", updErr.message);
      process.exit(1);
    }
    console.log("Updated existing user to system_admin:", email, existingProfile.id);
  } else {
    console.log("System admin already exists:", email, existingProfile.id);
  }
  process.exit(0);
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (createErr || !created?.user?.id) {
  console.error("auth.admin.createUser failed:", createErr?.message || "unknown");
  process.exit(1);
}

const userId = created.user.id;

const { error: insErr } = await admin.from("users").insert({
  id: userId,
  email,
  full_name: fullName,
  role_id: roleId,
  status: "active",
  call_center_id: null,
  department_id: null,
  is_licensed: false,
});

if (insErr) {
  await admin.auth.admin.deleteUser(userId);
  console.error("public.users insert failed:", insErr.message);
  process.exit(1);
}

console.log("Created system admin:");
console.log("  email:", email);
console.log("  user id:", userId);
console.log("  password:", password, "(change after first login)");
