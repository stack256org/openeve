# Evaluating the Mux Video Agent

This project evaluates agent behavior with three questions: **does it work, does it work efficiently, and is the value worth the cost?** We call those dimensions efficacy, efficiency, and expense—the three E's.

## Efficacy

Efficacy asks whether the agent and workflow produced the intended result.

The initial summarization suite uses deterministic gates only where the contract is already clear:

- the agent requests approval for `mux_video__run_workflow`;
- it calls that tool once with the correct asset ID, `workflow: "summarize"`, a tag limit no greater than requested, and no metadata mutation;
- the Mux Robots job reaches `completed` without a failed agent action;
- the completed job parameters preserve the asset ID and a tag limit no greater than requested;
- the completed output contains a non-empty title, description, and tag list;
- tags are non-empty strings, unique without regard to case, and do not exceed the requested count.

The generated title, description, and tags are written to the Eve eval artifact for review. Semantic tag relevance is intentionally not a gate yet. After several representative runs, we can establish per-asset reference tags, compare model variability, calibrate human or judge agreement, and only then add a soft threshold. A threshold should graduate to a strict CI gate only after it has a demonstrated signal-to-noise ratio.

The summarize API defaults `tag_count` to 10. The tool-input and completed-job gates therefore accept either an omitted tag count or an explicit integer from 1 through 10. The output gate remains authoritative: the completed tag list may never exceed 10 entries. This measures the requested outcome instead of grading whether a model redundantly restated the API default.

The approval gate intentionally requires Eve's tool approval request. A model-generated `ask_question` that asks for the same confirmation fails: it duplicates the framework's approval UI and has not yet attempted the operation being evaluated. When this happens, verbose output prints the expected and observed input-request routes before the failed gate.

## Efficiency

Efficiency asks how much work and time the successful result required. Every case records:

- time until the approval request;
- end-to-end agent latency through the post-tool reply;
- time spent polling the asynchronous Mux job;
- model step count;
- input, output, cache-read, and cache-write tokens.

These are baseline measurements today, not pass/fail thresholds. Once the suite has enough runs, use observed distributions—not a single best run—to define good and acceptable operating ranges.

## Expense

Expense asks what the successful result cost. Every case records:

- model cost reported by Eve;
- the number of Mux Robots jobs started;
- Mux AI units reported by the completed job.

Pricing changes, so retain provider-reported cost and Mux units as raw evidence. Any later dollar budgets should document the pricing date and be recalibrated periodically.

## Current matrix

The suite runs the same two assets against two agent models:

- `openai/gpt-5.6-luna`
- `google/gemini-3.5-flash`

Set two distinct, stable fixture assets in `.env.local`:

```bash
MUX_TEST_ASSET_ID=...
MUX_TEST_MOVIE_TRAILER_ASSET_ID=...
```

Both assets must be accessible to the configured Mux token and suitable for summarization. The movie-trailer fixture gives the suite a distinct content shape for evaluating titles, descriptions, and tags, but the variable names do not impose a hidden golden answer.

## Running the suite

List the cases without executing live model or Mux calls:

```bash
pnpm eval:list
```

Run both assets against the current/default agent model:

```bash
pnpm eval
```

Run both assets against any model available through your configured Vercel AI Gateway credentials by passing its model ID to the matrix wrapper:

```bash
pnpm eval:models -- --model spacexai/grok-4.6
```

This runs only the specified model and creates two live summarization jobs. The wrapper consumes `--model` before invoking Eve because the `eve eval` CLI does not provide its own model flag. Repeat the option to run a custom matrix; duplicate IDs are evaluated only once:

```bash
pnpm eval:models -- --model openai/gpt-5.6-luna --model google/gemini-3.5-flash
```

For a single model, setting the agent's environment variable directly remains equivalent:

```bash
MUX_VIDEO_AGENT_MODEL=spacexai/grok-4.6 pnpm eval
```

Run the full two-model matrix:

```bash
pnpm eval:models
```

Without `--model`, the matrix command uses the two models listed above regardless of `MUX_VIDEO_AGENT_MODEL`. It creates four live summarization jobs and incurs model and Mux usage. Runs are serial to keep the results easier to interpret. The default commands use Eve's verbose mode, so each case prints one readable block containing its summary output, efficacy, efficiency, expense, and job details. Eve also stores the full result, logs, assertions, and event stream under `.eve/evals/<timestamp>/`.

Do not add `--strict` merely to make an early baseline look like a test gate. First gather repeated runs, add reference criteria, set documented soft thresholds, and observe their stability. Strict mode becomes useful once those thresholds are calibrated.
