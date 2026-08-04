import { createClient, type RedisClientType } from "redis";
import type { AgentConfig } from "../models/agent.model";

export interface RedisConfig {
  url: string;
}

export interface AgentConfigWithRedis extends AgentConfig {
  redis?: RedisConfig;
}

export function createRedisClient(config?: RedisConfig): RedisClientType {
  const url = config?.url || process.env.REDIS_URL || "redis://localhost:6379";

  const client = createClient({ url });

  client.on("error", (err: unknown) => {
    console.error("Redis Client Error:", err);
  });

  return client;
}
