import { slackChannel } from "eve/channels/slack";
import { designAgentConfig } from "../../generated/config.js";

const setupIncompleteMessage =
  "Design-agent setup is incomplete. Run the bootstrap workflow and approve the generated design corpus.";

function isAllowed(value: string, allowlist: readonly string[]) {
  return allowlist.length === 0 || allowlist.includes(value);
}

function conversationContext(isDirectMessage: boolean) {
  const owner = designAgentConfig.designOwnerSlackId;

  return `
<design_agent_context visibility="${isDirectMessage ? "private-dm" : "shared"}" allow_general_guidance="${designAgentConfig.allowGeneralGuidance}">
The approved design owner is ${owner ? `<@${owner}>` : "not configured"}.
${
  isDirectMessage
    ? "Never mention, notify, or forward private DM content to the design owner. Direct unresolved questions to an appropriate shared conversation."
    : "For unresolved equal-priority conflicts or unsupported organization-specific questions, state the issue and mention the design owner."
}
</design_agent_context>
`;
}

// Reads SLACK_BOT_TOKEN for outbound calls and SLACK_SIGNING_SECRET to verify
// inbound webhooks. See docs/slack-setup.md.
export default slackChannel({
  uploadPolicy: {
    allowedMediaTypes: [
      "image/*",
      "text/*",
      "application/json",
      "application/msword",
      "application/pdf",
      "application/rtf",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.oasis.opendocument.presentation",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  events: {
    "turn.started": () => {},
    "actions.requested": () => {},
    "reasoning.appended": () => {},
  },
  async onMessage(ctx, message) {
    if (!message.author || message.author.isBot) return null;

    const isDirectMessage = message.raw.channel_type === "im";
    if (!isDirectMessage && !ctx.isBotMentioned()) return null;
    if (!isAllowed(message.author.userId, designAgentConfig.allowedUserIds)) {
      return null;
    }
    if (!isDirectMessage && !isAllowed(message.channelId, designAgentConfig.allowedChannelIds)) {
      return null;
    }

    if (designAgentConfig.status !== "approved") {
      await ctx.thread.post(setupIncompleteMessage);
      return null;
    }

    const isExistingSession = await ctx.isSubscribed();
    return isExistingSession
      ? { auth: null }
      : {
          auth: null,
          context: [conversationContext(isDirectMessage)],
        };
  },
});
