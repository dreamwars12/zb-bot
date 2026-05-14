const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
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
      .setDescription("Choisis une catégorie pour ouvrir un ticket")
      .setColor("Blue");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("📌 Choisis une catégorie")
      .addOptions([
        {
          label: "Support",
          description: "Aide générale",
          value: "support"
        },
        {
          label: "Bug / Problème",
          description: "Signaler un bug",
          value: "bug"
        },
        {
          label: "Recrutement",
          description: "Rejoindre le staff",
          value: "recrutement"
        },
        {
          label: "Autre",
          description: "Autres demandes",
          value: "autre"
        }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

/* =========================
   🎯 INTERACTIONS
========================= */
client.on("interactionCreate", async (interaction) => {

  /* 🎫 MENU TICKET */
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
    const type = interaction.values[0];

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

    // créer ticket
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
      content: `🎫 Ticket **${type}** de <@${interaction.user.id}>`,
      components: [row]
    });

    return interaction.reply({
      content: `✅ Ticket créé : ${channel}`,
      ephemeral: true
    });
  }

  /* 🔒 CLOSE TICKET */
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    await interaction.reply("🔒 Fermeture du ticket...");

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 2000);
  }
});

client.login(process.env.TOKEN);
