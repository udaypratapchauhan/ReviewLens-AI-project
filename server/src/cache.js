import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_CACHE_PATH = path.resolve(__dirname, '../.cache/analysis.json');

export function createCache(filePath = DEFAULT_CACHE_PATH) {
  const store = new Map();

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) {
            store.set(k, v);
          }
        }
      }
    }
  } catch {
    // Missing, empty or invalid JSON starts empty without throwing
  }

  return {
    get(hash) {
      return store.get(hash);
    },
    set(hash, analysis) {
      if (hash && analysis) {
        store.set(hash, analysis);
      }
    },
    save() {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${filePath}.tmp`;
      const data = JSON.stringify(Object.fromEntries(store), null, 2);
      fs.writeFileSync(tmpPath, data, 'utf8');
      fs.renameSync(tmpPath, filePath);
    }
  };
}
