import OpenAI from "openai";

import {
  type SearchHit,
  type StructuredAnswer,
  type TokenUsageSnapshot,
  structuredAnswerSchema,
} from "@mimir/shared";

export interface ProviderHealth {
  ok: boolean;
  detail?: string;
}

export interface AnswerRequest {
  question: string;
  context: SearchHit[];
  answerModel?: string | undefined;
  fallbackModel?: string | undefined;
}

export interface AnswerResult extends StructuredAnswer {
  usage?: TokenUsageSnapshot;
  answerModel?: string;
}

export interface AnswerProvider {
  health(): Promise<ProviderHealth>;
  answer(input: AnswerRequest): Promise<AnswerResult>;
}

export interface EmbeddingProvider {
  health(): Promise<ProviderHealth>;
  embed(
    texts: string[],
    options?: { model?: string | undefined },
  ): Promise<number[][]>;
  dimensions(): number;
}

export interface OpenAiProviderOptions {
  apiKey?: string | undefined;
  apiKeyResolver?: (() => Promise<string | undefined>) | undefined;
  answerModel: string;
  fallbackModel?: string | undefined;
  embeddingModel: string;
  storeResponses: boolean;
  embeddingDimensions?: number | undefined;
}

const ANSWER_JSON_SCHEMA = {
  name: "structured_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      citations: {
        type: "array",
        items: { type: "string" },
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      needsHuman: { type: "boolean" },
    },
    required: ["answer", "citations", "confidence", "needsHuman"],
  },
} as const;

export class OpenAiAnswerProvider implements AnswerProvider {
  private readonly staticApiKey: string | undefined;

  private readonly apiKeyResolver:
    | (() => Promise<string | undefined>)
    | undefined;

  private readonly answerModel: string;

  private readonly fallbackModel: string | undefined;

  private readonly storeResponses: boolean;

  public constructor(options: OpenAiProviderOptions) {
    this.answerModel = options.answerModel;
    this.fallbackModel = options.fallbackModel;
    this.storeResponses = options.storeResponses;
    this.staticApiKey = options.apiKey;
    this.apiKeyResolver = options.apiKeyResolver;
  }

  public async health(): Promise<ProviderHealth> {
    const apiKey = await this.resolveApiKey();

    if (!apiKey) {
      return {
        ok: true,
        detail: "OPENAI_API_KEY not set. Structured mock answers are enabled.",
      };
    }

    return { ok: true };
  }

  public async answer(input: AnswerRequest): Promise<AnswerResult> {
    const primaryModel = input.answerModel ?? this.answerModel;
    const fallbackModel = input.fallbackModel ?? this.fallbackModel;
    const client = await this.getClient();

    if (!client) {
      return createMockAnswer(input);
    }

    try {
      return await this.runModel(client, primaryModel, input);
    } catch (primaryError) {
      if (fallbackModel && fallbackModel !== primaryModel) {
        return this.runModel(client, fallbackModel, input);
      }

      throw primaryError;
    }
  }

