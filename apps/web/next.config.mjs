import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Das Monorepo hält genau EINE .env im Repo-Root (siehe README/.env.example).
// Next.js lädt aber nur .env-Dateien aus apps/web — daher die Root-.env hier
// einmalig in process.env spiegeln (vorhandene Werte gewinnen, nichts überschreiben).
// Betrifft serverseitige Route-Handler wie /api/livekit/token (LIVEKIT_*).
function loadRootEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "../../.env");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return; // keine Root-.env vorhanden → still überspringen
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace-Pakete werden als TS-Quelle konsumiert und hier transpiliert.
  transpilePackages: ["@voicebot/core", "@voicebot/db"],
};

export default nextConfig;
