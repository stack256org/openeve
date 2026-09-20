import assert from "node:assert/strict";
import test from "node:test";

import {
  compactWorkflowJob,
  MuxApiError,
  publicPlaybackUrls,
  requestMuxWithConfig,
} from "../extension/lib/mux-api";

const config = {
  tokenId: "test-token-id",
  tokenSecret: "test-token-secret",
  apiBaseUrl: "https://api.mux.test",
};

test("requestMuxWithConfig signs, serializes, and unwraps a Mux response", async () => {
  let seenUrl: string | undefined;
  let seenInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    seenUrl = String(input);
    seenInit = init;
    return new Response(JSON.stringify({ data: { id: "asset-1" } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await requestMuxWithConfig<{ id: string }>(
    config,
    "/video/v1/assets",
    { method: "POST", body: { test: true } },
    { fetch: fetchMock },
  );

  assert.deepEqual(result, { id: "asset-1" });
  assert.equal(seenUrl, "https://api.mux.test/video/v1/assets");
  assert.equal(seenInit?.method, "POST");
  assert.equal(seenInit?.body, JSON.stringify({ test: true }));
  assert.equal(
    new Headers(seenInit?.headers).get("authorization"),
    `Basic ${Buffer.from("test-token-id:test-token-secret").toString("base64")}`,
  );
});

test("compactWorkflowJob redacts temporary output URLs before model projection", () => {
  assert.deepEqual(
    compactWorkflowJob({
      id: "job-1",
      workflow: "generate-premium-captions",
      status: "completed",
      outputs: {
        track_id: "track-1",
        temporary_words_url: "https://signed.example/words.json?token=secret",
      },
    }),
    {
      id: "job-1",
      workflow: "generate-premium-captions",
      status: "completed",
      parameters: undefined,
      outputs: {
        track_id: "track-1",
        temporary_words_url: "[redacted temporary URL]",
      },
      unitsConsumed: null,
      createdAt: null,
      updatedAt: null,
      passthrough: null,
      errors: undefined,
    },
  );
});

test("requestMuxWithConfig preserves a safe upstream error body", async () => {
  const fetchMock: typeof fetch = async () =>
    new Response(
      JSON.stringify({ error: { type: "invalid_parameters", message: "asset_id is required" } }),
      { status: 422 },
    );

  await assert.rejects(
    requestMuxWithConfig(config, "/robots/v0/jobs/summarize", {}, { fetch: fetchMock }),
    (error: unknown) => {
      assert.ok(error instanceof MuxApiError);
      assert.equal(error.status, 422);
      assert.deepEqual(error.responseBody, {
        error: { type: "invalid_parameters", message: "asset_id is required" },
      });
      assert.doesNotMatch(error.message, /test-token/);
      return true;
    },
  );
});

test("publicPlaybackUrls only emits URLs for public playback IDs", () => {
  assert.deepEqual(
    publicPlaybackUrls({
      playback_ids: [
        { id: "public-id", policy: "public" },
        { id: "signed-id", policy: "signed" },
      ],
    }),
    [
      {
        playbackId: "public-id",
        hlsUrl: "https://stream.mux.com/public-id.m3u8",
        playerUrl: "https://player.mux.com/public-id",
        thumbnailUrl: "https://image.mux.com/public-id/thumbnail.jpg",
      },
    ],
  );
});
