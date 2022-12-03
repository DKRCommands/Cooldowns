import { DKRCommands, Plugin } from "dkrcommands";
import { Command } from "dkrcommands/dist/handlers";
import { ConnectionStates, Model } from "mongoose";
import { ChatInputCommandInteraction, Guild, Message, User } from "discord.js";
import { Cooldown, getModel } from "./database/models";
import { Options } from "./interfaces";

/**
 * The main plugin class responsible for controlling command cooldowns.
 */
export class Cooldowns extends Plugin {
    private instance!: DKRCommands;
    private defaultGlobalCooldown?: number;
    private defaultGuildCooldown?: number;
    private defaultUserCooldown?: number;
    private _invokeLegacyCommand!: (instance: DKRCommands, command: Command, guild: Guild | null, message: Message, args: string[]) => Promise<void>;
    private _invokeSlashCommand!: (interaction: ChatInputCommandInteraction, command: Command) => Promise<void>;

    private readonly secondsRegex = new RegExp("^[0-9]+s$");
    private readonly minutesRegex = new RegExp("^[0-9]+m$");
    private readonly hoursRegex = new RegExp("^[0-9]+h$");
    private readonly daysRegex = new RegExp("^[0-9]+d$");

    private CooldownModel!: Model<Cooldown>;

    constructor(options?: Options) {
        super();

        this.check(options);
    }

