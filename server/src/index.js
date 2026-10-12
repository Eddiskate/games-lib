import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { gamesRouter } from './games.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Coś poszło nie tak.' });
});

const port = Number(process.env.PORT || 3000);
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/games-lib';

mongoose.connect(uri).then(() => {
  app.listen(port, () => {
    console.log(`API na http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Brak połączenia z MongoDB:', error.message);
  process.exit(1);
});
