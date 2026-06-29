require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");

// =========================
// CLIENT
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
    ],
    partials: ["CHANNEL"]
});

// =========================
// CONFIG
// =========================
const SUPPORT_LINK = "discord.gg/pikpa";

const WINNER_LOG = "1506457793132232774";
const VOUCH_CHANNEL = "1512778450186932334";

// =========================
// DATABASE
// =========================
const DB_FILE = "./data.json";

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return {};
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// =========================
// SUPPORTER ROLE SYSTEM (FIXED)
// =========================
client.on("presenceUpdate", async (_, newP) => {
    try {
        const member = newP?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const custom = newP?.activities?.find(a => a.type === 4);
        const text = (custom?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
                console.log(`+ Role given to ${member.user.tag}`);
            }
        }
    } catch (err) {
        console.error("Support role error:", err);
    }
});

// =========================
// SLASH COMMANDS
// =========================
const commands = [
    {
        name: "winner",
        description: "Declare giveaway winner",
        options: [
            { name: "user", description: "Winner", type: 6, required: true },
            { name: "amount", description: "Prize", type: 10, required: true },
            { name: "giveaway", description: "Giveaway name", type: 3, required: true }
        ]
    },
    {
        name: "stats",
        description: "Server stats"
    }
];

// =========================
// REGISTER COMMANDS
// =========================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("✅ Slash commands registered");
    } catch (err) {
        console.error("Command error:", err);
    }
});

// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    let db = loadDB();

    // =========================
    // 🏆 WINNER SYSTEM (FULL FIXED FLOW)
    // =========================
    if (interaction.commandName === "winner") {
        const user = interaction.options.getUser("user");
        const amount = interaction.options.getNumber("amount");
        const giveaway = interaction.options.getString("giveaway");

        if (!db[user.id]) {
            db[user.id] = { wins: 0, prize: 0, history: [] };
        }

        db[user.id].wins++;
        db[user.id].prize += amount;
        db[user.id].history.push({
            giveaway,
            amount,
            date: Date.now()
        });

        saveDB(db);

        // =========================
        // EMBED (LOG CHANNEL)
        // =========================
        const embed = new EmbedBuilder()
            .setTitle("🏆 Giveaway Winner")
            .setColor("Gold")
            .setDescription(
                `🎁 Giveaway: **${giveaway}**\n💰 Prize: **$${amount}**\n👤 Winner: <@${user.id}>`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Vouch Here")
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${VOUCH_CHANNEL}`)
        );

        // =========================
        // SEND TO LOG CHANNEL
        // =========================
        const logChannel = interaction.guild.channels.cache.get(WINNER_LOG);
        if (logChannel) {
            logChannel.send({ embeds: [embed], components: [row] });
        }

        // =========================
        // DM USER (YOUR CUSTOM MESSAGE)
        // =========================
        const dmEmbed = new EmbedBuilder()
            .setTitle("🎉 Your payout has been successfully processed.")
            .setColor("Green")
            .setDescription(
                `💰 **Prize:** $${amount}\n🎁 **Giveaway:** ${giveaway}\n\n🙏 Thank you for supporting our community!\n\nPlease vouch using the button below.`
            );

        const dmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Vouch Now")
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${VOUCH_CHANNEL}`)
        );

        user.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});

        return interaction.reply({ content: "✅ Winner processed successfully", ephemeral: true });
    }

    // =========================
    // 📊 STATS
    // =========================
    if (interaction.commandName === "stats") {
        const guild = interaction.guild;

        const supporters = guild.members.cache.filter(m =>
            m.roles.cache.has(process.env.ROLE_ID)
        ).size;

        let totalWins = 0;
        let totalPrize = 0;

        for (const id in db) {
            totalWins += db[id].wins || 0;
            totalPrize += db[id].prize || 0;
        }

        const embed = new EmbedBuilder()
            .setTitle("📊 Server Stats")
            .setColor("#00ffff")
            .addFields(
                { name: "Members", value: `${guild.memberCount}`, inline: true },
                { name: "Supporters", value: `${supporters}`, inline: true },
                { name: "Total Wins", value: `${totalWins}`, inline: true },
                { name: "Total Payout", value: `$${totalPrize}` }
            );

        return interaction.reply({ embeds: [embed] });
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
