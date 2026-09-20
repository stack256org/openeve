import { readManifest } from "./knowledge.mjs";

const REQUIRED_ENV = [
  ["ANTHROPIC_API_KEY", "Model credentials for agent/agent.ts."],
  ["SLACK_BOT_TOKEN", 'Slack "Bot User OAuth Token" under OAuth & Permissions.'],
  ["SLACK_SIGNING_SECRET", 'Slack "Signing Secret" under Basic Information.'],
];

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm run setup [--url https://<host>]

Reports which required environment variables are missing and whether the design
corpus is approved. With --url, probes a running agent's Eve health and Slack
routes over HTTPS.`);
  process.exit(0);
}

function deploymentUrl() {
  const index = process.argv.indexOf("--url");
  if (index === -1) return undefined;
  const raw = process.argv[index + 1];
  if (!raw) throw new Error("--url needs a value, for example --url https://agent.example.com.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("--url must be https, or http://localhost for a local check.");
  }
  return url;
}

function reportEnvironment() {
  const missing = REQUIRED_ENV.filter(([key]) => !process.env[key]?.trim());
  for (const [key, hint] of REQUIRED_ENV) {
    const status = process.env[key]?.trim() ? "set" : "MISSING";
    console.log(`  ${key}: ${status}${status === "MISSING" ? ` — ${hint}` : ""}`);
  }
  return missing.length === 0;
}

async function probe(url, path, init) {
  const response = await fetch(new URL(path, url), init);
  return { body: (await response.text()).trim(), status: response.status };
}

async function validateRoutes(url) {
  const health = await probe(url, "/eve/v1/health");
  if (health.status !== 200) {
    throw new Error(`Expected the Eve health route to return 200; received ${health.status}.`);
  }
  let payload;
  try {
    payload = JSON.parse(health.body);
  } catch {
    throw new Error("The Eve health route did not return JSON.");
  }
  if (payload.ok !== true || payload.status !== "ready") {
    throw new Error("The Eve health route did not report ready.");
  }

  const slack = await probe(url, "/eve/v1/slack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (slack.status !== 401 || slack.body !== "unauthorized") {
    throw new Error(
      `Expected the unsigned Slack route to return 401 unauthorized; received ${slack.status} ${slack.body || "(empty body)"}.`,
    );
  }
}

console.log("Checking the design agent setup.");

console.log("\nEnvironment:");
const environmentReady = reportEnvironment();

const manifest = await readManifest();
console.log(`\nKnowledge corpus: ${manifest.status}`);
if (manifest.status !== "approved") {
  console.log("  Run BOOTSTRAP.md and have the design owner approve the corpus.");
}

const url = deploymentUrl();
if (url) {
  console.log(`\nProbing ${url.origin}`);
  await validateRoutes(url);
  console.log("  Eve health route ready; unsigned Slack requests rejected.");
}

if (!environmentReady) {
  console.error("\nSet the missing variables in .env.local, or in your host's environment.");
  process.exitCode = 1;
}