  private async runModel(
    client: OpenAI,
    model: string,
    input: AnswerRequest,
  ): Promise<AnswerResult> {
    const response = (await client.responses.create({
      model,
      store: this.storeResponses,
      instructions:
        "Answer using only the retrieved knowledge. Return valid JSON that matches the schema exactly. If evidence is weak, set needsHuman to true.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildAnswerPrompt(input),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...ANSWER_JSON_SCHEMA,
        },
      },
    })) as {
      output_text?: string;
      model?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
      output?: Array<{
        content?: Array<{ text?: string }>;
      }>;
    };

    const rawText =
      response.output_text ??
      response.output?.[0]?.content?.[0]?.text ??
      JSON.stringify(createMockAnswer(input));

    const parsed = structuredAnswerSchema.parse(JSON.parse(rawText));

    const usage =
      typeof response.usage?.input_tokens === "number" &&
      typeof response.usage?.output_tokens === "number" &&
      typeof response.usage?.total_tokens === "number"
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined;

    return {
      ...parsed,
      answerModel: response.model ?? model,
      ...(usage ? { usage } : {}),
    };
  }

  private async getClient(): Promise<OpenAI | undefined> {
    const apiKey = await this.resolveApiKey();
    return apiKey ? new OpenAI({ apiKey }) : undefined;
  }

  private async resolveApiKey(): Promise<string | undefined> {
    if (this.staticApiKey) {
      return this.staticApiKey;
    }

    if (!this.apiKeyResolver) {
      return undefined;
    }

    return this.apiKeyResolver();
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly staticApiKey: string | undefined;

  private readonly apiKeyResolver:
    | (() => Promise<string | undefined>)
    | undefined;

  private readonly embeddingModel: string;

  private readonly embeddingSize: number;

  public constructor(options: OpenAiProviderOptions) {
    this.embeddingModel = options.embeddingModel;
    this.embeddingSize = options.embeddingDimensions ?? 1536;
    this.staticApiKey = options.apiKey;
    this.apiKeyResolver = options.apiKeyResolver;
  }

  public async health(): Promise<ProviderHealth> {
    const apiKey = await this.resolveApiKey();

    if (!apiKey) {
      return {
        ok: true,
        detail: "OPENAI_API_KEY not set. Deterministic local embeddings are enabled.",
      };
    }

    return { ok: true };
  }

  public dimensions(): number {
    return this.embeddingSize;
  }

  public async embed(
    texts: string[],
    options?: { model?: string | undefined },
  ): Promise<number[][]> {
    const model = options?.model ?? this.embeddingModel;
    const client = await this.getClient();

    if (!client) {
      return texts.map((text) => createDeterministicEmbedding(text, this.embeddingSize));
    }

    const response = (await client.embeddings.create({
      model,
      input: texts,
    })) as {
      data: Array<{ embedding: number[] }>;
    };

    return response.data.map((item) => item.embedding);
  }

  private async getClient(): Promise<OpenAI | undefined> {
    const apiKey = await this.resolveApiKey();
    return apiKey ? new OpenAI({ apiKey }) : undefined;
  }

  private async resolveApiKey(): Promise<string | undefined> {
    if (this.staticApiKey) {
      return this.staticApiKey;
    }

    if (!this.apiKeyResolver) {
      return undefined;
    }

    return this.apiKeyResolver();
  }
}

export function buildAnswerPrompt(input: AnswerRequest): string {
  const contextBlock =
    input.context.length === 0
      ? "No indexed context was retrieved."
      : input.context
          .map(
            (hit, index) =>
              `[#${index + 1}] chunk=${hit.chunkId} kb=${hit.knowledgeBaseId} entry=${hit.entryId}\n${hit.content}`,
          )
          .join("\n\n");

  return [
    "Question:",
    input.question,
    "",
    "Retrieved context:",
    contextBlock,
    "",
    "Return concise support-ready JSON with citations referencing chunk ids.",
  ].join("\n");
}

function createMockAnswer(input: AnswerRequest): StructuredAnswer {
  if (input.context.length === 0) {
    return {
      answer:
        "No indexed knowledge was found for this question yet. Add or reindex knowledge before answering automatically.",
      citations: [],
      confidence: 0.18,
      needsHuman: true,
    };
  }

  const citations = input.context.slice(0, 3).map((hit) => hit.chunkId);
  const excerpt = input.context
    .slice(0, 2)
    .map((hit) => hit.content.trim())
    .join(" ");

  return {
    answer: excerpt || "Indexed knowledge was retrieved, but the answer content is still empty.",
    citations,
    confidence: Math.min(0.85, 0.45 + input.context.length * 0.1),
    needsHuman: false,
  };
}

function createDeterministicEmbedding(
  text: string,
  dimensions: number,
): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const normalized = text.trim() || "empty";

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    const slot = (index * 131 + code) % dimensions;
    vector[slot] = (vector[slot] ?? 0) + code / 255;
  }

  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}
