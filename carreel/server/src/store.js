import fs from 'node:fs';
import path from 'node:path';
import { buildSeed } from './seed.js';

// Minimal JSON-file store. Swap for Postgres in production (see docs/ARCHITECTURE.md).
export function createStore(file) {
  let db;
  if (file && fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    db = buildSeed();
  }
  let timer = null;
  const save = () => {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(db));
    }, 200);
  };
  save();
  let seq = Date.now();
  const id = (prefix) => `${prefix}_${(seq++).toString(36)}`;
  return { db, save, id };
}
