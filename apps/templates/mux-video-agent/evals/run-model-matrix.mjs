import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEFAULT_MODELS = ["openai/gpt-5.6-luna", "google/gemini-3.5-flash"];
const REQUIRED_ASSETS = ["MUX_TEST_ASSET_ID", "MUX_TEST_MOVIE_TRAILER_ASSET_ID"];

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const missing = REQUIRED_ASSETS.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(`Missing required eval environment variables: ${missing.join(", ")}.`);
}
if (process.env[REQUIRED_ASSETS[0]] === process.env[REQUIRED_ASSETS[1]]) {
  throw new Error(`${REQUIRED_ASSETS.join(" and ")} must reference different assets.`);
}

const { models, passthroughArgs } = parseArgs(process.argv.slice(2));
let failed = false;

for (const model of models) {
  process.stdout.write(`\n=== ${model} ===\n`);
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "eve",
      "eval",
      "summarization",
      "--max-concurrency",
      "1",
      "--verbose",
      ...passthroughArgs,
    ],
    {
      env: { ...process.env, MUX_VIDEO_AGENT_MODEL: model },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Eval matrix process exited from signal ${result.signal}.`);
  }
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;

function parseArgs(args) {
  const requestedModels = [];
  const passthroughArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    // pnpm may preserve its `--` separator when it invokes the script.
    if (arg === "--") continue;

    if (arg === "--model") {
      const model = args[index + 1]?.trim();
      if (!model || model.startsWith("-")) {
        throw new Error("--model requires a Vercel AI Gateway model ID.");
      }
      requestedModels.push(model);
      index += 1;
      continue;
    }

    if (arg.startsWith("--model=")) {
      const model = arg.slice("--model=".length).trim();
      if (!model) {
        throw new Error("--model requires a Vercel AI Gateway model ID.");
      }
      requestedModels.push(model);
      continue;
    }

    passthroughArgs.push(arg);
  }

  return {
    models: requestedModels.length > 0 ? [...new Set(requestedModels)] : DEFAULT_MODELS,
    passthroughArgs,
  };
}
