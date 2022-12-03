"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModel = void 0;
const mongoose_1 = require("mongoose");
const cooldown = new mongoose_1.Schema({
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
function getModel(connection) {
    return connection.model("dkrcommands-cooldowns", cooldown);
}
exports.getModel = getModel;
