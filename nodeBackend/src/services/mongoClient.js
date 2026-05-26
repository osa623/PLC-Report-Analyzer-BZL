const { MongoClient } = require("mongodb");

const MONGO_URL = process.env.MONGO_DB_URL || process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB_NAME || process.env.MONGO_DATABASE || "plc";

let client = null;
let db = null;

async function getDb() {
  if (db) return db;
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { getDb, closeDb };
