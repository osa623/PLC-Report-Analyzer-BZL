const { createClient } = require("redis");
const { env } = require("./env");
const { logger } = require("./logger");

const redisClient = createClient({
  url: env.redisUrl || "redis://localhost:6379"
});

redisClient.on("error", (err) => logger.error({ error: err?.message, stack: err?.stack }, "Redis Client Error"));
redisClient.connect().catch((err) =>
  logger.error({ error: err?.message, stack: err?.stack }, "Redis Connect Error")
);

module.exports = { redisClient };