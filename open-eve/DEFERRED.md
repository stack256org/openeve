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

**One thing to know.** Those traces are recorded while you work on the agent
locally with `openeve dev`. A deployed server does not record them, and does
not send them anywhere either — you point it at a trace collector you run, or
it reports nothing. That is a deliberate default: no telemetry leaves the
machine unless you ask for it.

**One small consequence.** When you move open-eve to a new server you copy the
`data/` folder and the `.eve/.workflow-data` folder. Trace history lives in
`.eve/traces/` instead, so it does not come along. Most people do not want old
traces on a new server anyway.

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
already works, and it is a handful of lines you write yourself:

```ts
import { createOpenAI } from "@ai-sdk/openai";

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

Change the address and you have LiteLLM, vLLM, or any other server that speaks
the OpenAI format. The wizard would have saved you typing that, at the cost of
extra code inside open-eve that has to be kept working. Not a good trade.

**Does it matter to you?** No, but read the page before you start. There are
three details in that snippet that each fail differently if you leave them out,
and one of them stops the build rather than the request. All three are written
up in [Local models](../docs/guides/local-models.md).

**When.** The documentation is written. The wizard itself, probably never.

---

## 5. One template still needs Vercel Sandbox

**Which one.** `eve-software-factory-template`. Every other template runs with
nothing hosted.

**What it would do.** This template checks code out of GitHub and runs it. To
do that safely it gives the sandbox a way to reach github.com _without ever
handing it the GitHub token_: the firewall attaches the credential on the way
out, so code running inside can use the connection but can never read the
secret.

**Why it is not built.** The local Docker sandbox cannot do that. It is not a
missing option, it is a refusal — eve's own Docker backend stops with this
message:

> The local Docker sandbox backend supports only the "allow-all" and
> "deny-all" network policies. Domain-level allow-lists and credential
> brokering require the Vercel backend (vercel()) or microsandbox().

Every way of making Docker work here puts the GitHub token inside the sandbox,
where the model can simply print it. That is a real reduction in safety, not a
paperwork difference, so it was not done.

**Does it matter to you?** Only if you use this one template. The other eleven
have no hosted dependency.

**When.** There is a way forward: `microsandbox()` runs locally, costs nothing,
and does support credential brokering. It needs macOS on Apple Silicon, or
Linux with KVM. That is a different piece of work with different risks, so it
is a separate task rather than a quick swap.

---

## 6. The package is still called `eve`

**What it would do.** Publishing open-eve to npm under its own name, so you
could install it the ordinary way.

**Why it is not built.** In JavaScript, a package's name is also the word you
type when you import it. Renaming `eve` to `open-eve` would mean editing about
1,600 lines across the project that all say `eve`. Every one of those lines
would then differ from Vercel's version, and every time we pull in their
updates, all 1,600 would have to be reconciled by hand. Keeping open-eve
current with eve is the whole point of the fork, so that trade is not worth
making.

**Does it matter to you?** A little. You install open-eve by cloning this
repository and building it, not with `npm install`. `npm install eve` gives
you Vercel's version, not this one. Everything after that is the same.

**When.** Only if open-eve is published to npm as its own package. That is a
decision nobody has made yet. If it happens, the rename lands as one commit
that changes nothing else.

---

## 7. The command to install add-ons still points at Vercel's catalogue

**What it would do.** `openeve add` fetches ready-made pieces — extensions,
channel setups, memory providers — from a catalogue. That catalogue is
Vercel's, at `https://eve.dev/r`. open-eve would publish its own.

**Why it is not built.** Publishing a catalogue means hosting it somewhere, and
nowhere has been chosen. Changing the address before a replacement exists would
swap a working default for a broken one, which is strictly worse.

**Does it matter to you?** Rarely, and it is fixable in one line. The address
is just a setting: `EVE_DEV_OFFICIAL_REGISTRY_URL` overrides it, and
`openeve registry add` points at any catalogue you like, including your own.
Fetching from that catalogue copies files onto your machine and nothing more.
What happens next is up to the piece you installed — a few of them offer to set
up a Vercel service afterwards, and you can say no.

**When.** When someone decides where to host it.

---

## 8. `openeve link` and `openeve deploy` are still offered to everyone

**What it would do.** Those two commands only do anything on Vercel. On a
self-hosted agent they are noise in the help output.

**Why it is not built.** Hiding them was the plan, then it looked like the
wrong fix: a command that silently disappears teaches nobody why it is gone. A
clear "this agent is not configured for Vercel" message would be better, and
that has not been written.

**Does it matter to you?** No. They still work for people who do want Vercel,
and the promise that nothing reaches Vercel is enforced where it counts — in
the running server — not by which commands appear in a help listing.

**When.** No date. It is cosmetic.

---

## 9. The generated web app forgets who signed up

**What it would do.** The scaffolding can generate a web chat app with a
sign-in page. It used to sign in through Vercel; it now asks for an email
address and a password instead. What it does not do is save those accounts
anywhere permanent.

**Why it is not built.** The login library it uses keeps accounts in memory
when you do not give it a database. Giving it one means choosing a database,
adding it to the generated project, and wiring up the table setup — a much
bigger change than swapping the sign-in method was. The generated
`lib/auth.ts` says so in a comment directly above the code, so nobody meets
this by surprise.

**What actually happens.** Accounts vanish when the server restarts, and an
account created on one server is invisible to another. It was true of the
Vercel version too, but it mattered less there, because Vercel remembered
people. Now nothing does.

**Does it matter to you?** Only if you use the variant with sign-in, and you
almost certainly are not. `openeve init` does not offer it — it writes the
plain version, which has no sign-in at all. The one with sign-in is reachable
only from code, by passing `webAuthentication: "sign-in-with-vercel"` to
`ensureChannel`.

**A name that lies.** That setting is still called `sign-in-with-vercel`, and
its folder is still named that, even though it no longer signs in with Vercel
at all. The name is wrong and we left it wrong on purpose: it is part of the
published interface, so changing it breaks other people's code, and renaming
folders is what makes merging Vercel's updates painful. Read it as "the
variant with a login page".

**When.** Whenever someone needs the login page to survive a restart. Until
then, add a database adapter yourself in `lib/auth.ts`.

---

## Things that sound missing but are not

| You might expect                | Reality                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| "Does it need a database?"      | No. Not until you run it on more than one server.                           |
| "Are channels like Slack gone?" | No. All nine still work. They use your own credentials instead of Vercel's. |
| "Can I still use Vercel?"       | Yes. It is a one-line setting, not a fork.                                  |
| "Do I need a Vercel account?"   | No. Not for anything.                                                       |
| "Is trace recording lost?"      | No. It works exactly as before.                                             |
| "Is `openeve` a new command?"   | It is a second name for `eve`. Both run the same program.                   |

---

_This page is updated as work lands. Last updated 2026-09-20._
