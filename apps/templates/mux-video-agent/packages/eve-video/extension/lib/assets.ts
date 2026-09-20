import { publicPlaybackUrls } from "./mux-api";

export function compactAsset(asset: unknown): Record<string, unknown> {
  if (!isRecord(asset)) return { asset };

  return {
    id: asset.id ?? null,
    status: asset.status ?? null,
    durationSeconds: asset.duration ?? null,
    aspectRatio: asset.aspect_ratio ?? null,
    audioOnly: asset.audio_only ?? null,
    createdAt: asset.created_at ?? null,
    maxStoredResolution: asset.max_stored_resolution ?? null,
    passthrough: asset.passthrough ?? null,
    meta: asset.meta ?? null,
    playback: publicPlaybackUrls(asset),
    tracks: Array.isArray(asset.tracks) ? asset.tracks.map(compactTrack) : [],
    errors: asset.errors ?? null,
  };
}

function compactTrack(track: unknown): unknown {
  if (!isRecord(track)) return track;
  return {
    id: track.id ?? null,
    type: track.type ?? null,
    status: track.status ?? null,
    name: track.name ?? null,
    languageCode: track.language_code ?? null,
    textType: track.text_type ?? null,
    textSource: track.text_source ?? null,
    primary: track.primary ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
