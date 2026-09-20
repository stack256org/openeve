import { z } from "zod";

const assetIdSchema = z.string().trim().min(1);
const trackIdSchema = z.string().trim().min(1);
const languageCodeSchema = z.string().trim().min(1).max(32);
const passthroughSchema = z.string().trim().min(1).max(255).optional();

const taxonomySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    values: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          description: z.string().trim().min(1).optional(),
          aliases: z.array(z.string().trim().min(1)).min(1).optional(),
        }),
      )
      .min(1)
      .optional(),
    allowOther: z.boolean().optional(),
  })
  .strict();

const targetSchema = z.object({
  assetId: assetIdSchema,
  passthrough: passthroughSchema,
});

const askQuestionSchema = z
  .object({
    question: z.string().trim().min(1),
    answerOptions: z.array(z.string().trim().min(1)).min(1).optional(),
    freeFormReply: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.answerOptions !== undefined && value.freeFormReply === true) {
      ctx.addIssue({
        code: "custom",
        path: ["answerOptions"],
        message: "answerOptions cannot be combined with freeFormReply",
      });
    }
  });

export const workflowSchema = z.enum([
  "summarize",
  "ask-questions",
  "generate-chapters",
  "find-scenes",
  "find-key-moments",
  "find-best-thumbnails",
  "moderate",
  "translate-captions",
  "generate-premium-captions",
  "edit-captions",
]);

