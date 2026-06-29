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
// AUTO ROLE SYSTEM (STABLE)
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
            }
        }
    } catch (e) {
        console.error("role error:", e);
    }
});

// =========================
// SLASH COMMANDS (CLEAN)
// =========================
const commands = [
    {
        name: "winner",
        description: "Declare winner and log payout",
        options: [
            { name: "user", description: "Winner user", type: 6, required: true },
            { name: "amount", description: "Prize amount", type: 10, required: true },
            { name: "note", description: "Giveaway name / note", type: 3, required: true }
        ]
    },
    {
        name: "history",
        description: "Check user win history",
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
        description: "Check all supporter roles manually"
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
// INTERACTIONS SAFE HANDLER
// =========================
client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        let db = loadDB();

        // =========================
        // 🏆 WINNER (FIXED LOG + DM + HISTORY)
        // =========================
        if (interaction.commandName === "winner") {

            const user = interaction.options.getUser("user");
            const amount = interaction.options.getNumber("amount");
            const note = interaction.options.getString("note");

            if (!db[user.id]) {
                db[user.id] = { wins: 0, total: 0, history: [] };
            }

            db[user.id].wins += 1;
            db[user.id].total += amount;
            db[user.id].history.push({
                note,
                amount,
                time: Date.now()
            });

            saveDB(db);

            // ===== LOG EMBED =====
            const logEmbed = new EmbedBuilder()
                .setTitle("🏆 WINNER LOGGED")
                .setColor("Gold")
                .setDescription(
                    `👤 User: <@${user.id}>\n💰 Prize: $${amount}\n🎁 Note: ${note}\n🆔 ID: ${user.id}`
                );

            const logChannel = interaction.guild.channels.cache.get(WINNER_LOG_CHANNEL);
            if (logChannel) {
                logChannel.send({ embeds: [logEmbed] });
            }

            // ===== DM USER =====
            const dmEmbed = new EmbedBuilder()
                .setTitle("💰 Your payout has been successfully processed.")
                .setColor("Green")
                .setDescription(
                    `💰 **Prize:** $${amount}\n🎁 **Note:** ${note}\n\n🙏 Thank you for supporting our community!\nPlease vouch using the button below.`
                );

            const dmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Vouch Here")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${interaction.guild.id}/${VOUCH_CHANNEL}`)
            );

            user.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});

            return interaction.reply({ content: "✅ Winner logged successfully", ephemeral: true });
        }

        // =========================
        // 📜 HISTORY
        // =========================
        if (interaction.commandName === "history") {

            const user = interaction.options.getUser("user") || interaction.user;
            const data = db[user.id];

            if (!data || !data.history?.length) {
                return interaction.reply({ content: "❌ No history found", ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📜 ${user.username} History`)
                .setColor("Blue")
                .setDescription(
                    data.history.map(h =>
                        `🎁 ${h.note} | 💰 $${h.amount}`
                    ).join("\n")
                )
                .addFields(
                    { name: "Wins", value: `${data.wins}`, inline: true },
                    { name: "Total Earned", value: `$${data.total}`, inline: true }
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

            let totalWins = 0;
            let totalMoney = 0;

            for (const id in db) {
                totalWins += db[id].wins || 0;
                totalMoney += db[id].total || 0;
            }

            const embed = new EmbedBuilder()
                .setTitle("📊 Server Stats")
                .setColor("#00ffff")
                .addFields(
                    { name: "Members", value: `${guild.memberCount}`, inline: true },
                    { name: "Supporters", value: `${supporters}`, inline: true },
                    { name: "Total Wins", value: `${totalWins}`, inline: true },
                    { name: "Total Payout", value: `$${totalMoney}` }
                );

            return interaction.reply({ embeds: [embed] });
        }

        // =========================
        // 🔥 VANITY CHECK (MANUAL ROLE SYNC)
        // =========================
        if (interaction.commandName === "vanitycheck") {

            await interaction.reply({ content: "🔍 Checking members...", ephemeral: true });

            const role = interaction.guild.roles.cache.get(process.env.ROLE_ID);
            if (!role) return;

            let added = 0;

            const members = await interaction.guild.members.fetch();

            for (const member of members.values()) {
                const status = member.presence?.activities?.find(a => a.type === 4);
                const text = (status?.state || "").toLowerCase();

                if (text.includes(SUPPORT_LINK)) {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role).catch(() => {});
                        added++;
                    }
                }
            }

            return interaction.followUp({
                content: `✅ Vanity check complete. Roles updated: **${added}**`,
                ephemeral: true
            });
        }

    } catch (err) {
        console.error("interaction error:", err);

        if (!interaction.replied) {
            interaction.reply({
                content: "❌ Command failed. Please try again.",
                ephemeral: true
            });
        }
    }
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);
