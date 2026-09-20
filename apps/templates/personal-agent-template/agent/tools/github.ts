import { buildEveToolMap } from "@github-tools/sdk/eve";
import { defineDynamic } from "eve/tools";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const auth = ctx.session.auth.current;
      const userId = auth?.principalId;
      const token = process.env.GITHUB_TOKEN?.trim();
      if (!userId || userId.startsWith("eve:") || !token) {
        return {};
      }

      return buildEveToolMap({ preset: "maintainer", token });
    },
  },
});
