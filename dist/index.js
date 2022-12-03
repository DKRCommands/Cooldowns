"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cooldowns = void 0;
const dkrcommands_1 = require("dkrcommands");
const mongoose_1 = require("mongoose");
const models_1 = require("./database/models");
class Cooldowns extends dkrcommands_1.Plugin {
    instance;
    defaultGlobalCooldown;
    defaultGuildCooldown;
    defaultUserCooldown;
    _invokeLegacyCommand;
    _invokeSlashCommand;
    secondsRegex = new RegExp("^[0-9]+s$");
    minutesRegex = new RegExp("^[0-9]+m$");
    hoursRegex = new RegExp("^[0-9]+h$");
    daysRegex = new RegExp("^[0-9]+d$");
    CooldownModel;
    constructor(options) {
        super();
        this.check(options);
    }
    check(options) {
        const { defaultGlobalCooldown, defaultGuildCooldown, defaultUserCooldown } = options || {};
        this.defaultGlobalCooldown = this.checkCooldown(defaultGlobalCooldown);
        this.defaultGuildCooldown = this.checkCooldown(defaultGuildCooldown);
        this.defaultUserCooldown = this.checkCooldown(defaultUserCooldown);
        if (defaultGlobalCooldown && !this.defaultGlobalCooldown)
            throw new Error("DKRCommands Cooldowns > Option 'defaultGlobalCooldown' must be a non empty number or string.");
        if (defaultGuildCooldown && !this.defaultGuildCooldown)
            throw new Error("DKRCommands Cooldowns > Option 'defaultGuildCooldown' must be a non empty number or string.");
        if (defaultUserCooldown && !this.defaultUserCooldown)
            throw new Error("DKRCommands Cooldowns > Option 'defaultUserCooldown' must be a non empty number or string.");
    }
    checkCooldown(cooldown) {
        if (typeof cooldown === "number")
            return cooldown;
        else if (typeof cooldown === "string") {
            if (this.secondsRegex.test(cooldown))
                return Number(cooldown.replace("s", ""));
            else if (this.minutesRegex.test(cooldown))
                return Number(cooldown.replace("m", "")) * 60;
            else if (this.hoursRegex.test(cooldown))
                return Number(cooldown.replace("h", "")) * 3600;
            else if (this.daysRegex.test(cooldown))
                return Number(cooldown.replace("d", "")) * 86400;
            return undefined;
        }
        return undefined;
    }
    async load(instance) {
        if (!instance)
            throw new Error("No DKRCommands instance provided!");
        if (instance.mongooseConnection?.readyState !== mongoose_1.ConnectionStates.connecting && instance.mongooseConnection?.readyState !== mongoose_1.ConnectionStates.connected)
            throw new Error("DKRCommands Cooldowns > MongoDB connection is required to use this plugin!");
        this.instance = instance;
        this._invokeLegacyCommand = this.instance.commandHandler.invokeCommand;
        this.instance.commandHandler.invokeCommand = this.invokeLegacyCommand.bind(this);
        this._invokeSlashCommand = this.instance.slashCommands.invokeCommand;
        this.instance.slashCommands.invokeCommand = this.invokeSlashCommand.bind(this);
        this.CooldownModel = (0, models_1.getModel)(instance.mongooseConnection);
        console.log(`DKRCommands Cooldowns > Plugin has been loaded.`);
    }
    unload() {
        this.instance.commandHandler.invokeCommand = this._invokeLegacyCommand;
        this.instance.slashCommands.invokeCommand = this._invokeSlashCommand;
        console.log("DKRCommands Cooldowns > Plugin has been unloaded.");
    }
    async invokeSlashCommand(interaction, command) {
        const [expired, type, remainingSeconds] = await this.cooldownsExpired(interaction.guild, interaction.user, command);
        if (!expired) {
            if (this.instance.errorMessages)
                interaction.reply({
                    content: `You are on ${type} cooldown for ${remainingSeconds} more seconds!`,
                    ephemeral: this.instance.ephemeral
                }).then();
            this.instance.emit("commandCooldown", this.instance, interaction.guild, type, remainingSeconds, (reply) => {
                if (typeof reply === "string")
                    interaction.reply({
                        content: reply,
                        ephemeral: this.instance.ephemeral
                    }).then();
                else
                    interaction.reply({
                        ephemeral: this.instance.ephemeral,
                        ...reply
                    }).then();
            });
            return;
        }
        this._invokeSlashCommand(interaction, command).then();
        this.updateCommandCooldowns(command, interaction.guild, interaction.user).then();
    }
    async invokeLegacyCommand(instance, command, guild, message, args) {
        const [expired, type, remainingSeconds] = await this.cooldownsExpired(guild, message.author, command);
        if (!expired) {
            if (this.instance.errorMessages)
                message.reply(`You are on ${type} cooldown for ${remainingSeconds} more seconds!`).then();
            this.instance.emit("commandCooldown", this.instance, guild, type, remainingSeconds, (reply) => {
                message.reply(reply).then();
            });
            return;
        }
        this._invokeLegacyCommand(instance, command, guild, message, args).then();
        this.updateCommandCooldowns(command, guild, message.author).then();
    }
    async cooldownsExpired(guild, user, command) {
        if (typeof command.globalCooldown == "number") {
            if (command.globalCooldown != 0) {
                const lastRun = await this.getLastGlobalRun(command);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= command.globalCooldown)
                        return [false, "global", command.globalCooldown - secondsTillLastRun];
                }
            }
        }
        else if (this.defaultGlobalCooldown) {
            const lastRun = await this.getLastGlobalRun(command);
            if (lastRun) {
                const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                if (secondsTillLastRun <= this.defaultGlobalCooldown)
                    return [false, "global", this.defaultGlobalCooldown - secondsTillLastRun];
            }
        }
        if (guild) {
            if (typeof command.guildCooldown == "number") {
                if (command.guildCooldown != 0) {
                    const lastRun = await this.getLastGuildRun(command, guild);
                    if (lastRun) {
                        const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                        if (secondsTillLastRun <= command.guildCooldown)
                            return [false, "guild", command.guildCooldown - secondsTillLastRun];
                    }
                }
            }
            else if (this.defaultGuildCooldown) {
                const lastRun = await this.getLastGuildRun(command, guild);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= this.defaultGuildCooldown)
                        return [false, "guild", this.defaultGuildCooldown - secondsTillLastRun];
                }
            }
        }
        if (typeof command.userCooldown == "number") {
            if (command.userCooldown != 0) {
                const lastRun = await this.getLastUserRun(command, user);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= command.userCooldown)
                        return [false, "user", command.userCooldown - secondsTillLastRun];
                }
            }
        }
        else if (this.defaultUserCooldown) {
            const lastRun = await this.getLastUserRun(command, user);
            if (lastRun) {
                const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                if (secondsTillLastRun <= this.defaultUserCooldown)
                    return [false, "user", this.defaultUserCooldown - secondsTillLastRun];
            }
        }
        return [true, "", 0];
    }
    async getLastGlobalRun(command) {
        return (await this.CooldownModel.findOne({ command: command.name, guild: null, user: null }))?.executed;
    }
    async getLastGuildRun(command, guild) {
        return (await this.CooldownModel.findOne({ command: command.name, guild: guild.id, user: null }))?.executed;
    }
    async getLastUserRun(command, user) {
        return (await this.CooldownModel.findOne({ command: command.name, guild: null, user: user.id }))?.executed;
    }
    async updateCommandCooldowns(command, guild, user) {
        await this.CooldownModel.updateOne({ command: command.name, guild: null, user: null }, {}, { upsert: true });
        if (guild)
            await this.CooldownModel.updateOne({
                command: command.name,
                guild: guild.id,
                user: null
            }, {}, { upsert: true });
        await this.CooldownModel.updateOne({ command: command.name, guild: null, user: user.id }, {}, { upsert: true });
    }
}
exports.Cooldowns = Cooldowns;