    /**
     * Checks the parameters of the options object of the DKRCommands cooldowns plugin.
     * @param options - DKRCommands cooldowns options object
     * @private
     */
    private check(options?: Options): void {
        const {
            defaultGlobalCooldown,
            defaultGuildCooldown,
            defaultUserCooldown
        } = options || {};

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

    /**
     * Checks if the specified cooldown value is valid and converts it to a number if necessary.
     * @param cooldown - input value from plugin options
     * @private
     */
    private checkCooldown(cooldown?: number | string): number | undefined {
        if (typeof cooldown === "number")
            return cooldown;
        else if (typeof cooldown === "string") {
            if (this.secondsRegex.test(cooldown))
                return Number(cooldown.replace("s", ""));
            else if (this.minutesRegex.test(cooldown))
                return Number(cooldown.replace("m", "")) * 60;
            else if (this.hoursRegex.test(cooldown))
                return Number(cooldown.replace("h", "")) * 3_600;
            else if (this.daysRegex.test(cooldown))
                return Number(cooldown.replace("d", "")) * 86_400;

            return undefined;
        }

        return undefined;
    }

    /**
     * Loads and runs the plugin.
     * @param instance - DKRCommands
     */
    async load(instance?: DKRCommands): Promise<void> {
        if (!instance)
            throw new Error("No DKRCommands instance provided!");
        if (instance.mongooseConnection?.readyState !== ConnectionStates.connecting && instance.mongooseConnection?.readyState !== ConnectionStates.connected)
            throw new Error("DKRCommands Cooldowns > MongoDB connection is required to use this plugin!");

        this.instance = instance;

        this._invokeLegacyCommand = this.instance.commandHandler.invokeCommand;
        this.instance.commandHandler.invokeCommand = this.invokeLegacyCommand.bind(this);

        this._invokeSlashCommand = this.instance.slashCommands.invokeCommand;
        this.instance.slashCommands.invokeCommand = this.invokeSlashCommand.bind(this);

        this.CooldownModel = getModel(instance.mongooseConnection);

        console.log(`DKRCommands Cooldowns > Plugin has been loaded.`);
    }

    /**
     * Disables and unloads the plugin.
     */
    unload(): void {
        this.instance.commandHandler.invokeCommand = this._invokeLegacyCommand;
        this.instance.slashCommands.invokeCommand = this._invokeSlashCommand;

        console.log("DKRCommands Cooldowns > Plugin has been unloaded.");
    }

    /**
     * Calls the callback method of the slash command.
     * @param interaction - Discord interaction
     * @param command - DKRCommands command instance
     * @private
     */
    private async invokeSlashCommand(interaction: ChatInputCommandInteraction, command: Command): Promise<void> {
        const [ expired, type, remainingSeconds ] = await this.cooldownsExpired(interaction.guild, interaction.user, command);
        if (!expired) {
            if (this.instance.errorMessages)
                interaction.reply({
                    content: `You are on ${ type } cooldown for ${ remainingSeconds } more seconds!`,
                    ephemeral: this.instance.ephemeral
                }).then();
            this.instance.emit("commandCooldown", this.instance, interaction.guild, type, remainingSeconds, (reply: string | object) => {
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

    /**
     * Calls the callback method of the legacy command.
     * @param instance - DKRCommands instance
     * @param command - DKRCommands command instance
     * @param guild -Discord guild
     * @param message - Discord message
     * @param args - Command arguments
     */
    public async invokeLegacyCommand(instance: DKRCommands, command: Command, guild: Guild | null, message: Message, args: string[]) {
        const [ expired, type, remainingSeconds ] = await this.cooldownsExpired(guild, message.author, command);
        if (!expired) {
            if (this.instance.errorMessages)
                message.reply(`You are on ${ type } cooldown for ${ remainingSeconds } more seconds!`).then();
            this.instance.emit("commandCooldown", this.instance, guild, type, remainingSeconds, (reply: string | object) => {
                message.reply(reply).then();
            });

            return;
        }

        this._invokeLegacyCommand(instance, command, guild, message, args).then();
        this.updateCommandCooldowns(command, guild, message.author).then();
    }

    /**
     * Checks whether the command cooldown has expired or not.
     * @param guild - Discord guild
     * @param user - Discord user
     * @param command - DKRCommands command instance
     * @private
     */
    private async cooldownsExpired(guild: Guild | null, user: User, command: Command): Promise<[ boolean, string, number ]> {
        // Check global cooldown
        if (typeof command.globalCooldown == "number") {
            if (command.globalCooldown != 0) {
                const lastRun = await this.getLastGlobalRun(command);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= command.globalCooldown)
                        return [ false, "global", command.globalCooldown - secondsTillLastRun ];
                }
            }
        } else if (this.defaultGlobalCooldown) {
            const lastRun = await this.getLastGlobalRun(command);
            if (lastRun) {
                const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                if (secondsTillLastRun <= this.defaultGlobalCooldown)
                    return [ false, "global", this.defaultGlobalCooldown - secondsTillLastRun ];
            }
        }

        // Check guild cooldown
        if (guild) {
            if (typeof command.guildCooldown == "number") {
                if (command.guildCooldown != 0) {
                    const lastRun = await this.getLastGuildRun(command, guild);
                    if (lastRun) {
                        const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                        if (secondsTillLastRun <= command.guildCooldown)
                            return [ false, "guild", command.guildCooldown - secondsTillLastRun ];
                    }
                }
            } else if (this.defaultGuildCooldown) {
                const lastRun = await this.getLastGuildRun(command, guild);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= this.defaultGuildCooldown)
                        return [ false, "guild", this.defaultGuildCooldown - secondsTillLastRun ];
                }
            }
        }

        // Check user cooldown
        if (typeof command.userCooldown == "number") {
            if (command.userCooldown != 0) {
                const lastRun = await this.getLastUserRun(command, user);
                if (lastRun) {
                    const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                    if (secondsTillLastRun <= command.userCooldown)
                        return [ false, "user", command.userCooldown - secondsTillLastRun ];
                }
            }
        } else if (this.defaultUserCooldown) {
            const lastRun = await this.getLastUserRun(command, user);
            if (lastRun) {
                const secondsTillLastRun = Math.round(Math.abs(new Date().getTime() - lastRun.getTime()) / 1000);
                if (secondsTillLastRun <= this.defaultUserCooldown)
                    return [ false, "user", this.defaultUserCooldown - secondsTillLastRun ];
            }
        }

        return [ true, "", 0 ];
    }

    /**
     * Returns info about the last time the command was run.
     * @param command - DKRCommands command instance
     * @private
     */
    private async getLastGlobalRun(command: Command): Promise<Date | undefined> {
        return (await this.CooldownModel.findOne({ command: command.name, guild: null, user: null }))?.executed;
    }

    /**
     * Returns info about the last time the command was run on the server.
     * @param command - DKRCommands command instance
     * @param guild - Discord guild
     * @private
     */
    private async getLastGuildRun(command: Command, guild: Guild): Promise<Date | undefined> {
        return (await this.CooldownModel.findOne({ command: command.name, guild: guild.id, user: null }))?.executed;
    }

    /**
     * Returns info about the last time the command was run by the user.
     * @param command - DKRCommands command instance
     * @param user - Discord user
     * @private
     */
    private async getLastUserRun(command: Command, user: User): Promise<Date | undefined> {
        return (await this.CooldownModel.findOne({ command: command.name, guild: null, user: user.id }))?.executed;
    }

    /**
     * Updates the time when the command was last run.
     * @param command -DKRCommands command instance
     * @param guild - Discord guild
     * @param user - Discord user
     * @private
     */
    private async updateCommandCooldowns(command: Command, guild: Guild | null, user: User): Promise<void> {
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
