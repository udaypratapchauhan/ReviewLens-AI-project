import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { createCache } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env only if the file exists (on Render variables come from the dashboard)
const rootEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync('.env')) {
  dotenv.config();
}

const port = process.env.PORT || 3001;
const cache = createCache();
const app = createApp({ cache });

app.listen(port, () => {
  console.log(`ReviewLens server running on port ${port}`);
});

export { app };
