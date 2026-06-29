require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

const SUPPORT_LINK = "discord.gg/pikpa";
const LOG_CHANNEL = "1512778450186932334";

const DATA_FILE = "./data.json";

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
    console.log(`🔥 Pro Bot Online: ${client.user.tag}`);
});


// ============================
// 💎 SUPPORTER ROLE SYSTEM
// ============================
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
                await member.roles.add(role);
            }
        }

    } catch (err) {
        console.error(err);
    }
});


// ============================
// 📊 /vanitycheck (PRO UI)
// ============================
client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (message.content === "/vanitycheck") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return;

            await message.guild.members.fetch();

            let checked = 0, added = 0, removed = 0;

            const role = message.guild.roles.cache.get(process.env.ROLE_ID);

            for (const [, member] of message.guild.members.cache) {
                if (member.user.bot) continue;

                checked++;

                const activity = member.presence?.activities?.find(a => a.type === 4);
                const text = (activity?.state || "").toLowerCase();

                const has = text.includes(SUPPORT_LINK);

                if (has) {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                        added++;
                    }
                } else {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        removed++;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("⚡ VANITY SYSTEM REPORT")
                .setColor("#00ffcc")
                .addFields(
                    { name: "👥 Checked", value: `${checked}`, inline: true },
                    { name: "➕ Added", value: `${added}`, inline: true },
                    { name: "➖ Removed", value: `${removed}`, inline: true }
                )
                .setFooter({ text: "Support System • Auto Sync Report" });

            message.channel.send({ embeds: [embed] });
        }


        // ============================
        // 🏆 /winner (PRO MESSAGE)
        // ============================
        if (message.content.startsWith("/winner")) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return;

            const user = message.mentions.users.first();
            if (!user) return message.reply("Mention a user");

            const args = message.content.split(" ");
            const amount = args[2] || "1";
            const giveaway = args.slice(3).join(" ") || "Vanity Giveaway";

            let data = loadData();

            if (!data[user.id]) {
                data[user.id] = { wins: 0, prize: 0, history: [] };
            }

            data[user.id].wins++;
            data[user.id].prize += parseFloat(amount);

            data[user.id].history.push({
                giveaway,
                prize: amount,
                date: new Date().toISOString()
            });

            saveData(data);

            const embed = new EmbedBuilder()
                .setTitle("🏆 WINNER CONFIRMED")
                .setColor("Gold")
                .setDescription(
                    `🎉 Your payout has been successfully processed.\n\n💰 Prize: **$${amount}**\n🎁 Giveaway: **${giveaway}**\n\n🙏 Thank you for supporting our community!`
                )
                .setFooter({ text: "Please vouch using the button below" });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("💬 Vouch Here")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/1450787742219767861/1512778450186932334`)
            );

            const log = message.guild.channels.cache.get(LOG_CHANNEL);

            if (log) log.send({ embeds: [embed], components: [row] });

            user.send({
                embeds: [embed],
                components: [row]
            }).catch(() => {});

            message.reply("✅ Winner logged successfully.");
        }


        // ============================
        // 🎁 /giveaway (CREATE EVENT)
        // ============================
        if (message.content.startsWith("/giveaway")) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return;

            const args = message.content.split(" ");
            const prize = args[1];
            const time = args[2];
            const name = args.slice(3).join(" ") || "Giveaway";

            const embed = new EmbedBuilder()
                .setTitle("🎉 GIVEAWAY STARTED")
                .setColor("#ff00ff")
                .setDescription(
                    `🎁 Prize: **$${prize}**\n⏰ Time: **${time}**\n🏆 Giveaway: **${name}**\n\nReact / click to join!`
                );

            const log = message.guild.channels.cache.get(LOG_CHANNEL);

            if (log) log.send({ embeds: [embed] });

            message.channel.send({ embeds: [embed] });
        }


        // ============================
        // 📊 /stats (CLEAN UI)
        // ============================
        if (message.content === "/stats") {
            const guild = message.guild;

            let data = loadData();

            let supporters = guild.members.cache.filter(m =>
                m.roles.cache.has(process.env.ROLE_ID)
            ).size;

            let winners = Object.keys(data).length;

            let payout = 0;
            for (const id in data) {
                payout += data[id].prize;
            }

            const embed = new EmbedBuilder()
                .setTitle("📊 SERVER STATISTICS")
                .setColor("#00ffff")
                .addFields(
                    { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
                    { name: "💎 Supporters", value: `${supporters}`, inline: true },
                    { name: "🏆 Winners", value: `${winners}`, inline: true },
                    { name: "💰 Total Payout", value: `$${payout}`, inline: false }
                );

            message.channel.send({ embeds: [embed] });
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.TOKEN);
