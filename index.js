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
// CLIENT (FIXED INTENTS)
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

const WINNER_LOG_CHANNEL = "1514526513045835846";
const VOUCH_CHANNEL = "1512778450186932334";

// =========================
// DATABASE
// =========================
const DB_FILE = "./data.json";

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return {};
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// =========================
// READY
// =========================
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// =========================
// SAFE VANITY ROLE SYSTEM
// =========================
client.on("presenceUpdate", async (_, newP) => {
    try {
        const member = newP?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const activities = newP?.activities || [];
        const status = activities.find(a => a.type === 4);

        const text = (status?.state || "").toLowerCase();

        if (text.includes(SUPPORT_LINK)) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(() => {});
            }
        }
    } catch (e) {
        console.error("presence error:", e);
    }
});

// =========================
// SLASH COMMANDS
// =========================
const commands = [
    {
        name: "winner",
        description: "Log winner payout",
        options: [
            { name: "user", description: "Winner", type: 6, required: true },
            { name: "amount", description: "Prize", type: 10, required: true },
            { name: "note", description: "Giveaway name", type: 3, required: true }
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
        name: "vanitycheck",
        description: "Sync supporter roles"
    }
];

// =========================
// REGISTER COMMANDS
// =========================
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );

        console.log("✅ Commands registered");
    } catch (err) {
        console.error("Command error:", err);
    }
});

// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        let db = loadDB();

        // =========================
        // 🏆 WINNER SYSTEM
        // =========================
        if (interaction.commandName === "winner") {

            const user = interaction.options.getUser("user");
            const amount = interaction.options.getNumber("amount");
            const note = interaction.options.getString("note");

            if (!db[user.id]) {
                db[user.id] = { wins: 0, total: 0, history: [] };
            }

            db[user.id].wins++;
            db[user.id].total += amount;
            db[user.id].history.push({
                note,
                amount,
                time: Date.now()
            });

            saveDB(db);

            const logEmbed = new EmbedBuilder()
                .setTitle("🏆 WINNER LOGGED")
                .setColor("Gold")
                .setDescription(
                    `👤 <@${user.id}>\n💰 $${amount}\n🎁 ${note}\n🆔 ${user.id}`
                );

            const logChannel = interaction.guild.channels.cache.get(WINNER_LOG_CHANNEL);
            if (logChannel) {
                logChannel.send({ embeds: [logEmbed] });
            }

            const dmEmbed = new EmbedBuilder()
                .setTitle("💰 Payout Processed")
                .setColor("Green")
                .setDescription(
                    `💰 Prize: $${amount}\n🎁 Giveaway: ${note}\n\n🙏 Thank you for supporting!`
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Vouch Here")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${VOUCH_CHANNEL}`)
            );

            user.send({ embeds: [dmEmbed], components: [row] }).catch(() => {});

            return interaction.reply({ content: "✅ Winner logged", ephemeral: true });
        }

        // =========================
        // 📜 HISTORY
        // =========================
        if (interaction.commandName === "history") {

            const user = interaction.options.getUser("user") || interaction.user;
            const data = db[user.id];

            if (!data || !data.history?.length) {
                return interaction.reply({ content: "❌ No history", ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${user.username} History`)
                .setColor("Blue")
                .setDescription(
                    data.history.map(h =>
                        `🎁 ${h.note} | 💰 $${h.amount}`
                    ).join("\n")
                )
                .addFields(
                    { name: "Wins", value: `${data.wins}`, inline: true },
                    { name: "Total", value: `$${data.total}`, inline: true }
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

            let wins = 0;
            let money = 0;

            for (const id in db) {
                wins += db[id].wins || 0;
                money += db[id].total || 0;
            }

            const embed = new EmbedBuilder()
                .setTitle("📊 Stats")
                .setColor("#00ffff")
                .addFields(
                    { name: "Members", value: `${guild.memberCount}`, inline: true },
                    { name: "Supporters", value: `${supporters}`, inline: true },
                    { name: "Wins", value: `${wins}`, inline: true },
                    { name: "Payouts", value: `$${money}` }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =========================
        // 🔥 VANITY CHECK (FIXED FULL SYNC)
        // =========================
        if (interaction.commandName === "vanitycheck") {

            await interaction.reply({ content: "🔍 Syncing roles...", ephemeral: true });

            const role = interaction.guild.roles.cache.get(process.env.ROLE_ID);
            if (!role) return;

            const members = await interaction.guild.members.fetch();

            let added = 0;
            let removed = 0;

            for (const member of members.values()) {

                const activities = member.presence?.activities || [];
                const status = activities.find(a => a.type === 4);

                const text = (status?.state || "").toLowerCase();
                const has = text.includes(SUPPORT_LINK);

                if (has) {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role).catch(() => {});
                        added++;
                    }
                } else {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role).catch(() => {});
                        removed++;
                    }
                }
            }

            return interaction.followUp({
                content: `✅ Done\n➕ Added: ${added}\n➖ Removed: ${removed}`,
                ephemeral: true
            });
        }

    } catch (err) {
        console.error(err);

        if (!interaction.replied) {
            interaction.reply({
                content: "❌ Error occurred",
                ephemeral: true
            });
        }
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
