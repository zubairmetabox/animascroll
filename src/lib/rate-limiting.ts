import { sql } from "@/lib/db";

const RATE_WINDOW_SEC = 60;
const RATE_LIMIT = 20; // requests per user per minute

let tableReady = false;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    )
  `.catch(() => {});
}

/**
 * Returns true if the request is within the rate limit, false if exceeded.
 * Uses a sliding window of RATE_WINDOW_SEC seconds with a max of RATE_LIMIT requests.
 */
export async function checkRateLimit(key: string): Promise<boolean> {
  if (!tableReady) {
    await ensureTable();
    tableReady = true;
  }
  const window = Math.floor(Date.now() / 1000 / RATE_WINDOW_SEC);
  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${window}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;
  return (rows[0].count as number) <= RATE_LIMIT;
}
