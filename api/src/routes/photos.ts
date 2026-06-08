import { Hono } from 'hono';
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { progressPhotos } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const router = new Hono<AuthEnv>();

// GET / — list photos for user, filtered by date range, newest first
router.get('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const conditions = [eq(progressPhotos.userId, user.id)];
  if (startDate) conditions.push(gte(progressPhotos.date, startDate));
  if (endDate) conditions.push(lte(progressPhotos.date, endDate));

  const photos = await db
    .select()
    .from(progressPhotos)
    .where(and(...conditions))
    .orderBy(desc(progressPhotos.date), desc(progressPhotos.createdAt));

  return c.json(photos);
});

// GET /timeline — distinct dates with photo counts for calendar view
router.get('/timeline', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const rows = await db
    .select({
      date: progressPhotos.date,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(progressPhotos)
    .where(eq(progressPhotos.userId, user.id))
    .groupBy(progressPhotos.date)
    .orderBy(desc(progressPhotos.date));

  return c.json(rows);
});

// GET /:id — get single photo
router.get('/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const id = c.req.param('id');

  const photo = await db
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, user.id)))
    .then((r) => r[0]);

  if (!photo) return c.json({ error: 'Not found' }, 404);
  return c.json(photo);
});

// POST /upload — multipart form upload
router.post('/upload', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const body = await c.req.parseBody();

  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json({ error: 'Invalid file type. Accepted: jpg, png, webp, heic' }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large. Maximum 10MB' }, 400);
  }

  const date = (body['date'] as string) ?? new Date().toISOString().slice(0, 10);
  const category = (body['category'] as string) ?? 'other';
  if (!['front', 'side', 'back', 'other'].includes(category)) {
    return c.json({ error: 'Invalid category. Must be front, side, back, or other' }, 400);
  }

  const bodyweight = body['bodyweight'] ? parseFloat(body['bodyweight'] as string) : null;
  const notes = (body['notes'] as string) || null;

  const ext = EXT_MAP[file.type] || extname(file.name || '.jpg');
  const fileId = nanoid();
  const fileName = `${date}_${category}_${fileId}${ext}`;
  const dirPath = join('uploads', 'photos', user.id);
  const filePath = join(dirPath, fileName);

  await mkdir(dirPath, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const id = nanoid();
  const now = new Date();

  await db.insert(progressPhotos).values({
    id,
    userId: user.id,
    date,
    photoUrl: filePath,
    category,
    bodyweight,
    notes,
    createdAt: now,
    updatedAt: now,
  });

  const record = await db
    .select()
    .from(progressPhotos)
    .where(eq(progressPhotos.id, id))
    .then((r) => r[0]);

  return c.json(record, 201);
});

// DELETE /:id — delete photo + file from disk
router.delete('/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const id = c.req.param('id');

  const photo = await db
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, user.id)))
    .then((r) => r[0]);

  if (!photo) return c.json({ error: 'Not found' }, 404);

  // Delete file from disk
  try {
    await unlink(photo.photoUrl);
  } catch {
    // File may already be missing, continue with DB deletion
  }

  await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
  return c.json({ success: true });
});

export default router;
