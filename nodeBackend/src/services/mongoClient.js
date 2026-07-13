const { MongoClient } = require("mongodb");
const dns = require("dns");

const ORIGINAL_MONGO_URL = process.env.MONGO_DB_URL || process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB_NAME || process.env.MONGO_DATABASE || "plc";

// ── Manual SRV resolution ───────────────────────────────────────────
// The MongoDB driver's built-in SRV lookup fails on networks whose
// local DNS resolver cannot handle SRV records.  We resolve the
// SRV + TXT records ourselves using public DNS (8.8.8.8 / 1.1.1.1)
// and build a standard mongodb:// URL that needs no SRV lookup at all.
// ─────────────────────────────────────────────────────────────────────

// Use public DNS for our own resolution calls
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch (_) { /* ignore */ }

/**
 * Convert a mongodb+srv:// URL into a standard mongodb:// URL by
 * manually resolving the SRV and TXT DNS records.
 */
async function resolveSrvToStandard(srvUrl) {
  if (!srvUrl.startsWith("mongodb+srv://")) return srvUrl;

  const match = srvUrl.match(/mongodb\+srv:\/\/((?:[^@]+@)?)([^/?#]+)([\s\S]*)/);
  if (!match) return srvUrl;

  const [, userInfo, host, rest] = match;

  // Resolve SRV records → list of shard hosts
  const srvRecords = await new Promise((resolve, reject) =>
    dns.resolveSrv(`_mongodb._tcp.${host}`, (err, records) =>
      err ? reject(err) : resolve(records)
    )
  );
  const hostList = srvRecords.map(r => `${r.name}:${r.port}`).join(",");

  // Resolve TXT records → connection options (authSource, replicaSet, etc.)
  let txtOpts = "";
  try {
    const txtRecords = await new Promise((resolve, reject) =>
      dns.resolveTxt(host, (err, records) =>
        err ? reject(err) : resolve(records)
      )
    );
    if (txtRecords.length > 0) txtOpts = txtRecords[0].join("");
  } catch (_) { /* TXT is optional */ }

  // Build the query string: merge existing params with TXT options
  let qs = rest.replace(/^\//, "");
  if (txtOpts) {
    qs = qs.includes("?")
      ? `${qs}&${txtOpts}`
      : `?${txtOpts}${qs ? "&" + qs.replace(/^\?/, "") : ""}`;
  }
  // Atlas always requires TLS
  if (!/[?&](?:tls|ssl)=/.test(qs)) {
    qs += (qs.includes("?") ? "&" : "?") + "tls=true";
  }

  const standardUrl = `mongodb://${userInfo}${hostList}/${qs}`;
  return standardUrl;
}

// ── Connection state ────────────────────────────────────────────────
let resolvedUrl = null;   // cached resolved URL
let client = null;
let db = null;
let connectingPromise = null;

async function getDb() {
  if (db) return db;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    try {
      // Resolve SRV once
      if (!resolvedUrl) {
        resolvedUrl = await resolveSrvToStandard(ORIGINAL_MONGO_URL);
        console.log("[MongoDB] Resolved connection URL (SRV bypassed).");
      }

      client = new MongoClient(resolvedUrl);
      await client.connect();
      db = client.db(DB_NAME);
      console.log("[MongoDB] Connected successfully.");
      return db;
    } catch (err) {
      // Clean up on failure
      try { if (client) await client.close(); } catch (_) { /* ignore */ }
      client = null;
      db = null;
      resolvedUrl = null;
      throw err;
    }
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    resolvedUrl = null;
  }
}

module.exports = { getDb, closeDb };
