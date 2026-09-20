import { callSlackApi } from "eve/channels/slack";
import { defineTool } from "eve/tools";
import z from "zod";
import { normalizeSlackUserId } from "#lib/slack/parse.ts";

const inputSchema = z.object({
  userId: z.string().min(1),
});

export default defineTool({
  description: "Read a Slack user by user ID",
  async execute({ userId }) {
    const response = await callSlackApi({
      body: { user: normalizeSlackUserId(userId) },
      botToken: process.env.SLACK_BOT_TOKEN,
      operation: "users.info",
    });

    if (!response.ok) {
      throw new Error(`Slack users.info failed: ${response.error ?? "unknown_error"}`);
    }

    return {
      lookup: {
        mode: "user_id",
        userId,
      },
      user: response.user,
    };
  },
  inputSchema,
});
