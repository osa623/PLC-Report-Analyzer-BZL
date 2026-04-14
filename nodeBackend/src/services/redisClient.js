const { createClient } = require('redis');
const config = require('../config');

const client = createClient({ url: config.redisUrl });
client.on('error', (err) => console.error('Redis error:', err.message));

async function getRedis() {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

module.exports = { getRedis };
