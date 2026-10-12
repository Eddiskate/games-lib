import { Router } from 'express';
import { lookupBarcode, rawgDetails, searchGames } from './lookup.js';
import { requireAuth } from './middleware.js';
import { Catalog, Game } from './models.js';
import { usedPrice } from './prices.js';

const LOOKUP_VERSION = 5;
const PLAY_STATUSES = ['nowa', 'w toku', 'ukończona'];
const PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function attachPrice(game) {
  if (!process.env.PRICECHARTING_TOKEN) return game;
  const updatedAt = game.priceUpdatedAt ? new Date(game.priceUpdatedAt).getTime() : 0;
  if (updatedAt && Date.now() - updatedAt < PRICE_MAX_AGE_MS) return game;
  try {
    const price = await usedPrice(game);
    if (!price) return game;
    Object.assign(game, price);
    await game.save();
  } catch (error) {
    console.error('Cena z PriceCharting:', error.message);
  }
  return game;
}

function cleanUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((url) => String(url || '').trim()).filter(Boolean))];
}

function pickCandidate(game, candidates) {
  if (!candidates || !candidates.length) return null;
  if (game.externalId) {
    const match = candidates.find((item) => String(item.externalId) === String(game.externalId));
    if (match) return match;
  }
  return candidates[0];
}

async function applyFreshDetails(game, candidate) {
  const previousCover = game.coverUrl || '';
  const fetchedBoxes = cleanUrls(candidate && candidate.boxImages);
  const boxImages = fetchedBoxes.length ? fetchedBoxes : cleanUrls(game.boxImages);
  if (candidate && candidate.platforms && candidate.platforms.length) {
    game.platforms = candidate.platforms;
  }
  if (candidate && candidate.source === 'rawg' && candidate.externalId) {
    game.source = 'rawg';
    game.externalId = String(candidate.externalId);
  }

  const externalId = (candidate && candidate.source === 'rawg' && candidate.externalId) || game.externalId;
  let details = null;
  if (game.source === 'rawg' && externalId) {
    details = await rawgDetails(externalId);
  }
  if (details && details.coverUrl) game.coverUrl = details.coverUrl;
  else if (candidate && candidate.coverUrl) game.coverUrl = candidate.coverUrl;
  if (details && details.description) game.description = details.description;
  if (details && details.released) game.released = details.released;
  if (details && details.genres && details.genres.length) game.genres = details.genres;
  if (details && details.rating != null) game.rating = details.rating;

  const extras = [...boxImages];
  if (previousCover && previousCover !== game.coverUrl && !extras.includes(previousCover)) {
    extras.unshift(previousCover);
  }
  game.boxImages = extras.filter((url) => url !== game.coverUrl);
  game.artworkChecked = true;
}

async function syncGame(game) {
  try {
    if (game.barcode && String(game.barcode).length >= 8) {
      const result = await lookupBarcode(game.barcode);
      const candidate = pickCandidate(game, result.candidates);
      if (candidate) await applyFreshDetails(game, candidate);
      else await applyFreshDetails(game, null);
    } else {
      await applyFreshDetails(game, null);
    }
  } catch (error) {
    console.error('Synchronizacja gry:', error.message);
  }

  if (process.env.PRICECHARTING_TOKEN) {
    try {
      const price = await usedPrice(game);
      if (price) Object.assign(game, price);
    } catch (error) {
      console.error('Synchronizacja ceny:', error.message);
    }
  }

  await game.save();
}

async function restoreArtwork(game) {
  if (game.artworkChecked || game.source !== 'rawg' || !game.externalId || !process.env.RAWG_API_KEY) {
    return game;
  }
  try {
    const details = await rawgDetails(game.externalId);
    const artwork = details && details.coverUrl;
    if (!artwork) return game;
    if (artwork !== game.coverUrl) {
      const boxImages = Array.isArray(game.boxImages) ? [...game.boxImages] : [];
      if (game.coverUrl && !boxImages.includes(game.coverUrl)) boxImages.unshift(game.coverUrl);
      game.coverUrl = artwork;
      game.boxImages = boxImages.filter((url) => url !== artwork);
    }
    game.artworkChecked = true;
    await game.save();
  } catch (error) {
    console.error('Okładka gry:', error.message);
  }
  return game;
}

function present(game) {
  const body = game.toObject();
  body.pricesEnabled = Boolean(process.env.PRICECHARTING_TOKEN);
  return body;
}

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

function cleanBarcode(value) {
  return String(value || '').replace(/\D/g, '');
}

gamesRouter.get('/', async (req, res) => {
  const games = await Game.find({ user: req.userId }).sort({ createdAt: -1 });
  for (const game of games) await restoreArtwork(game);
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

  console.log(`[lookup] ${barcode} request`);
  try {
    const owned = await Game.findOne({ user: req.userId, barcode });
    if (owned) {
      console.log(`[lookup] ${barcode} already on shelf`);
      return res.json({
        barcode,
        candidates: [],
        game: owned,
        already: true,
        trace: ['Ta gra jest już na półce.'],
      });
    }

    const cached = await Catalog.findOne({ barcode, lookupVersion: LOOKUP_VERSION });
    if (cached && cached.candidates.length) {
      console.log(`[lookup] ${barcode} cache ${cached.candidates.length}`);
      return res.json({
        barcode,
        candidates: cached.candidates,
        trace: ['Wynik z poprzedniego skanu tego kodu.'],
      });
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
  } catch (error) {
    console.error(`[lookup] ${barcode} failed`, error);
    res.status(500).json({ message: 'Nie udało się odczytać kodu.' });
  }
});

gamesRouter.post('/sync', async (req, res) => {
  const games = await Game.find({ user: req.userId }).sort({ createdAt: -1 });
  for (const game of games) await syncGame(game);
  const fresh = await Game.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json({ games: fresh, updated: fresh.length });
});

gamesRouter.get('/:id', async (req, res) => {
  const game = await Game.findOne({ _id: req.params.id, user: req.userId });
  if (!game) return res.status(404).json({ message: 'Nie ma takiej gry.' });
  res.json(present(await attachPrice(await restoreArtwork(game))));
});

gamesRouter.patch('/:id', async (req, res) => {
  if (!PLAY_STATUSES.includes(req.body.playStatus)) {
    return res.status(400).json({ message: 'Nieznany status rozgrywki.' });
  }
  const game = await Game.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { playStatus: req.body.playStatus },
    { new: true },
  );
  if (!game) return res.status(404).json({ message: 'Nie ma takiej gry.' });
  res.json(present(game));
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

  const coverUrl = (details && details.coverUrl) || req.body.coverUrl || '';
  const boxImages = cleanUrls(req.body.boxImages).filter((url) => url !== coverUrl);
  const game = await Game.create({
    user: req.userId,
    barcode,
    title: (details && details.title) || title,
    description: (details && details.description) || req.body.description || '',
    coverUrl,
    boxImages,
    artworkChecked: true,
    released: (details && details.released) || req.body.released || '',
    platforms: Array.isArray(req.body.platforms)
      ? req.body.platforms.map((name) => String(name || '').trim()).filter(Boolean)
      : (details && details.platforms) || [],
    genres: (details && details.genres) || req.body.genres || [],
    rating: details ? details.rating : (req.body.rating ?? null),
    source: req.body.source || 'manual',
    externalId: req.body.externalId || '',
    playStatus: 'nowa',
  });
  res.status(201).json({ game, already: false });
});

gamesRouter.delete('/:id', async (req, res) => {
  const game = await Game.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!game) return res.status(404).json({ message: 'Nie ma takiej gry.' });
  res.json({ ok: true });
});
