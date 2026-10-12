import { Router } from 'express';
import { lookupBarcode, rawgDetails, searchGames } from './lookup.js';
import { requireAuth } from './middleware.js';
import { Catalog, Game } from './models.js';

const LOOKUP_VERSION = 3;

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

function cleanBarcode(value) {
  return String(value || '').replace(/\D/g, '');
}

gamesRouter.get('/', async (req, res) => {
  const games = await Game.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json(games);
});

gamesRouter.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    return res.status(400).json({ message: 'Wpisz co najmniej 2 znaki.' });
  }
  res.json(await searchGames(query));
});

gamesRouter.post('/lookup', async (req, res) => {
  const barcode = cleanBarcode(req.body.barcode);
  if (barcode.length < 8) {
    return res.status(400).json({ message: 'Zeskanuj lub wpisz kod z pudełka.' });
  }

  const owned = await Game.findOne({ user: req.userId, barcode });
  if (owned) {
    return res.json({ barcode, candidates: [], game: owned, already: true });
  }

  const cached = await Catalog.findOne({ barcode, lookupVersion: LOOKUP_VERSION });
  if (cached) {
    return res.json({ barcode, candidates: cached.candidates });
  }

  const result = await lookupBarcode(barcode);
  if (result.candidates.length) {
    await Catalog.findOneAndUpdate(
      { barcode },
      { barcode, candidates: result.candidates, lookupVersion: LOOKUP_VERSION },
      { upsert: true },
    );
  }
  res.json(result);
});

gamesRouter.get('/:id', async (req, res) => {
  const game = await Game.findOne({ _id: req.params.id, user: req.userId });
  if (!game) return res.status(404).json({ message: 'Nie ma takiej gry.' });
  res.json(game);
});

gamesRouter.post('/', async (req, res) => {
  const barcode = cleanBarcode(req.body.barcode);
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Brak tytułu gry.' });

  if (barcode) {
    const owned = await Game.findOne({ user: req.userId, barcode });
    if (owned) return res.json({ game: owned, already: true });
  }

  let details = null;
  if (req.body.source === 'rawg' && req.body.externalId) {
    details = await rawgDetails(req.body.externalId);
  }

  const game = await Game.create({
    user: req.userId,
    barcode,
    title: (details && details.title) || title,
    description: (details && details.description) || req.body.description || '',
    coverUrl: req.body.coverUrl || (details && details.coverUrl) || '',
    released: (details && details.released) || req.body.released || '',
    platforms: Array.isArray(req.body.platforms)
      ? req.body.platforms.map((name) => String(name || '').trim()).filter(Boolean)
      : (details && details.platforms) || [],
    genres: (details && details.genres) || req.body.genres || [],
    rating: details ? details.rating : (req.body.rating ?? null),
    source: req.body.source || 'manual',
    externalId: req.body.externalId || '',
  });
  res.status(201).json({ game, already: false });
});

gamesRouter.delete('/:id', async (req, res) => {
  const game = await Game.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!game) return res.status(404).json({ message: 'Nie ma takiej gry.' });
  res.json({ ok: true });
});
