import muxVideo from "@mux/eve-video";

export default muxVideo({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});
