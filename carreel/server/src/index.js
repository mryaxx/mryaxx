import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = createApp({
  dataFile: path.join(root, '../data/db.json'),
  uploadDir: path.join(root, '../uploads'),
  webDist: path.join(root, '../../web/dist'),
});
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`CarReel API on http://localhost:${port}`));
