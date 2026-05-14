const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================
   ⚙️ CONFIG ROLES
========================= */
const CATEGORY_NAME = "🎫・TICKETS";

// 🔥 RÔLES À PING
const ROLE_SUPPORT = "🔍 Support";
const ROLE_STAFF = "🧪 Staff Test";

/* =========================
   🤖 READY
========================= */
client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
});

/* =========================
   🎫 PANEL TICKETS
========================= */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!ticket") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Support Center")
      .setDescription(
        "Bienvenue dans le support.\n\n" +
        "📌 Choisis une catégorie ci-dessous pour ouvrir un ticket\n\n" +
        "🔍 Support → Aide générale\n" +
        "🐛 Bug → Problème technique\n" +
        "📩 Autre → Divers"
      )
      .setColor("#2b2d31")
      .setFooter({ text: "Système de support automatisé" });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("📌 Choisis une catégorie de ticket")
      .addOptions([
        {
          label: "🔍 Support",
          description: "Aide générale du serveur",
          value: "support"
        },
        {
          label: "🐛 Bug / Problème",
          description: "Signaler un bug",
          value: "bug"
        },
        {
          label: "📩 Autre",
          description: "Autres demandes",
          value: "autre"
        }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

/* =========================
   🎯 INTERACTIONS
========================= */
client.on("interactionCreate", async (interaction) => {

  /* =========================
     🎫 CREATE TICKET
  ========================= */
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
    const type = interaction.values[0];
    const guild = interaction.guild;

    // 🔥 trouver/créer catégorie
    let category = guild.channels.cache.find(
      c => c.name === CATEGORY_NAME && c.type === ChannelType.GuildCategory
    );

    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory
      });
    }

    // 🎯 PING SELON CATÉGORIE
    let pingRole = "";

    if (type === "support") pingRole = ROLE_SUPPORT;
    if (type === "bug") pingRole = ROLE_STAFF;
    if (type === "autre") pingRole = ROLE_SUPPORT;

    // 🎫 création salon
    const channel = await guild.channels.create({
      name: `ticket-${type}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });

    // 🔒 bouton fermer
    const closeBtn = new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);

    // 🎨 EMBED ULTRA PROPRE
    const embed = new EmbedBuilder()
      .setTitle("🎫 Nouveau Ticket")
      .setDescription(
        `👤 Utilisateur : <@${interaction.user.id}>\n` +
        `📌 Type : **${type.toUpperCase()}**\n\n` +
        `👮 Support assigné : ${pingRole ? `<@&${pingRole}>` : "Aucun"}`
      )
      .setColor("#00a8ff")
      .setFooter({ text: "Système de support automatique" });

    await channel.send({
      content: pingRole ? `<@&${pingRole}>` : "",
      embeds: [embed],
      components: [row]
    });

    return interaction.reply({
      content: `✅ Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  /* =========================
     🔒 CLOSE TICKET
  ========================= */
  if (interaction.isButton() && interaction.customId === "close_ticket") {
    await interaction.reply("🔒 Fermeture du ticket...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }
});

client.login(process.env.TOKEN);
