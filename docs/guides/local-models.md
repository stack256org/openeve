---
title: "Local Models"
description: "Run an eve agent against Ollama, vLLM, LiteLLM, or a provider API directly, so model calls never transit a gateway."
---

An agent's `model` field accepts either a string or an AI SDK `LanguageModel`
object. The string form routes through the Vercel AI Gateway. The object form
goes wherever you point it, including a server on the same machine.

Nothing in eve has to be configured for this. A provider object is an ordinary
value, so pointing it at a local endpoint is the whole mechanism:

```ts title="agent/agent.ts"
import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: "http://127.0.0.1:11434/v1",
  name: "ollama",
});

export default defineAgent({
  model: ollama.chat("qwen3:8b"),
  modelContextWindowTokens: 32_768,
});
```

Install the provider package in your project. `ai` is already there as a
required peer dependency of eve; the OpenAI-compatible provider is not:

```bash
npm install @ai-sdk/openai
```

Three details in that example are load-bearing, and each fails in a different
way when you leave it out. The next three sections cover them.

## Set `modelContextWindowTokens`, or the build fails

This is the one that stops a local model outright.

eve needs the model's context window at compile time to configure compaction.
When `modelContextWindowTokens` is not authored, it looks the model up in the
Vercel AI Gateway catalogue at `https://ai-gateway.vercel.sh/v1/models/catalog`,
caching the response under `.eve/cache/`. A model you are serving yourself is
not in that catalogue, so `eve build` fails:

```text
Cannot compile agent compaction because the primary compaction trigger model
"ollama/qwen3:8b" does not have known AI Gateway context window metadata.
```

Authoring the value skips the lookup entirely. eve uses your number verbatim
and makes no request:

```ts
export default defineAgent({
  model: ollama.chat("qwen3:8b"),
  modelContextWindowTokens: 32_768,
});
```

Use the context length the server is actually configured with, not the model's
theoretical maximum. Ollama reports it as `context length` under
`ollama show <model>`, and truncates beyond `num_ctx` regardless of what you
tell eve. vLLM prints its `max_model_len` at startup.

If you also set a separate compaction summary model, give it
`compaction.modelContextWindowTokens` for the same reason.

## Set `name`, or the model is recorded as OpenAI

`createOpenAI()` identifies itself as the provider `openai` whatever `baseURL`
you gave it. eve builds the model's id from that provider and the model id, so
`createOpenAI({ baseURL: "http://127.0.0.1:11434/v1" })` produces
`openai/qwen3:8b` — a local model labelled as OpenAI's in the compiled manifest
and in every trace.

Pass `name` to fix the label:

```ts
const ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: "http://127.0.0.1:11434/v1",
  name: "ollama",
});
```

For a hosted provider eve ships no helper for, `name` does more than label: it
is what makes the catalogue lookup resolve, so you can omit
`modelContextWindowTokens` and let eve find the real limits. Use the provider's
real slug — `xai`, `moonshotai`, `google`:

```ts
const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
  name: "xai",
});

export default defineAgent({ model: xai.chat("grok-4.5") });
```

That lookup is a request to Vercel at build time. It costs nothing at runtime,
but if you want the build itself to reach nothing, author
`modelContextWindowTokens` and the request never happens.

## Use `.chat()` for anything that is not OpenAI

`createOpenAI(...)` returns a provider whose callable form is typed
`(modelId: OpenAIResponsesModelId) => LanguageModelV4`. Calling it directly
produces a model that POSTs to `/responses`, the OpenAI Responses API. Most
OpenAI-compatible servers implement `/chat/completions` and not `/responses`,
so the call 404s at request time:

```ts
const model = ollama.chat("qwen3:8b"); // POSTs /v1/chat/completions
const wrong = ollama("qwen3:8b"); // POSTs /v1/responses
```

Only native OpenAI needs the Responses API, and eve's own `openai()` helper
already uses it.

## A model slug is not a local path

`model: "openai/gpt-5.6-luna-fast"` routes through the Vercel AI Gateway. eve
classifies any bare string that way by definition, because the AI SDK resolves
an unqualified id through its default provider, which is the gateway.

Supplying your own provider key does not change this. The
`providerOptions.gateway.byok` block that `eve init` can scaffold forwards your
key _to the gateway_, which then calls the provider on your behalf. The request
still leaves your machine for Vercel, and the key goes with it.

If the goal is that no request reaches a third party you did not choose, the
string form cannot deliver it. Pass a provider object instead.

## Ollama

