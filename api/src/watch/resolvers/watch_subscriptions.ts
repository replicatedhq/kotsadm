import _ from "lodash";
import { Stores } from "../../schema/stores";
import { getRedisPubSub } from "../../util/persistence/redis";

export function WatchSubscriptions(stores: Stores) {
  return {
    async ping(_, args: any): Promise<void> {
      subscribe: async () => {
        const pubsub = await getRedisPubSub();
        pubsub.asyncIterator("TICK");
      }
    }
  }
}
