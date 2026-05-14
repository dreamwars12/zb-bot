const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
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

// 🔧 CONFIG
const TICKET_CATEGORY_NAME = "TICKETS";
// (optionnel) mets l’ID du rôle staff ici
const STAFF_ROLE_ID = null;

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
      .setTitle("🎫 Support Tickets")
      .setDescription("Clique sur le bouton ci-dessous pour ouvrir un ticket")
      .setColor("Blue");

    const button = new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Créer un ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

/* =========================
   🎯 INTERACTIONS BOUTONS
========================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  /* 🎫 CREATE TICKET */
  if (interaction.customId === "ticket_create") {
    const guild = interaction.guild;

    // trouver ou créer catégorie
    let category = guild.channels.cache.find(
      c => c.name === TICKET_CATEGORY_NAME && c.type === ChannelType.GuildCategory
    );

    if (!category) {
      category = await guild.channels.create({
        name: TICKET_CATEGORY_NAME,
        type: ChannelType.GuildCategory
      });
    }

    // création salon ticket
    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
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
        },
        ...(STAFF_ROLE_ID
          ? [{
              id: STAFF_ROLE_ID,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }]
          : [])
      ]
    });

    // bouton fermer
    const closeBtn = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeBtn);

    await channel.send({
      content: `🎫 Ticket de <@${interaction.user.id}>`,
      components: [row]
    });

    return interaction.reply({
      content: `✅ Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  /* 🔒 CLOSE TICKET */
  if (interaction.customId === "ticket_close") {
    await interaction.reply("🔒 Fermeture du ticket...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }
});

client.login(process.env.TOKEN);
