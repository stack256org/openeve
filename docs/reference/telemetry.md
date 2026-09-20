---
title: "CLI Telemetry"
description: "Learn what eve CLI telemetry collects and how to control it."
---

# CLI telemetry

**open-eve collects nothing and sends nothing.** Telemetry is off out of the box,
and the CLI never contacts Vercel unless you turn it on yourself with
`eve telemetry enable`. Nothing below happens until you do.

The rest of this page describes what the CLI would send if you opted in, so the
choice is an informed one.

## What eve collects when you enable it

eve sends the following information to Vercel:

- The eve version, operating system, CPU architecture, and whether stdin is a terminal.
- The command you ran, its outcome, and setup or onboarding steps when applicable, including connection-ready and first-response timing. When setup or onboarding fails, eve sends a bounded category describing the failed step. It does not send the underlying error.
- For `eve dev`, whether you connected to a local or remote agent and whether the UI was interactive or headless.
- Random identifiers for the CLI session, installation, and project, plus whether the installation and project identifiers are ephemeral or persistent.

The project identifier lets eve group usage from the same project without sending its name or location. eve derives it from the Git remote when available, otherwise `REPOSITORY_URL` or the working directory, and transforms that value before sending it.

## What eve does not collect

eve does not collect command arguments, prompts, agent files, URLs, request headers, error messages, environment variables, file paths, or file contents.

## View telemetry data

Set `EVE_TELEMETRY_DEBUG=1` to print the telemetry batch to stderr instead of sending it:

```bash
EVE_TELEMETRY_DEBUG=1 eve info
```

## Turn telemetry on, and off again

Telemetry starts off. Check its status, and opt in or back out:

```bash
eve telemetry status
eve telemetry enable
eve telemetry disable
```

To suppress it for one command regardless of the saved setting, set `EVE_TELEMETRY_DISABLED=1`:

```bash
EVE_TELEMETRY_DISABLED=1 eve dev
```

eve saves your preference in your platform user configuration directory. In CI and Docker environments, eve uses fresh in-memory identifiers for each invocation instead of saving them.

Upstream eve defaults telemetry on and prints a one-time notice explaining how to turn it off. open-eve inverts the default, so that notice never appears.

Vercel handles CLI telemetry under the [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice).
