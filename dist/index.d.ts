import { DKRCommands, Plugin } from "dkrcommands";
import { Command } from "dkrcommands/dist/handlers";
import { Guild, Message } from "discord.js";
import { Options } from "./interfaces";
export declare class Cooldowns extends Plugin {
    private instance;
    private defaultGlobalCooldown?;
    private defaultGuildCooldown?;
    private defaultUserCooldown?;
    private _invokeLegacyCommand;
    private _invokeSlashCommand;
    private readonly secondsRegex;
    private readonly minutesRegex;
    private readonly hoursRegex;
    private readonly daysRegex;
    private CooldownModel;
    constructor(options?: Options);
    private check;
    private checkCooldown;
    load(instance?: DKRCommands): Promise<void>;
    unload(): void;
    private invokeSlashCommand;
    invokeLegacyCommand(instance: DKRCommands, command: Command, guild: Guild | null, message: Message, args: string[]): Promise<void>;
    private cooldownsExpired;
    private getLastGlobalRun;
    private getLastGuildRun;
    private getLastUserRun;
    private updateCommandCooldowns;
}
