require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const SUPPORT_LINK = "discord.gg/pikpa";

client.once("ready", () => {
    console.log("Supporter bot is online");
});

client.on("presenceUpdate", async (oldPresence, newPresence) => {
    try {
        const member = newPresence?.member;
        if (!member) return;

        const role = member.guild.roles.cache.get(process.env.ROLE_ID);
        if (!role) return;

        const activities = newPresence?.activities || [];
        const customStatus = activities.find(a => a.type === 4);

        const text = (customStatus?.state || "").toLowerCase();
        const hasSupport = text.includes(SUPPORT_LINK);

        // ✅ GIVE ROLE
        if (hasSupport) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                console.log(`+ Supporter role added: ${member.user.tag}`);
            }
        }

        // ❌ REMOVE ROLE (ONLY IF LINK REMOVED)
        else {
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                console.log(`- Supporter role removed: ${member.user.tag}`);
            }
        }

    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.TOKEN);