Ollama serves an OpenAI-compatible API on port 11434. It requires no
credential, but the AI SDK provider does, so pass any non-empty placeholder.
Pull the model first with `ollama pull qwen3:8b`; the model id is whatever
`ollama list` reports, tag included.

```ts title="agent/agent.ts"
import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: "http://127.0.0.1:11434/v1",
  name: "ollama",
});

export default defineAgent({
  model: ollama.chat("qwen3:8b"),
  modelContextWindowTokens: 32_768,
});
```

Tool calling is what eve leans on hardest. A small model that answers prose
well may still fail to emit a usable tool call, so test the agent's actual
tools rather than a plain chat turn before committing to a model.

## vLLM

`vllm serve` exposes the same surface on port 8000 by default. The model id is
the served model's name, which by default is the Hugging Face repository path
you launched with:

```ts
const vllm = createOpenAI({
  apiKey: "vllm",
  baseURL: "http://127.0.0.1:8000/v1",
  name: "vllm",
});

export default defineAgent({
  model: vllm.chat("Qwen/Qwen3-8B"),
  modelContextWindowTokens: 32_768,
});
```

If you started the server with `--api-key`, pass that value as `apiKey` instead
of a placeholder. Match `modelContextWindowTokens` to the `max_model_len` vLLM
reports at startup.

## LiteLLM

A LiteLLM proxy presents many upstream providers behind one OpenAI-compatible
endpoint, listening on port 4000 by default. The model id is the `model_name`
you declared in the proxy's config, not the upstream provider's id:

```ts
const litellm = createOpenAI({
  apiKey: process.env.LITELLM_API_KEY,
  baseURL: "http://127.0.0.1:4000/v1",
  name: "litellm",
});

export default defineAgent({
  model: litellm.chat("house-default"),
  modelContextWindowTokens: 128_000,
});
```

The proxy is a local endpoint, but where it forwards to is your configuration.
Routing to a hosted provider through LiteLLM still sends the request off the
machine.

## Any other OpenAI-compatible endpoint

The same shape covers llama.cpp's server, LM Studio, and the compatibility
endpoints hosted providers publish. Change `baseURL` and `name`, keep
`.chat()`:

| Server        | Default base URL                                           |
| ------------- | ---------------------------------------------------------- |
| Ollama        | `http://127.0.0.1:11434/v1`                                |
| vLLM          | `http://127.0.0.1:8000/v1`                                 |
| LiteLLM proxy | `http://127.0.0.1:4000/v1`                                 |
| xAI           | `https://api.x.ai/v1`                                      |
| Moonshot AI   | `https://api.moonshot.ai/v1`                               |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` |

## Direct Anthropic and OpenAI

For those two providers eve ships helpers, so you install nothing, author no
context window, and involve no gateway:

```ts title="agent/agent.ts"
import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({
  model: anthropic("claude-opus-5"),
});
```

`anthropic()` from `eve/models/anthropic` defaults to `claude-sonnet-5` and
reads `ANTHROPIC_API_KEY`. `openai()` from `eve/models/openai` defaults to
`gpt-5.6-luna-fast`, reads `OPENAI_API_KEY`, and uses the Responses API. Both
accept a bare provider model id. In local development both can also use
credentials saved through `/login`; a deployment needs the API key in the
server environment.

This is a direct provider call, not a local one. The request leaves your
machine for Anthropic or OpenAI — it just does not pass through anyone else on
the way.

## Pin the provider package exactly

`@ai-sdk/openai` and `@ai-sdk/anthropic` each pin `@ai-sdk/provider` to an
exact version, and so does `ai`. A caret range on the provider package can
install a second copy of `@ai-sdk/provider`, and TypeScript then rejects the
`model` field: the `LanguageModelV4` your provider returns is nominally a
different type from the one `defineAgent` expects.

Pin the provider package to the exact version that shares your `ai` release's
`@ai-sdk/provider`, the way the bundled templates do:

```json title="package.json"
{
  "dependencies": {
    "@ai-sdk/openai": "4.0.45",
    "ai": "7.0.70"
  }
}
```

Running `tsc` against the project is what catches a mismatch, so do it once
after adding the provider.

## What still leaves the machine

Pointing `model` at a local server removes the model call from the list of
outbound requests, and authoring `modelContextWindowTokens` removes the build's
catalogue lookup. It does not by itself make the agent hermetic: tools,
connections, and channels each call whatever they were written to call, and a
sandbox may fetch packages.

See [Self-host eve](./deployment/self-hosting) for the rest of a deployment
that does not depend on a third party, and
[Agent configuration](../agent-config#set-the-model) for the other forms the
`model` field accepts.
