import { defineMcpClientConnection } from "eve/connections";

/**
 * Bare Resend MCP tool names this agent is allowed to discover.
 *
 * @remarks
 * Resend's MCP server publishes around 85 tools, including `create-api-key`, `remove-domain`, and
 * webhook CRUD. Those are account administration rather than marketing, and an agent that can mint
 * a credential or unverify a sending domain is a much larger blast radius than the job needs, so
 * the surface is an allow list rather than a block list: a tool the server adds later is invisible
 * here until someone adds it on purpose.
 *
 * Five groups are allowed. Broadcasts and templates are the campaign itself. `get-tiptap-json-content`
 * is the editor read that `compose-broadcast` and `compose-template` require before they can set
 * content. Contacts, segments, and topics are how a campaign gets targeted. `list-emails`,
 * `get-email`, `list-logs`, and `get-log` are read-only delivery diagnostics, which is what lets the
 * agent report what actually happened instead of inferring it. `list-domains` and `get-domain` are
 * read-only and load-bearing twice over: a broadcast's `from` address has to be a verified domain,
 * and `get-domain` is the only DKIM and SPF evidence the `deliverability` skill can actually cite.
 *
 * Deliberately excluded beyond account administration: `connect-to-editor` and
 * `disconnect-from-editor` (the `compose-*` tools handle that lifecycle themselves), the inbound
 * `list-received-*` and `get-received-*` family (this agent sends, it does not triage a mailbox), and
 * `create-contact-import` and friends, because a CSV import mutates the subscriber list in bulk and
 * is better done by a person watching it. Add any of them here if you want them.
 */
const ALLOWED_TOOLS = [
  "create-broadcast",
  "compose-broadcast",
  "update-broadcast",
  "get-broadcast",
  "list-broadcasts",
  "remove-broadcast",
  "send-broadcast",
  "create-template",
  "compose-template",
  "update-template",
  "get-template",
  "list-templates",
  "duplicate-template",
  "publish-template",
  "remove-template",
  "get-tiptap-json-content",
  "send-email",
  "send-batch-emails",
  "cancel-email",
  "update-email",
  "list-emails",
  "get-email",
  "list-logs",
  "get-log",
  "create-contact",
  "update-contact",
  "get-contact",
  "list-contacts",
  "remove-contact",
  "add-contact-to-segment",
  "remove-contact-from-segment",
  "list-contact-segments",
  "list-contact-topics",
  "update-contact-topics",
  "list-contact-properties",
  "get-contact-property",
  "create-segment",
  "get-segment",
  "list-segments",
  "remove-segment",
  "create-topic",
  "update-topic",
  "get-topic",
  "list-topics",
  "remove-topic",
  "list-domains",
  "get-domain",
];

/**
 * Bare Resend MCP tool names that put mail in somebody's inbox.
 *
 * @remarks
 * Always gated, including a scheduled send. This is the one place the Typefully pattern does not
 * transfer: there, `publish_at` distinguishes saving a draft from committing to publish, so an
 * ungated create is safe. Resend already separates those into different tools, and every tool here
 * is the commit step. `send-broadcast` with no `scheduledAt` mails the whole segment the moment it
 * returns, and mail cannot be recalled, so there is no unscheduled case worth letting through.
 *
 * Composing, updating, and publishing are not gated: building the campaign is the normal flow, the
 * same reason `notion-create-pages` is left open.
 */
const SEND_TOOLS = ["send-broadcast", "send-email", "send-batch-emails"];

/**
 * Bare Resend MCP tool names whose effects cannot be undone from here.
 *
 * @remarks
 * Deletes of a campaign, a template, or list state. `update-contact-topics` is gated alongside them
 * because it changes what someone consented to receive, which is the person's decision to reflect
 * rather than the model's to infer, and an audit of it lives in Resend rather than in this session.
 *
 * Matching is by substring against the qualified name, so `remove-contact` also covers
 * `remove-contact-from-segment`. Both should gate, so the overlap is harmless, but keep it in mind
 * before adding a name that is a prefix of a tool you meant to leave open.
 */
const DESTRUCTIVE_TOOLS = [
  "remove-broadcast",
  "remove-template",
  "remove-contact",
  "remove-segment",
  "remove-topic",
  "update-contact-topics",
];

/**
 * Resend connection (MCP) exposing campaign, list, and delivery tools to the model.
 *
 * @remarks
 * Authorization is a Resend API key read from `RESEND_API_KEY`. The key is resolved before every
 * tool call and never exposed to the model. It is account-scoped rather than per-user, which is
 * the one place this template gives something up: Resend records the send against the key rather
 * than against the person who approved it. The approval prompt is what names that person, so keep
 * the gates below, and mint the key with the narrowest permission Resend offers.
 *
 * The discoverable surface is narrowed to {@link ALLOWED_TOOLS}. Calls that send mail
 * ({@link SEND_TOOLS}) or that cannot be undone ({@link DESTRUCTIVE_TOOLS}) pause for an
 * approve or deny decision before they run.
 *
 * @see {@link https://resend.com/docs/mcp-server | Resend MCP server}
 */
export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    [...SEND_TOOLS, ...DESTRUCTIVE_TOOLS].some((tool) => toolName.includes(tool))
      ? "user-approval"
      : "not-applicable",
  auth: { getToken: async () => ({ token: process.env.RESEND_API_KEY! }) },
  description:
    "Resend: build and send email campaigns. Create, compose, and send broadcasts to a segment; " +
    "create, compose, publish, and duplicate reusable templates with {{{VARIABLE}}} placeholders; " +
    "send a one-off or batch email and cancel a scheduled one; manage contacts, segments, topics, " +
    "and topic subscriptions; read delivery status, opens, and request logs; and list verified " +
    "sending domains with their DKIM and SPF records.",
  tools: { allow: ALLOWED_TOOLS },
  url: "https://mcp.resend.com/mcp",
});