export const runWorkflowInputSchema = z
  .discriminatedUnion("workflow", [
    targetSchema
      .extend({
        workflow: z.literal("summarize"),
        tone: z.enum(["neutral", "playful", "professional"]).optional(),
        titleLength: z.number().int().positive().optional(),
        descriptionLength: z.number().int().positive().optional(),
        tagCount: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Maximum number of tags to return. Defaults to 10 when omitted."),
        languageCode: languageCodeSchema.optional(),
        outputLanguageCode: languageCodeSchema.optional(),
        outputSteering: z
          .object({
            summaryStyle: z.enum(["concise", "detailed", "editorial"]).optional(),
            audience: z.string().trim().min(1).optional(),
            brandTerms: z.array(z.string().trim().min(1)).min(1).optional(),
            tagTaxonomy: taxonomySchema.optional(),
          })
          .strict()
          .optional(),
        updateAssetMeta: z.boolean().optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("ask-questions"),
        questions: z.array(askQuestionSchema).min(1),
        languageCode: languageCodeSchema.optional(),
        maxFreeFormAnswerLength: z.number().int().positive().optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("generate-chapters"),
        languageCode: languageCodeSchema.optional(),
        outputLanguageCode: languageCodeSchema.optional(),
        outputSteering: z
          .object({
            chapterStyle: z
              .enum(["descriptive", "punchy", "educational", "seo", "platform_neutral"])
              .optional(),
            chapterGranularity: z.enum(["coarse", "balanced", "fine"]).optional(),
            audience: z.string().trim().min(1).optional(),
            brandTerms: z.array(z.string().trim().min(1)).min(1).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("find-scenes"),
        languageCode: languageCodeSchema.optional(),
        minScenes: z.number().int().positive().optional(),
        minSceneDurationMs: z.number().int().min(1_000).optional(),
        outputSteering: z
          .object({
            segmentationStrategy: z
              .enum([
                "editorial_beats",
                "topic_changes",
                "visual_transitions",
                "action_progression",
                "instructional_steps",
              ])
              .optional(),
            titleStyle: z
              .enum(["descriptive", "editorial", "search_optimized", "accessibility"])
              .optional(),
            narrationDetail: z.enum(["concise", "balanced", "detailed"]).optional(),
            audience: z.string().trim().min(1).optional(),
            brandTerms: z.array(z.string().trim().min(1)).min(1).optional(),
            topicTaxonomy: taxonomySchema.optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("find-key-moments"),
        maxMoments: z.number().int().min(1).max(25).optional(),
        targetDurationMs: z
          .object({
            min: z.number().int().positive(),
            max: z.number().int().positive(),
          })
          .strict()
          .optional(),
        outputSteering: z
          .object({
            selectionStrategy: z
              .enum([
                "standalone_hooks",
                "educational_takeaways",
                "story_beats",
                "product_moments",
                "speaker_highlights",
              ])
              .optional(),
            titleStyle: z.enum(["descriptive", "punchy", "educational", "social"]).optional(),
            audience: z.string().trim().min(1).optional(),
            brandTerms: z.array(z.string().trim().min(1)).min(1).optional(),
            rubricPriorities: z
              .array(
                z.enum([
                  "clarity_in_isolation",
                  "emotional_intensity",
                  "novelty",
                  "soundbite_quality",
                ]),
              )
              .min(1)
              .max(4)
              .optional(),
            topicTaxonomy: taxonomySchema.optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("find-best-thumbnails"),
        maxThumbnails: z.number().int().min(1).max(5).optional(),
        outputSteering: z
          .object({
            selectionStrategy: z
              .enum([
                "face_or_action",
                "clean_composition",
                "high_contrast",
                "brand_safe",
                "campaign_thumbnail",
              ])
              .optional(),
            lookingFor: z.string().trim().min(1).optional(),
            audience: z.string().trim().min(1).optional(),
            campaignStyle: z.string().trim().min(1).optional(),
            scoringPriorities: z
              .array(
                z.enum(["focus", "face_or_action", "composition", "contrast_color", "brand_fit"]),
              )
              .min(1)
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("moderate"),
        languageCode: languageCodeSchema.optional(),
        thresholds: z
          .object({
            sexual: z.number().finite().min(0).max(1).optional(),
            violence: z.number().finite().min(0).max(1).optional(),
          })
          .strict()
          .optional(),
        samplingInterval: z.number().int().min(5).optional(),
        maxSamples: z.number().int().positive().optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("translate-captions"),
        trackId: trackIdSchema,
        toLanguageCode: languageCodeSchema,
        uploadToMux: z.boolean().default(true),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("generate-premium-captions"),
        languageCode: languageCodeSchema.optional(),
        replaceExisting: z.boolean().default(false),
        trackName: z.string().trim().min(1).max(255).optional(),
        includeSpeakers: z.boolean().default(true),
        includeWords: z.boolean().default(false),
        uploadToMux: z.boolean().default(true),
        phrases: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
      })
      .strict(),
    targetSchema
      .extend({
        workflow: z.literal("edit-captions"),
        trackId: trackIdSchema,
        replacements: z
          .array(
            z
              .object({
                find: z.string().min(1),
                replace: z.string(),
                caseSensitive: z.boolean().optional(),
              })
              .strict(),
          )
          .min(1)
          .optional(),
        autoCensorProfanity: z
          .object({
            detectionMethod: z.literal("llm").optional(),
            mode: z.enum(["blank", "remove", "mask"]).optional(),
            alwaysCensor: z.array(z.string().trim().min(1)).optional(),
            neverCensor: z.array(z.string().trim().min(1)).optional(),
          })
          .strict()
          .optional(),
        uploadToMux: z.boolean().default(true),
        deleteOriginalTrack: z.boolean().default(false),
        trackNameSuffix: z.string().trim().min(1).max(255).optional(),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (
      value.workflow === "find-key-moments" &&
      value.targetDurationMs !== undefined &&
      value.targetDurationMs.min > value.targetDurationMs.max
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDurationMs", "min"],
        message: "targetDurationMs.min must be less than or equal to targetDurationMs.max",
      });
    }

    if (
      value.workflow === "generate-premium-captions" &&
      value.replaceExisting &&
      value.languageCode === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["languageCode"],
        message: "languageCode is required when replaceExisting is true",
      });
    }

    if (
      value.workflow === "generate-premium-captions" &&
      !value.uploadToMux &&
      value.replaceExisting
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["replaceExisting"],
        message: "replaceExisting cannot be true when uploadToMux is false",
      });
    }

    if (
      value.workflow === "edit-captions" &&
      value.replacements === undefined &&
      value.autoCensorProfanity === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["replacements"],
        message: "Provide replacements or autoCensorProfanity",
      });
    }
  });

// Tool providers do not consistently accept a discriminated union at the JSON
// Schema root. Advertise one portable object containing the union's possible
// fields, then parse with runWorkflowInputSchema inside execute so the precise
// per-workflow requirements and refinements remain authoritative.
export const runWorkflowToolInputSchema = z
  .object({
    assetId: assetIdSchema,
    workflow: workflowSchema,
    passthrough: passthroughSchema,
    tone: z.enum(["neutral", "playful", "professional"]).optional(),
    titleLength: z.number().int().positive().optional(),
    descriptionLength: z.number().int().positive().optional(),
    tagCount: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe("Maximum number of tags to return. Defaults to 10 when omitted."),
    languageCode: languageCodeSchema.optional(),
    outputLanguageCode: languageCodeSchema.optional(),
    outputSteering: z
      .object({})
      .loose()
      .optional()
      .describe(
        "Workflow-specific output steering. Load the Mux Video workflows skill before configuring it.",
      ),
    updateAssetMeta: z.boolean().optional(),
    questions: z.array(askQuestionSchema).min(1).optional(),
    maxFreeFormAnswerLength: z.number().int().positive().optional(),
    minScenes: z.number().int().positive().optional(),
    minSceneDurationMs: z.number().int().min(1_000).optional(),
    maxMoments: z.number().int().min(1).max(25).optional(),
    targetDurationMs: z
      .object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .strict()
      .optional(),
    maxThumbnails: z.number().int().min(1).max(5).optional(),
    thresholds: z
      .object({
        sexual: z.number().finite().min(0).max(1).optional(),
        violence: z.number().finite().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    samplingInterval: z.number().int().min(5).optional(),
    maxSamples: z.number().int().positive().optional(),
    trackId: trackIdSchema.optional(),
    toLanguageCode: languageCodeSchema.optional(),
    uploadToMux: z.boolean().optional(),
    replaceExisting: z.boolean().optional(),
    trackName: z.string().trim().min(1).max(255).optional(),
    includeSpeakers: z.boolean().optional(),
    includeWords: z.boolean().optional(),
    phrases: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
    replacements: z
      .array(
        z
          .object({
            find: z.string().min(1),
            replace: z.string(),
            caseSensitive: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
    autoCensorProfanity: z
      .object({
        detectionMethod: z.literal("llm").optional(),
        mode: z.enum(["blank", "remove", "mask"]).optional(),
        alwaysCensor: z.array(z.string().trim().min(1)).optional(),
        neverCensor: z.array(z.string().trim().min(1)).optional(),
      })
      .strict()
      .optional(),
    deleteOriginalTrack: z.boolean().optional(),
    trackNameSuffix: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export type RunWorkflowInput = z.infer<typeof runWorkflowInputSchema>;

export function parametersForWorkflow(input: RunWorkflowInput): Record<string, unknown> {
  const parameters: Record<string, unknown> = { asset_id: input.assetId };

  switch (input.workflow) {
    case "summarize":
      setIfDefined(parameters, "tone", input.tone);
      setIfDefined(parameters, "title_length", input.titleLength);
      setIfDefined(parameters, "description_length", input.descriptionLength);
      setIfDefined(parameters, "tag_count", input.tagCount);
      setIfDefined(parameters, "language_code", input.languageCode);
      setIfDefined(parameters, "output_language_code", input.outputLanguageCode);
      setIfDefined(parameters, "update_asset_meta", input.updateAssetMeta);
      if (input.outputSteering) {
        parameters.output_steering = compact({
          summary_style: input.outputSteering.summaryStyle,
          audience: input.outputSteering.audience,
          brand_terms: input.outputSteering.brandTerms,
          tag_taxonomy: mapTaxonomy(input.outputSteering.tagTaxonomy),
        });
      }
      break;
    case "ask-questions":
      parameters.questions = input.questions.map((question) =>
        compact({
          question: question.question,
          answer_options: question.answerOptions,
          free_form_reply: question.freeFormReply,
        }),
      );
      setIfDefined(parameters, "language_code", input.languageCode);
      setIfDefined(parameters, "max_free_form_answer_length", input.maxFreeFormAnswerLength);
      break;
    case "generate-chapters":
      setIfDefined(parameters, "language_code", input.languageCode);
      setIfDefined(parameters, "output_language_code", input.outputLanguageCode);
      if (input.outputSteering) {
        parameters.output_steering = compact({
          chapter_style: input.outputSteering.chapterStyle,
          chapter_granularity: input.outputSteering.chapterGranularity,
          audience: input.outputSteering.audience,
          brand_terms: input.outputSteering.brandTerms,
        });
      }
      break;
    case "find-scenes":
      setIfDefined(parameters, "language_code", input.languageCode);
      setIfDefined(parameters, "min_scenes", input.minScenes);
      setIfDefined(parameters, "min_scene_duration_ms", input.minSceneDurationMs);
      if (input.outputSteering) {
        parameters.output_steering = compact({
          segmentation_strategy: input.outputSteering.segmentationStrategy,
          title_style: input.outputSteering.titleStyle,
          narration_detail: input.outputSteering.narrationDetail,
          audience: input.outputSteering.audience,
          brand_terms: input.outputSteering.brandTerms,
          topic_taxonomy: mapTaxonomy(input.outputSteering.topicTaxonomy),
        });
      }
      break;
    case "find-key-moments":
      setIfDefined(parameters, "max_moments", input.maxMoments);
      setIfDefined(parameters, "target_duration_ms", input.targetDurationMs);
      if (input.outputSteering) {
        parameters.output_steering = compact({
          selection_strategy: input.outputSteering.selectionStrategy,
          title_style: input.outputSteering.titleStyle,
          audience: input.outputSteering.audience,
          brand_terms: input.outputSteering.brandTerms,
          rubric_priorities: input.outputSteering.rubricPriorities,
          topic_taxonomy: mapTaxonomy(input.outputSteering.topicTaxonomy),
        });
      }
      break;
    case "find-best-thumbnails":
      setIfDefined(parameters, "max_thumbnails", input.maxThumbnails);
      if (input.outputSteering) {
        parameters.output_steering = compact({
          selection_strategy: input.outputSteering.selectionStrategy,
          looking_for: input.outputSteering.lookingFor,
          audience: input.outputSteering.audience,
          campaign_style: input.outputSteering.campaignStyle,
          scoring_priorities: input.outputSteering.scoringPriorities,
        });
      }
      break;
    case "moderate":
      setIfDefined(parameters, "language_code", input.languageCode);
      setIfDefined(parameters, "thresholds", input.thresholds);
      setIfDefined(parameters, "sampling_interval", input.samplingInterval);
      setIfDefined(parameters, "max_samples", input.maxSamples);
      break;
    case "translate-captions":
      parameters.track_id = input.trackId;
      parameters.to_language_code = input.toLanguageCode;
      parameters.upload_to_mux = input.uploadToMux;
      break;
    case "generate-premium-captions":
      setIfDefined(parameters, "language_code", input.languageCode);
      parameters.replace_existing = input.replaceExisting;
      setIfDefined(parameters, "track_name", input.trackName);
      parameters.include_speakers = input.includeSpeakers;
      parameters.include_words = input.includeWords;
      parameters.upload_to_mux = input.uploadToMux;
      setIfDefined(parameters, "phrases", input.phrases);
      break;
    case "edit-captions":
      parameters.track_id = input.trackId;
      if (input.replacements) {
        parameters.replacements = input.replacements.map((replacement) =>
          compact({
            find: replacement.find,
            replace: replacement.replace,
            case_sensitive: replacement.caseSensitive,
          }),
        );
      }
      if (input.autoCensorProfanity) {
        parameters.auto_censor_profanity = compact({
          detection_method: input.autoCensorProfanity.detectionMethod,
          mode: input.autoCensorProfanity.mode,
          always_censor: input.autoCensorProfanity.alwaysCensor,
          never_censor: input.autoCensorProfanity.neverCensor,
        });
      }
      parameters.upload_to_mux = input.uploadToMux;
      parameters.delete_original_track = input.deleteOriginalTrack;
      setIfDefined(parameters, "track_name_suffix", input.trackNameSuffix);
      break;
  }

  return parameters;
}

function mapTaxonomy(
  value:
    | {
        name?: string;
        values?: Array<{ label: string; description?: string; aliases?: string[] }>;
        allowOther?: boolean;
      }
    | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return compact({
    name: value.name,
    values: value.values?.map((item) => compact(item)),
    allow_other: value.allowOther,
  });
}

function setIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
