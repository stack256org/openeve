import { slackChannel } from "eve/channels/slack";

// Reads SLACK_BOT_TOKEN for outbound calls and SLACK_SIGNING_SECRET to verify
// inbound webhooks. Both come from your own Slack app.
export default slackChannel({
  uploadPolicy: "disabled",
});
