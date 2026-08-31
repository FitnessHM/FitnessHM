import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './schema';
import { seedExampleBlockIfEmpty } from './seed';

beforeEach(async () => {
  await Promise.all([db.blocks.clear(), db.efforts.clear(), db.sessions.clear()]);
});

test('seeds one example block with an effort and prescribed sessions when empty', async () => {
  await seedExampleBlockIfEmpty();
  const blocks = await db.blocks.toArray();
  expect(blocks).toHaveLength(1);

  const efforts = await db.efforts.where('blockId').equals(blocks[0].id).toArray();
  expect(efforts.length).toBeGreaterThanOrEqual(1);

  const sessions = await db.sessions.where('blockId').equals(blocks[0].id).toArray();
  expect(sessions.length).toBeGreaterThanOrEqual(3);
});

test('does nothing if a block already exists', async () => {
  await seedExampleBlockIfEmpty();
  const firstRunBlocks = await db.blocks.toArray();
  await seedExampleBlockIfEmpty();
  const secondRunBlocks = await db.blocks.toArray();
  expect(secondRunBlocks).toHaveLength(firstRunBlocks.length);
});
