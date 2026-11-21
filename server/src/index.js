import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { createCache } from './cache.js';

// Load .env from workspace root or server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const port = process.env.PORT || 3001;
const cache = createCache();
const app = createApp({ cache });

app.listen(port, () => {
  console.log(`ReviewLens server running on port ${port}`);
});

export { app };
