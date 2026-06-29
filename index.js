require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DATA_FILE = "./data.json";

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =========================
// 🔥 LOG CHANNELS
// =========================
const WINNER_LOG = "1506457793132232774";
const DAILY_REPORT = "1512778450186932334";

// =========================
// 🔥 SUPPORTER SYSTEM
// =========================
const SUPPORT_LINK = "discord.gg/pikpa";

client.on("presenceUpdate", async (oldPresence, newPresence) => {
    try {
        const member = newPresence?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const status = newPresence?.activities?.find(a => a.type === 4);
        const text = (status?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
            }
        }

    } catch (err) {
        console.error(err);
    }
});


// =========================
// 🔥 SLASH COMMANDS
// =========================
const commands = [
    new SlashCommandBuilder().setName("winner")
        .setDescription("Declare giveaway winner")
        .addUserOption(o => o.setName("user").setDescription("Winner").setRequired(true))
        .addNumberOption(o => o.setName("amount").setDescription("Prize").setRequired(true))
        .addStringOption(o => o.setName("giveaway").setDescription("Giveaway name").setRequired(true)),

    new SlashCommandBuilder().setName("history")
        .setDescription("Check user history")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

    new SlashCommandBuilder().setName("stats")
        .setDescription("Server stats"),

    new SlashCommandBuilder().setName("vanitycheck")
        .setDescription("Scan supporter system"),

    new SlashCommandBuilder().setName("giveaway")
        .setDescription("Create giveaway")
        .addStringOption(o => o.setName("name").setRequired(true))
        .addNumberOption(o => o.setName("prize").setRequired(true))
        .addStringOption(o => o.setName("time").setRequired(true))
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    console.log("Bot online");

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("Slash commands loaded");
});


// =========================
// 🔥 INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {

    if (!interaction.isChatInputCommand()) return;

    let data = loadData();

    // =========================
    // 🏆 WINNER
    // =========================
    if (interaction.commandName === "winner") {

        const user = interaction.options.getUser("user");
        const amount = interaction.options.getNumber("amount");
        const giveaway = interaction.options.getString("giveaway");

        if (!data[user.id]) {
            data[user.id] = { wins: 0, prize: 0, history: [] };
        }

        data[user.id].wins++;
        data[user.id].prize += amount;
        data[user.id].history.push({ giveaway, amount, date: new Date() });

        saveData(data);

        const embed = new EmbedBuilder()
            .setTitle("🏆 WINNER CONFIRMED")
            .setColor("Gold")
            .setDescription(
                `🎉 You won **$${amount}**\n🎁 Giveaway: **${giveaway}**\n\n🙏 Thanks for supporting community`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Vouch Here")
                .setStyle(ButtonStyle.Link)
                .setURL("https://discord.com/channels/1450787742219767861/1512778450186932334")
        );

        const log = interaction.guild.channels.cache.get(WINNER_LOG);
        if (log) log.send({ embeds: [embed], components: [row] });

        user.send({ embeds: [embed], components: [row] }).catch(() => {});

        interaction.reply("✅ Winner logged");
    }


    // =========================
    // 📊 HISTORY (FIXED)
    // =========================
    if (interaction.commandName === "history") {

        const user = interaction.options.getUser("user") || interaction.user;

        let info = data[user.id];

        if (!info || !info.history.length) {
            return interaction.reply("❌ No history found.");
        }

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} History`)
            .setColor("Blue")
            .setDescription(
                info.history.map(h =>
                    `🎁 ${h.giveaway} | 💰 $${h.amount}`
                ).join("\n")
            )
            .addFields(
                { name: "Wins", value: `${info.wins}`, inline: true },
                { name: "Total Prize", value: `$${info.prize}`, inline: true }
            );

        interaction.reply({ embeds: [embed] });
    }


    // =========================
    // 📈 STATS
    // =========================
    if (interaction.commandName === "stats") {

        const guild = interaction.guild;

        let supporters = guild.members.cache.filter(m =>
            m.roles.cache.has(process.env.ROLE_ID)
        ).size;

        let winners = Object.keys(data).length;

        let payout = 0;
        for (let id in data) payout += data[id].prize;

        const embed = new EmbedBuilder()
            .setTitle("📊 SERVER STATS")
            .setColor("#00ffff")
            .addFields(
                { name: "Members", value: `${guild.memberCount}`, inline: true },
                { name: "Supporters", value: `${supporters}`, inline: true },
                { name: "Winners", value: `${winners}`, inline: true },
                { name: "Total Payout", value: `$${payout}` }
            );

        interaction.reply({ embeds: [embed] });
    }


    // =========================
    // 🎁 GIVEAWAY (BUTTON SYSTEM)
    // =========================
    if (interaction.commandName === "giveaway") {

        const name = interaction.options.getString("name");
        const prize = interaction.options.getNumber("prize");
        const time = interaction.options.getString("time");

        const embed = new EmbedBuilder()
            .setTitle("🎉 GIVEAWAY LIVE")
            .setColor("#ff00ff")
            .setDescription(
                `🎁 **${name}**\n💰 Prize: $${prize}\n⏰ Time: ${time}`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("join_giveaway")
                .setLabel("🎉 Join Giveaway")
                .setStyle(ButtonStyle.Success)
        );

        interaction.reply({ embeds: [embed], components: [row] });
    }
});


// =========================
// 🔥 BUTTON SYSTEM
// =========================
client.on("interactionCreate", async (interaction) => {

    if (!interaction.isButton()) return;

    if (interaction.customId === "join_giveaway") {
        interaction.reply({ content: "✅ You joined the giveaway!", ephemeral: true });
    }
});


// =========================
// 📅 DAILY REPORT (24H)
// =========================
setInterval(() => {

    const guild = client.guilds.cache.first();
    if (!guild) return;

    const channel = guild.channels.cache.get(DAILY_REPORT);
    if (!channel) return;

    channel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle("📅 DAILY REPORT")
                .setColor("Green")
                .setDescription("Auto system report every 24h")
        ]
    });

}, 86400000);


client.login(process.env.TOKEN);
