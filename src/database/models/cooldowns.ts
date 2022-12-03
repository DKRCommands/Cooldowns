import { Connection, Model, Schema } from "mongoose";

interface Cooldown {
    command: string | null;
    guild: string | null;
    user: string | null;
    executed: Date;
}

const cooldown = new Schema<Cooldown>({
    command: {
        type: String,
        default: null
    },
    guild: {
        type: String,
        default: null
    },
    user: {
        type: String,
        default: null
    }
}, {
    timestamps: { updatedAt: "executed" }
});

/**
 * Returns model for DKRCommands MongoDB connection object.
 * @param connection - MongoDB connection
 */
function getModel(connection: Connection): Model<Cooldown> {
    return connection.model("dkrcommands-cooldowns", cooldown);
}

export {
    Cooldown,
    getModel
};
