const { Client } = require('pg');

async function run() {
  const connectionString = 'postgresql://postgres:buyzonlab123@127.0.0.1:5010/cse_finance';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log("Adding STRUCTURE_DETECTED to workflow_state enum...");
    await client.query(`
      DO $$
      BEGIN
        ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'STRUCTURE_DETECTED';
        ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'AGGREGATING';
        ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'VALIDATING';
        ALTER TYPE workflow_state ADD VALUE IF NOT EXISTS 'LOW_CONFIDENCE';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END$$;
    `);
    console.log("Success.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    await client.end();
  }
}

run();
