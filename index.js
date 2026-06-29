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
    ButtonStyle
} = require("discord.js");

const fs = require("fs");

// =========================
// 🔥 SAFE CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// =========================
// 🔥 SAFE DATABASE
// =========================
const DB = "./data.json";

function load() {
    if (!fs.existsSync(DB)) return {};
    try { return JSON.parse(fs.readFileSync(DB)); }
    catch { return {}; }
}

function save(data) {
    fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

// =========================
// 🔥 CONFIG
// =========================
const SUPPORT_LINK = "discord.gg/pikpa";
const WINNER_LOG = "1506457793132232774";
const DAILY_LOG = "1512778450186932334";

// =========================
// 🔥 SUPPORTER ROLE SYSTEM
// =========================
client.on("presenceUpdate", async (oldP, newP) => {
    try {
        const member = newP?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const status = newP?.activities?.find(a => a.type === 4);
        const text = (status?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
            }
        }
    } catch (e) {
        console.error("presence error", e);
    }
});

// =========================
// 🔥 SLASH COMMANDS (SAFE)
// =========================
const commands = [
    new SlashCommandBuilder()
        .setName("winner")
        .setDescription("Declare winner")
        .addUserOption(o => o.setName("user").setDescription("Winner").setRequired(true))
        .addNumberOption(o => o.setName("amount").setDescription("Prize").setRequired(true))
        .addStringOption(o => o.setName("giveaway").setDescription("Name").setRequired(true)),

    new SlashCommandBuilder()
        .setName("history")
        .setDescription("Check user history")
        .addUserOption(o => o.setName("user").setDescription("User")),

    new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Server stats"),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Create giveaway")
        .addStringOption(o => o.setName("name").setRequired(true))
        .addNumberOption(o => o.setName("prize").setRequired(true))
        .addStringOption(o => o.setName("time").setRequired(true))
];

// =========================
// 🔥 REGISTER COMMANDS (FIXED GUILD MODE)
// =========================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("✅ Slash commands registered (INSTANT MODE)");
    } catch (err) {
        console.error("Command error:", err);
    }
});

// =========================
// 🔥 INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    let data = load();

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
        data[user.id].history.push({
            giveaway,
            amount,
            date: Date.now()
        });

        save(data);

        const embed = new EmbedBuilder()
            .setTitle("🏆 WINNER CONFIRMED")
            .setColor("Gold")
            .setDescription(
                `🎉 Congrats!\n💰 Prize: $${amount}\n🎁 Giveaway: ${giveaway}\n\n🙏 Thank you for supporting!`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Vouch Link")
                .setStyle(ButtonStyle.Link)
                .setURL("https://discord.com/channels/1450787742219767861/1512778450186932334")
        );

        const log = interaction.guild.channels.cache.get(WINNER_LOG);
        if (log) log.send({ embeds: [embed], components: [row] });

        user.send({ embeds: [embed], components: [row] }).catch(() => {});

        return interaction.reply({ content: "✅ Winner logged", ephemeral: true });
    }

    // =========================
    // 📊 HISTORY (FIXED)
    // =========================
    if (interaction.commandName === "history") {

        const user = interaction.options.getUser("user") || interaction.user;
        const info = data[user.id];

        if (!info || !info.history?.length) {
            return interaction.reply({ content: "❌ No history found.", ephemeral: true });
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
                { name: "Total", value: `$${info.prize}`, inline: true }
            );

        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // 📊 STATS
    // =========================
    if (interaction.commandName === "stats") {

        const guild = interaction.guild;

        const supporters = guild.members.cache.filter(m =>
            m.roles.cache.has(process.env.ROLE_ID)
        ).size;

        let winners = Object.keys(data).length;

        let total = 0;
        for (const id in data) total += data[id].prize || 0;

        const embed = new EmbedBuilder()
            .setTitle("📊 SERVER STATS")
            .setColor("#00ffff")
            .addFields(
                { name: "Members", value: `${guild.memberCount}`, inline: true },
                { name: "Supporters", value: `${supporters}`, inline: true },
                { name: "Winners", value: `${winners}`, inline: true },
                { name: "Payout", value: `$${total}` }
            );

        return interaction.reply({ embeds: [embed] });
    }

    // =========================
    // 🎁 GIVEAWAY
    // =========================
    if (interaction.commandName === "giveaway") {

        const name = interaction.options.getString("name");
        const prize = interaction.options.getNumber("prize");
        const time = interaction.options.getString("time");

        const embed = new EmbedBuilder()
            .setTitle("🎉 GIVEAWAY LIVE")
            .setColor("#ff00ff")
            .setDescription(
                `🎁 ${name}\n💰 $${prize}\n⏰ ${time}`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("join")
                .setLabel("Join Giveaway")
                .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }
});

// =========================
// 🔥 BUTTON SYSTEM
// =========================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "join") {
        return interaction.reply({
            content: "✅ You joined the giveaway!",
            ephemeral: true
        });
    }
});

client.login(process.env.TOKEN);
