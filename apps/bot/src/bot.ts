import "dotenv/config";

import { createServer } from "node:http";

import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { parseBotEnv } from "@wickedhostbotai/shared";

const env = parseBotEnv(process.env);

const state = {
  discordConnected: false,
  commandsRegistered: false,
  mode: "booting",
  lastError: null as string | null,
  lastInteraction: null as string | null,
};

const askCommand = new SlashCommandBuilder()
  .setName("ask")
  .setDescription("Ask the WickedHost knowledge base a question.")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("What should the bot answer?")
      .setRequired(true),
  );

const sourcesCommand = new SlashCommandBuilder()
  .setName("sources")
  .setDescription("Inspect the top retrieved knowledge chunks for a question.")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("Question to preview sources for")
      .setRequired(true),
  );

const kbCommand = new SlashCommandBuilder()
  .setName("kb")
  .setDescription("Knowledge base helpers.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List configured knowledge bases."),
  );

const healthServer = createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify({
      ok: true,
      service: "bot",
      ...state,
    }),
  );
});

healthServer.listen(env.BOT_HEALTH_PORT, "0.0.0.0", () => {
  console.log(`Bot health server listening on ${env.BOT_HEALTH_PORT}.`);
});

type SourceHit = {
  chunkId: string;
  knowledgeBaseId: string;
  entryId: string;
  score: number;
  content: string;
};

type QueryPayload = {
  answer: string;
  citations: string[];
  confidence: number;
  needsHuman: boolean;
  hits: SourceHit[];
};

type PreviewPayload = {
  prompt: string;
  answer: {
    answer: string;
    citations: string[];
    confidence: number;
    needsHuman: boolean;
  };
  hits: SourceHit[];
};

type KnowledgeBaseSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type DiscordSettings = {
  clientId?: string;
  guildId?: string;
  mentionOnly: boolean;
  allowedChannelIds: string[];
  handoffMessage: string;
  hasStoredBotToken?: boolean;
};

type DiscordRuntimeSettings = DiscordSettings & {
  botToken?: string;
};

let cachedDiscordSettings: {
  value: DiscordSettings;
  expiresAt: number;
} | null = null;

async function main(): Promise<void> {
  const runtime = await getDiscordRuntime();

  if (!runtime.botToken) {
    state.mode = "health-only";
    console.log(
      "Discord bot token is not configured in env or encrypted storage. Running in health-only mode.",
    );
    return;
  }

  state.mode = "discord";

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async (readyClient) => {
    state.discordConnected = true;
    console.log(`Discord bot connected as ${readyClient.user.tag}.`);

    if (!runtime.clientId) {
      console.log("Discord client id is not configured. Slash command registration skipped.");
      return;
    }

    try {
      await registerCommands(runtime);
      state.commandsRegistered = true;
    } catch (error) {
      state.lastError =
        error instanceof Error ? error.message : "Command registration failed";
      console.error("Failed to register slash commands.", error);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const settings = await getDiscordSettings(runtime);

    if (!isAllowedChannel(settings, interaction.channelId)) {
      await interaction.reply({
        content: "This bot is not enabled in this channel yet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    switch (interaction.commandName) {
      case "ask":
        await handleAskCommand(interaction, settings);
        return;
      case "sources":
        await handleSourcesCommand(interaction);
        return;
      case "kb":
        await handleKnowledgeBaseCommand(interaction);
        return;
      default:
        return;
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !client.user) {
      return;
    }

    const settings = await getDiscordSettings(runtime);

    if (!isAllowedChannel(settings, message.channelId)) {
      return;
    }

    const mentioned = message.mentions.users.has(client.user.id);
    const freeformEligible =
      settings.mentionOnly === false && looksLikeQuestion(message.content);

    if (!mentioned && !freeformEligible) {
      return;
    }

    const question = mentioned
      ? stripBotMention(message.content, client.user.id)
      : message.content.trim();

    if (!question) {
      return;
    }

    try {
      await message.channel.sendTyping();
      const payload = await queryApi({
        question,
        guildId: message.guildId ?? undefined,
        channelId: message.channelId,
        userId: message.author.id,
      });

      state.lastInteraction = `mention:${message.id}`;

      await message.reply({
        embeds: [buildAnswerEmbed(question, payload, settings.handoffMessage)],
      });
    } catch (error) {
      state.lastError =
        error instanceof Error ? error.message : "Mention query failed";
      await message.reply(
        "I could not answer that yet. Check the API or worker health endpoints.",
      );
    }
  });

  client.on("error", (error) => {
    state.lastError = error.message;
    console.error("Discord client error.", error);
  });

  await client.login(runtime.botToken);

  const shutdown = async () => {
    state.discordConnected = false;
    await client.destroy();
    healthServer.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

async function handleAskCommand(
  interaction: ChatInputCommandInteraction,
  settings: DiscordSettings,
): Promise<void> {
  await interaction.deferReply();

  try {
    const question = interaction.options.getString("question", true);
    const payload = await queryApi({
      question,
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    });

    state.lastInteraction = `ask:${interaction.id}`;

    await interaction.editReply({
      embeds: [buildAnswerEmbed(question, payload, settings.handoffMessage)],
    });
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Query failed";
    await interaction.editReply(
      "The API could not answer this request yet. Check the API and worker health endpoints.",
    );
  }
}

async function handleSourcesCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const question = interaction.options.getString("question", true);
    const payload = await previewApi({
      question,
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    });

    state.lastInteraction = `sources:${interaction.id}`;

    await interaction.editReply({
      embeds: [buildSourcesEmbed(question, payload)],
    });
  } catch (error) {
    state.lastError =
      error instanceof Error ? error.message : "Source preview failed";
    await interaction.editReply(
      "Source preview is unavailable right now. Check the API health endpoint.",
    );
  }
}

async function handleKnowledgeBaseCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    if (interaction.options.getSubcommand() !== "list") {
      await interaction.editReply("Unsupported knowledge base command.");
      return;
    }

    const knowledgeBases = await listKnowledgeBasesApi();
    state.lastInteraction = `kb-list:${interaction.id}`;

    await interaction.editReply({
      embeds: [buildKnowledgeBaseEmbed(knowledgeBases)],
    });
  } catch (error) {
    state.lastError =
      error instanceof Error ? error.message : "Knowledge base lookup failed";
    await interaction.editReply("Knowledge bases could not be loaded.");
  }
}

