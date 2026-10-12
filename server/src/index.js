import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './auth.js';
import { gamesRouter } from './games.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'games-lib' });
});

app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);

const publicDir =
  process.env.PUBLIC_DIR ||
  path.resolve(__dirname, '../../client/dist/client/browser');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Coś poszło nie tak.' });
});

const port = Number(process.env.PORT || 3000);
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/games-lib';

mongoose.connect(uri).then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`API na http://0.0.0.0:${port}`);
    if (fs.existsSync(publicDir)) {
      console.log(`UI z ${publicDir}`);
    }
  });
}).catch((error) => {
  console.error('Brak połączenia z MongoDB:', error.message);
  process.exit(1);
});
