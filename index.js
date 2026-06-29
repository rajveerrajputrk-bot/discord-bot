require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");

// =========================
// 🔥 SAFE CLIENT (NO CRASH INTENTS)
// =========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// =========================
// 🔥 SAFE DATA SYSTEM
// =========================
const DATA_FILE = "./data.json";

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE));
    } catch {
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Save error:", err);
    }
}

// =========================
// 🔥 CONFIG
// =========================
const SUPPORT_LINK = "discord.gg/pikpa";
const WINNER_LOG = "1506457793132232774";
const DAILY_LOG = "1512778450186932334";

// =========================
// 🔥 SAFE READY EVENT (NO DEPRECATION CRASH)
// =========================
client.once("ready", () => {
    console.log(`✅ Bot online as ${client.user.tag}`);
});

// =========================
// 🔥 SUPPORTER SYSTEM (SAFE)
// =========================
client.on("presenceUpdate", async (oldPresence, newPresence) => {
    try {
        const member = newPresence?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const activity = newPresence?.activities?.find(a => a.type === 4);
        const text = (activity?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
            }
        }

    } catch (err) {
        console.error("Presence error:", err);
    }
});

// =========================
// 🔥 SAFE SLASH COMMANDS (NO UNDEFINED CRASH)
// =========================
const commands = [
    {
        name: "winner",
        description: "Declare giveaway winner safely",
        options: [
            { name: "user", description: "Winner", type: 6, required: true },
            { name: "amount", description: "Prize", type: 10, required: true },
            { name: "giveaway", description: "Giveaway name", type: 3, required: true }
        ]
    },
    {
        name: "history",
        description: "Check user history",
        options: [
            { name: "user", description: "User", type: 6, required: false }
        ]
    },
    {
        name: "stats",
        description: "Server stats"
    },
    {
        name: "giveaway",
        description: "Create giveaway",
        options: [
            { name: "name", description: "Name", type: 3, required: true },
            { name: "prize", description: "Prize", type: 10, required: true },
            { name: "time", description: "Time", type: 3, required: true }
        ]
    }
];

// =========================
// 🔥 REGISTER COMMANDS (SAFE)
// =========================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash commands loaded safely");
    } catch (err) {
        console.error("Command register error:", err);
    }
});

// =========================
// 🔥 INTERACTIONS (FULL SAFE HANDLING)
// =========================
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        let data = loadData();

        // =====================
        // 🏆 WINNER
        // =====================
        if (interaction.commandName === "winner") {
            const user = interaction.options.getUser("user");
            const amount = interaction.options.getNumber("amount");
            const giveaway = interaction.options.getString("giveaway");

            if (!user || !amount || !giveaway) {
                return interaction.reply({ content: "❌ Missing data", ephemeral: true });
            }

            if (!data[user.id]) {
                data[user.id] = { wins: 0, prize: 0, history: [] };
            }

            data[user.id].wins += 1;
            data[user.id].prize += amount;
            data[user.id].history.push({
                giveaway,
                amount,
                date: Date.now()
            });

            saveData(data);

            const embed = new EmbedBuilder()
                .setTitle("🏆 Winner Confirmed")
                .setColor("Gold")
                .setDescription(
                    `🎉 You won **$${amount}**\n🎁 ${giveaway}\n\n🙏 Thanks for support`
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

        // =====================
        // 📊 HISTORY (FIXED 100%)
        // =====================
        if (interaction.commandName === "history") {
            const user = interaction.options.getUser("user") || interaction.user;

            const info = data[user.id];

            if (!info || !info.history || info.history.length === 0) {
                return interaction.reply("❌ No history found.");
            }

            const embed = new EmbedBuilder()
                .setTitle(`${user.username} History`)
                .setColor("Blue")
                .setDescription(
                    info.history
                        .map(h => `🎁 ${h.giveaway} | 💰 $${h.amount}`)
                        .join("\n")
                )
                .addFields(
                    { name: "Wins", value: `${info.wins}`, inline: true },
                    { name: "Total", value: `$${info.prize}`, inline: true }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =====================
        // 📊 STATS
        // =====================
        if (interaction.commandName === "stats") {
            const guild = interaction.guild;

            const supporters = guild.members.cache.filter(m =>
                m.roles.cache.has(process.env.ROLE_ID)
            ).size;

            let winners = Object.keys(data).length;

            let payout = 0;
            for (const id in data) payout += data[id].prize || 0;

            const embed = new EmbedBuilder()
                .setTitle("📊 Server Stats")
                .setColor("#00ffff")
                .addFields(
                    { name: "Members", value: `${guild.memberCount}`, inline: true },
                    { name: "Supporters", value: `${supporters}`, inline: true },
                    { name: "Winners", value: `${winners}`, inline: true },
                    { name: "Payout", value: `$${payout}` }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =====================
        // 🎁 GIVEAWAY (SAFE UI)
        // =====================
        if (interaction.commandName === "giveaway") {
            const name = interaction.options.getString("name");
            const prize = interaction.options.getNumber("prize");
            const time = interaction.options.getString("time");

            const embed = new EmbedBuilder()
                .setTitle("🎉 Giveaway Started")
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

    } catch (err) {
        console.error("Interaction error:", err);
        if (!interaction.replied) {
            interaction.reply({ content: "❌ Bot error handled safely", ephemeral: true });
        }
    }
});

// =========================
// 🔥 BUTTON HANDLER (SAFE)
// =========================
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isButton()) return;

        if (interaction.customId === "join") {
            return interaction.reply({ content: "✅ Joined giveaway!", ephemeral: true });
        }
    } catch (err) {
        console.error("Button error:", err);
    }
});

client.login(process.env.TOKEN);
