# What open-eve does not do yet

open-eve is a version of eve that runs entirely on your own machine or server,
with nothing sent to Vercel. A few things from the original plan are not built
yet. This page says what they are, why they were left out, and whether it
should matter to you.

Nothing on this list stops open-eve from working without Vercel. That promise
is complete.

---

## 1. Storing memory in cloud file storage (S3)

**What it would do.** Let your agent keep its memory in a cloud storage bucket
such as MinIO, Backblaze, or Amazon S3, instead of a file on your own disk.

**Why it is not built.** To talk to S3 you have to sign every request with a
fiddly security signature. The normal way is to install Amazon's toolkit, but
open-eve deliberately installs almost nothing, so we would have to write that
signing code ourselves. It is about 120 lines of security-sensitive code, and
getting it wrong is the kind of mistake that is hard to spot.

**Does it matter to you?** Almost certainly not. Memory already works out of
the box, stored in `data/openeve.db` on your own disk. You only need S3 if you
run open-eve on several servers at once that all share the same memory.

**When.** The next release.

---

## 2. Moving trace history into the database

**What it would do.** Put the recorded history of what your agent did into the
same single database file as everything else, instead of its own folder.

**Why it is not built.** This one is easy to misread as important. It is not.
The trace history is _already_ stored on your own machine and never touches
Vercel. Moving it would mean rewriting roughly 750 lines of working code, plus
the part of the terminal viewer that reads it, and you would end up with
exactly the same behaviour you have today. It is tidying, not a fix.

**Does it matter to you?** No. Traces work now. `openeve traces` and
`openeve traces ls` behave exactly as before.

**One small consequence.** When you move open-eve to a new server, you copy the
`data/` folder. Trace history lives in `.eve/traces/` instead, so it does not
come along. Most people do not want old traces on a new server anyway.

**When.** No date. It will only happen if listing traces becomes slow enough to
be annoying.

---

## 3. Asking Vercel to accept one of our changes

**What it would do.** open-eve has to change 14 small places in eve's code so it
stops assuming it is running on Vercel. We could ask Vercel to make that change
in their own code instead, since it would not alter how eve behaves for them.

**Why it is not done yet.** We want open-eve working first. If we ask now and
they say yes, we would still be changing our version at the same time, and the
two would fight.

**Does it matter to you?** Not directly. It matters to whoever maintains
open-eve: if Vercel accepts it, keeping open-eve up to date with new eve
releases gets permanently easier. If they say no, nothing changes.

**When.** After the first working release.

---

## 4. A model picker for local models in the setup wizard

**What it would do.** Have `openeve init` ask whether you want to use a model
running on your own machine, spot a running Ollama automatically, and write the
right lines into your agent for you.

**Why it is not built.** Because you do not need it. Using a local model
already works, it is just three lines you write yourself:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const local = createOpenAI({ apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" });

export default defineAgent({ model: local("qwen3:8b") });
```

Change the address and you have LiteLLM, vLLM, or any other server that speaks
the OpenAI format. The wizard would have saved you typing that, at the cost of
extra code inside open-eve that has to be kept working. Not a good trade.

**Does it matter to you?** No. Local models work. You write three lines instead
of answering three questions.

**When.** The documentation page showing this comes next. The wizard itself,
probably never.

---

## Things that sound missing but are not

| You might expect                | Reality                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| "Does it need a database?"      | No. Not until you run it on more than one server.                           |
| "Are channels like Slack gone?" | No. All nine still work. They use your own credentials instead of Vercel's. |
| "Can I still use Vercel?"       | Yes. It is a one-line setting, not a fork.                                  |
| "Do I need a Vercel account?"   | No. Not for anything.                                                       |
| "Is trace recording lost?"      | No. It works exactly as before.                                             |

---

_This page is updated as work lands. Last updated 2026-09-20._
