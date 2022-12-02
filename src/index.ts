import { DKRCommands, Plugin } from "dkrcommands";
import { Options } from "./interfaces";

export class Cooldowns extends Plugin {
    private instance?: DKRCommands;

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

        } = options || {};

        if (false)
            throw new Error("DKRCommands Cooldowns > Option 'xyz' must be a non empty number.");
    }

    /**
     * Loads and runs the plugin.
     * @param instance - DKRCommands
     */
    async load(instance?: DKRCommands): Promise<void> {
        this.instance = instance;
        if (!this.instance)
            throw new Error("No DKRCommands instance provided!");

        console.log(`DKRCommands Cooldowns > Plugin has been loaded.`);
    }

    /**
     * Disables and unloads the plugin.
     */
    unload(): void {
        console.log("DKRCommands Cooldowns > Plugin has been unloaded.");
    }
}
