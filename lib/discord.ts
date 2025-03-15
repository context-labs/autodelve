import {
  Client,
  GatewayIntentBits,
  Message,
  Partials
} from "discord.js";
import { ask } from "./ask";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

/**
 * Stores a question-answer pair in a JSONL file on disk
 * @param question The user's question
 * @param answer The bot's answer
 */
function storeMessage(question: string, answer: string): void {
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "logs");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, "answers.jsonl");

  // Create a record with timestamp
  const record = {
    timestamp: new Date().toISOString(),
    question,
    answer
  };

  // Append the JSON record as a new line to the file
  appendFileSync(filePath, JSON.stringify(record) + "\n");

  console.log(`Stored Q&A pair in ${filePath}`);
}

/**
 * Connects the Discord bot to the Discord API
 * @returns The Discord client instance
 */
export async function connect(): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on("ready", () => {
    console.log(`Logged in as ${client.user!.tag}!`);
  });

  client.on("debug", console.log);
  client.on("warn", console.log);
  client.on("error", console.error);

  client.on("messageCreate", async (message: Message) => {
    
    // Ignore messages from the bot itself
    if (message.author.id === client.user!.id) return;

    // Only process messages that end with a question mark
    if (!message.content.trim().endsWith("?")) return;

    console.log(
      `Received question: "${message.content}" from ${message.author.tag} in channel ${message.channel.id} (${message.channel.type})`,
    );
    const content = message.content;
    const answer = await ask(content);

    if (answer) {
      storeMessage(content, answer);
      message.reply(answer);
    }
});

  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log("Autodelve is now running...");
  return client;
}

/**
 * Lists all channels the bot has access to (can view and send messages)
 * @param client The Discord client instance
 */
export function listAccessibleChannels(client: Client): void {
  console.log("Channels the bot has access to:");

  client.guilds.cache.forEach(guild => {
    console.log(`\nGuild: ${guild.name} (${guild.id})`);

    // Get the bot's member object in this guild
    const botMember = guild.members.cache.get(client.user!.id);

    guild.channels.cache.forEach(channel => {
      // Only check text-based channels
      if (channel.isTextBased()) {
        const canView = channel.permissionsFor(botMember!)?.has('ViewChannel');
        const canSend = channel.permissionsFor(botMember!)?.has('SendMessages');

        if (canView && canSend) {
          console.log(`  ✅ ${channel.name} (${channel.id}) - Can view and send`);
        } else if (canView) {
          console.log(`  👁️ ${channel.name} (${channel.id}) - Can view only`);
        } else {
          console.log(`  ❌ ${channel.name} (${channel.id}) - No access`);
        }
      }
    });
  });
}

// If this file is run directly, connect the bot
if (require.main === module) {
  connect().catch(console.error);
}
