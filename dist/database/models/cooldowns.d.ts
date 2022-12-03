import { Connection, Model } from "mongoose";
interface Cooldown {
    command: string | null;
    guild: string | null;
    user: string | null;
    executed: Date;
}
declare function getModel(connection: Connection): Model<Cooldown>;
export { Cooldown, getModel };
