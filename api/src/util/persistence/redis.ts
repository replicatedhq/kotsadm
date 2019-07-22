import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";
import { param } from "../params";

export async function getRedisPubSub(): Promise<RedisPubSub> {
  const pubsub = new RedisPubSub({
    publisher: new Redis(await param("REDIS_URI", "/shipcloud/redis/uri", true)),
    subscriber: new Redis(await param("REDIS_URI", "/shipcloud/redis/uri", true)),
  });

  return pubsub;
}
