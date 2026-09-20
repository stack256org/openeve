import { slackChannel } from "eve/channels/slack";

/**
 * Slack channel: answers @mentions and DMs, replies in threads, and renders approvals as buttons.
 *
 * @remarks
 * Credentials come from the environment: `SLACK_BOT_TOKEN` for outbound calls and
 * `SLACK_SIGNING_SECRET` for inbound webhook verification. Create a Slack app, install it in the
 * workspace, and point its Event Subscriptions request URL at this project's `/eve/v1/slack`.
 */
export default slackChannel();
