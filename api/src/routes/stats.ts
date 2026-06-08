import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const router = new Hono();

interface StatsCache {
  stars: number;
  forks: number;
  users: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cache: StatsCache | null = null;

async function fetchGitHubStats(): Promise<{ stars: number; forks: number }> {
  try {
    const res = await fetch('https://api.github.com/repos/nishi7409/ilook.hot', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return { stars: 0, forks: 0 };
    const data = await res.json();
    return {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
    };
  } catch {
    return { stars: 0, forks: 0 };
  }
}

async function fetchUserCount(): Promise<number> {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

// GET /api/stats — public, no auth required
router.get('/', async (c) => {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return c.json({ stars: cache.stars, forks: cache.forks, users: cache.users });
  }

  const [github, userCount] = await Promise.all([fetchGitHubStats(), fetchUserCount()]);

  cache = {
    stars: github.stars,
    forks: github.forks,
    users: userCount,
    fetchedAt: now,
  };

  return c.json({ stars: cache.stars, forks: cache.forks, users: cache.users });
});

export default router;
