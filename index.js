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

// =====================
// CLIENT (SAFE)
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// =====================
// CONFIG
// =====================
const SUPPORT_LINK = "discord.gg/pikpa";
const WINNER_LOG = "1506457793132232774";

// =====================
// SAFE DB
// =====================
const fs = require("fs");
const DB_FILE = "./data.json";

function loadDB() {
    if (!fs.existsSync(DB_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// =====================
// SUPPORTER ROLE SYSTEM
// =====================
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

// =====================
// SAFE SLASH COMMANDS (NO UNDEFINED EVER)
// =====================
const commands = [
    {
        name: "winner",
        description: "Declare giveaway winner",
        options: [
            {
                name: "user",
                description: "Winner user",
                type: 6,
                required: true
            },
            {
                name: "amount",
                description: "Prize amount",
                type: 10,
                required: true
            },
            {
                name: "giveaway",
                description: "Giveaway name",
                type: 3,
                required: true
            }
        ]
    },

    {
        name: "history",
        description: "Check user history",
        options: [
            {
                name: "user",
                description: "User",
                type: 6,
                required: false
            }
        ]
    },

    {
        name: "stats",
        description: "Server stats"
    }
];

// =====================
// REGISTER COMMANDS (SAFE FIX)
// =====================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("✅ Commands registered successfully");
    } catch (err) {
        console.error("❌ Command error:", err);
    }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    let db = loadDB();

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

        if (!db[user.id]) {
            db[user.id] = { wins: 0, prize: 0, history: [] };
        }

        db[user.id].wins += 1;
        db[user.id].prize += amount;
        db[user.id].history.push({
            giveaway,
            amount,
            date: Date.now()
        });

        saveDB(db);

        const embed = new EmbedBuilder()
            .setTitle("🏆 Winner Selected")
            .setColor("Gold")
            .setDescription(
                `🎉 Winner: ${user}\n💰 Prize: $${amount}\n🎁 Giveaway: ${giveaway}`
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
    // 📜 HISTORY
    // =====================
    if (interaction.commandName === "history") {
        const user = interaction.options.getUser("user") || interaction.user;

        const data = db[user.id];

        if (!data || !data.history?.length) {
            return interaction.reply({ content: "❌ No history found", ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} History`)
            .setColor("Blue")
            .setDescription(
                data.history.map(h =>
                    `🎁 ${h.giveaway} | 💰 $${h.amount}`
                ).join("\n")
            )
            .addFields(
                { name: "Wins", value: `${data.wins}`, inline: true },
                { name: "Total", value: `$${data.prize}`, inline: true }
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

client.login(process.env.TOKEN);
