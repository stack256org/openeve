import { defaultLinearAuth, linearChannel } from "eve/channels/linear";
import { stampTrusted } from "../lib/trust.js";

/**
 * Linear channel: Agent Sessions in, Agent Activities out.
 *
 * @remarks
 * The channel reads `LINEAR_AGENT_ACCESS_TOKEN` for outbound Agent Activities
 * and `LINEAR_WEBHOOK_SECRET` to verify inbound webhook signatures. The
 * `onAgentSession` hook keeps the default created/prompted dispatch, stamps
 * the caller as trusted (only workspace members can open an Agent Session, so
 * membership is the gate here), and adds the requester's name as session
 * context when Linear provides it, for attribution in progress notes and
 * reports.
 */
export default linearChannel({
  onAgentSession: (_ctx, event) => {
    if (event.action !== "created" && event.action !== "prompted") {
      return null;
    }
    const requester = event.agentActivity?.user ?? event.agentSession.creator;
    const context: string[] = [];
    const requesterName = requester?.displayName ?? requester?.name;
    if (requesterName) {
      context.push(`The requesting user is ${requesterName}.`);
    }
    return { auth: stampTrusted(defaultLinearAuth(event)), context };
  },
});
