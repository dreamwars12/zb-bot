const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const Parser = require("rss-parser");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();
const CHANNEL_ID = process.env.CHANNEL_ID;

let lastLinks = new Set();

async function checkNBA2KNews() {
  try {
    const feed = await parser.parseURL("https://store.steampowered.com/feeds/news/app/3472040/");

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    for (const item of feed.items.slice(0, 5).reverse()) {
      if (lastLinks.has(item.link)) continue;

      lastLinks.add(item.link);

      const embed = new EmbedBuilder()
        .setTitle("🏀 Nouvelle actu NBA 2K26")
        .setDescription(item.title)
        .setURL(item.link)
        .setColor(0x00ffcc)
        .setFooter({ text: "NBA 2K26 Actualités" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.log("Erreur actu NBA 2K26 :", err.message);
  }
}

client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  checkNBA2KNews();
  setInterval(checkNBA2KNews, 10 * 60 * 1000);
});

client.login(process.env.TOKEN);
