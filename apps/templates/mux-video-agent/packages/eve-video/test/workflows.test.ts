import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  parametersForWorkflow,
  runWorkflowInputSchema,
  runWorkflowToolInputSchema,
  workflowSchema,
} from "../extension/lib/workflows";

test("workflow tool schema exposes a provider-portable object root", () => {
  const schema = z.toJSONSchema(runWorkflowToolInputSchema, { io: "input", target: "draft-7" });

  assert.equal(schema.type, "object");
  assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(schema.oneOf, undefined);
  assert.equal(schema.anyOf, undefined);
  assert.deepEqual(schema.required, ["assetId", "workflow"]);
  const workflowProperty = schema.properties?.workflow;
  assert.ok(workflowProperty && typeof workflowProperty === "object");
  assert.deepEqual(workflowProperty.enum, workflowSchema.options);
  assert.deepEqual(
    runWorkflowToolInputSchema.parse({ assetId: "asset-1", workflow: "summarize" }),
    { assetId: "asset-1", workflow: "summarize" },
  );
});

test("summarize input maps camelCase fields to the Robots wire contract", () => {
  const input = runWorkflowInputSchema.parse({
    workflow: "summarize",
    assetId: "asset-1",
    tone: "professional",
    outputLanguageCode: "fr",
    outputSteering: {
      summaryStyle: "concise",
      audience: "developers",
      brandTerms: ["Mux"],
      tagTaxonomy: {
        values: [{ label: "Tutorial", aliases: ["Guide"] }],
        allowOther: false,
      },
    },
    updateAssetMeta: false,
  });

  assert.deepEqual(parametersForWorkflow(input), {
    asset_id: "asset-1",
    tone: "professional",
    output_language_code: "fr",
    update_asset_meta: false,
    output_steering: {
      summary_style: "concise",
      audience: "developers",
      brand_terms: ["Mux"],
      tag_taxonomy: {
        values: [{ label: "Tutorial", aliases: ["Guide"] }],
        allow_other: false,
      },
    },
  });
});

test("caption translation maps the selected track and upload behavior", () => {
  const input = runWorkflowInputSchema.parse({
    workflow: "translate-captions",
    assetId: "asset-1",
    trackId: "track-1",
    toLanguageCode: "es",
  });

  assert.deepEqual(parametersForWorkflow(input), {
    asset_id: "asset-1",
    track_id: "track-1",
    to_language_code: "es",
    upload_to_mux: true,
  });
});

test("premium-caption replacement requires an explicit source language", () => {
  const result = runWorkflowInputSchema.safeParse({
    workflow: "generate-premium-captions",
    assetId: "asset-1",
    replaceExisting: true,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0]?.message ?? "", /languageCode is required/);
  }
});

test("caption editing requires a replacement or profanity policy", () => {
  const result = runWorkflowInputSchema.safeParse({
    workflow: "edit-captions",
    assetId: "asset-1",
    trackId: "track-1",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0]?.message ?? "", /Provide replacements/);
  }
});
