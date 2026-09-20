# @mux/eve-video

Reusable Mux Video and Mux Robots tools for [Eve](https://eve.dev) agents.

Mount the extension with Mux credentials held in the consuming agent's environment:

```ts
import muxVideo from "@mux/eve-video";

export default muxVideo({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});
```

The mount namespace prefixes the included tools. Mounting as `mux_video.ts` exposes `mux_video__get_asset`, `mux_video__create_asset`, `mux_video__create_clip`, `mux_video__run_workflow`, and `mux_video__get_workflow_job`.

The package intentionally excludes multimodal embeddings and semantic search.