async function registerCommands(runtime: DiscordRuntimeSettings): Promise<void> {
  const body = [
    askCommand.toJSON(),
    sourcesCommand.toJSON(),
    kbCommand.toJSON(),
  ];
  const rest = new REST({ version: "10" }).setToken(runtime.botToken!);

  if (runtime.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(runtime.clientId!, runtime.guildId),
      { body },
    );
    return;
  }

  await rest.put(Routes.applicationCommands(runtime.clientId!), {
    body,
  });
}

async function getDiscordRuntime(): Promise<DiscordRuntimeSettings> {
  if (env.DISCORD_BOT_TOKEN) {
    return createDefaultRuntimeSettings(env.DISCORD_BOT_TOKEN);
  }

  if (!env.ADMIN_TOKEN) {
    return createDefaultRuntimeSettings();
  }

  try {
    return await fetchJson<DiscordRuntimeSettings>("/v1/admin/runtime/discord", {
      method: "GET",
    });
  } catch {
    return createDefaultRuntimeSettings();
  }
}

async function queryApi(input: {
  question: string;
  guildId: string | undefined;
  channelId: string | undefined;
  userId: string | undefined;
}): Promise<QueryPayload> {
  const requestBody: Record<string, unknown> = {
    workspaceId: env.WORKSPACE_ID,
    knowledgeBaseIds: [],
    question: input.question,
  };

  if (input.guildId) {
    requestBody.guildId = input.guildId;
  }

  if (input.channelId) {
    requestBody.channelId = input.channelId;
  }

  if (input.userId) {
    requestBody.userId = input.userId;
  }

  return fetchJson<QueryPayload>("/v1/query", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

async function previewApi(input: {
  question: string;
  guildId: string | undefined;
  channelId: string | undefined;
  userId: string | undefined;
}): Promise<PreviewPayload> {
  const requestBody: Record<string, unknown> = {
    workspaceId: env.WORKSPACE_ID,
    knowledgeBaseIds: [],
    question: input.question,
  };

  if (input.guildId) {
    requestBody.guildId = input.guildId;
  }

  if (input.channelId) {
    requestBody.channelId = input.channelId;
  }

  if (input.userId) {
    requestBody.userId = input.userId;
  }

  return fetchJson<PreviewPayload>("/v1/query/preview", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

async function listKnowledgeBasesApi(): Promise<KnowledgeBaseSummary[]> {
  return fetchJson<KnowledgeBaseSummary[]>("/v1/admin/kbs", {
    method: "GET",
  });
}

async function getDiscordSettings(
  runtime: DiscordRuntimeSettings,
): Promise<DiscordSettings> {
  const now = Date.now();

  if (cachedDiscordSettings && cachedDiscordSettings.expiresAt > now) {
    return cachedDiscordSettings.value;
  }

  try {
    const value = await fetchJson<DiscordSettings>("/v1/admin/settings/discord", {
      method: "GET",
    });

    cachedDiscordSettings = {
      value,
      expiresAt: now + 30_000,
    };

    return value;
  } catch {
    const fallback = createDefaultDiscordSettings(runtime);

    cachedDiscordSettings = {
      value: fallback,
      expiresAt: now + 5_000,
    };

    return fallback;
  }
}

function createDefaultRuntimeSettings(
  botToken?: string,
): DiscordRuntimeSettings {
  const settings: DiscordRuntimeSettings = {
    mentionOnly: true,
    allowedChannelIds: [],
    handoffMessage: "A human teammate will follow up soon.",
  };

  if (env.DISCORD_CLIENT_ID) {
    settings.clientId = env.DISCORD_CLIENT_ID;
  }

  if (env.DISCORD_GUILD_ID) {
    settings.guildId = env.DISCORD_GUILD_ID;
  }

  if (botToken) {
    settings.botToken = botToken;
  }

  return settings;
}

function createDefaultDiscordSettings(
  runtime: Pick<DiscordRuntimeSettings, "clientId" | "guildId">,
): DiscordSettings {
  const settings: DiscordSettings = {
    mentionOnly: true,
    allowedChannelIds: [],
    handoffMessage: "A human teammate will follow up soon.",
  };

  if (runtime.clientId) {
    settings.clientId = runtime.clientId;
  }

  if (runtime.guildId) {
    settings.guildId = runtime.guildId;
  }

  return settings;
}

async function fetchJson<T>(
  path: string,
  init: {
    method: string;
    body?: string;
  },
): Promise<T> {
  const response = await fetch(`${env.PUBLIC_API_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      ...(env.ADMIN_TOKEN ? { "x-admin-token": env.ADMIN_TOKEN } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    ...(init.body ? { body: init.body } : {}),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildAnswerEmbed(
  question: string,
  payload: QueryPayload,
  handoffMessage: string,
) {
  const citations =
    payload.citations.length === 0
      ? "No citations"
      : payload.citations.map((citation) => `- \`${citation}\``).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("WickedHost answer")
    .setDescription(trimBlock(payload.answer, 4000))
    .setColor(payload.needsHuman ? 0xb45309 : 0x1d4ed8)
    .addFields(
      {
        name: "Question",
        value: trimBlock(question, 1024),
      },
      {
        name: "Confidence",
        value: payload.confidence.toFixed(2),
        inline: true,
      },
      {
        name: "Needs human",
        value: payload.needsHuman ? "yes" : "no",
        inline: true,
      },
      {
        name: "Citations",
        value: trimBlock(citations, 1024),
      },
    )
    .setFooter({
      text: `Retrieved hits: ${payload.hits.length}`,
    });

  if (payload.needsHuman) {
    embed.addFields({
      name: "Handoff",
      value: trimBlock(handoffMessage, 1024),
    });
  }

  return embed;
}

function buildSourcesEmbed(question: string, payload: PreviewPayload) {
  const topHits =
    payload.hits.length === 0
      ? "No indexed chunks were returned."
      : payload.hits
          .slice(0, 5)
          .map(
            (hit, index) =>
              `${index + 1}. \`${hit.chunkId}\` score=${hit.score.toFixed(3)}\n${trimBlock(hit.content, 180)}`,
          )
          .join("\n\n");

  return new EmbedBuilder()
    .setTitle("Source preview")
    .setDescription(trimBlock(question, 4096))
    .setColor(0x7c3aed)
    .addFields(
      {
        name: "Preview answer",
        value: trimBlock(payload.answer.answer, 1024),
      },
      {
        name: "Top hits",
        value: trimBlock(topHits, 1024),
      },
      {
        name: "Prompt excerpt",
        value: trimBlock(payload.prompt, 1024),
      },
    );
}

function buildKnowledgeBaseEmbed(knowledgeBases: KnowledgeBaseSummary[]) {
  const lines =
    knowledgeBases.length === 0
      ? "No knowledge bases have been created yet."
      : knowledgeBases
          .map(
            (knowledgeBase) =>
              `- **${knowledgeBase.name}** (\`${knowledgeBase.slug}\`) - ${knowledgeBase.id}`,
          )
          .join("\n");

  return new EmbedBuilder()
    .setTitle("Knowledge bases")
    .setDescription(trimBlock(lines, 4096))
    .setColor(0x0f766e);
}

function stripBotMention(content: string, userId: string): string {
  return content
    .replaceAll(`<@${userId}>`, "")
    .replaceAll(`<@!${userId}>`, "")
    .trim();
}

function looksLikeQuestion(content: string): boolean {
  const normalized = content.trim();
  return normalized.length >= 8 && normalized.endsWith("?");
}

function isAllowedChannel(settings: DiscordSettings, channelId: string): boolean {
  return (
    settings.allowedChannelIds.length === 0 ||
    settings.allowedChannelIds.includes(channelId)
  );
}

function trimBlock(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1))}...`;
}

main().catch((error) => {
  state.lastError = error instanceof Error ? error.message : "Bot startup failed";
  state.mode = "health-only";
  console.error("Bot startup failed.", error);
});
