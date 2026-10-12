const PLATFORM_RULES = [
  [/playstation\s*5|\bps5\b/i, 'PlayStation 5'],
  [/playstation\s*4|\bps4\b/i, 'PlayStation 4'],
  [/playstation\s*3|\bps3\b/i, 'PlayStation 3'],
  [/playstation\s*2|\bps2\b/i, 'PlayStation 2'],
  [/playstation\s*vita|\bps vita\b/i, 'PlayStation Vita'],
  [/\bpsp\b/i, 'PSP'],
  [/xbox series/i, 'Xbox Series X|S'],
  [/xbox one/i, 'Xbox One'],
  [/xbox 360/i, 'Xbox 360'],
  [/nintendo switch|\bswitch\b/i, 'Nintendo Switch'],
  [/wii u/i, 'Wii U'],
  [/\bwii\b/i, 'Wii'],
  [/nintendo 3ds|\b3ds\b/i, 'Nintendo 3DS'],
  [/nintendo ds|\bnds\b/i, 'Nintendo DS'],
  [/game boy advance|\bgba\b/i, 'Game Boy Advance'],
  [/\bpc\b|windows/i, 'PC'],
];

function guessPlatforms(text) {
  const found = [];
  for (const [pattern, name] of PLATFORM_RULES) {
    if (pattern.test(text) && !found.includes(name)) found.push(name);
  }
  return found;
}

function mapRawg(game) {
  const platforms = (game.platforms || []).map((item) => item.platform && item.platform.name).filter(Boolean);
  return {
    title: game.name || '',
    description: game.description_raw || '',
    coverUrl: game.background_image || '',
    released: game.released || '',
    platforms: platforms.length ? platforms : guessPlatforms(game.name || ''),
    genres: (game.genres || []).map((genre) => genre.name).filter(Boolean),
    rating: typeof game.rating === 'number' ? game.rating : null,
    source: 'rawg',
    externalId: String(game.id),
  };
}

async function searchRawg(query) {
  const key = process.env.RAWG_API_KEY;
  if (!key || !query) return [];
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=8`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results || []).map(mapRawg);
}

export async function rawgDetails(id) {
  const key = process.env.RAWG_API_KEY;
  if (!key || !id) return null;
  const response = await fetch(`https://api.rawg.io/api/games/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
  if (!response.ok) return null;
  return mapRawg(await response.json());
}

function productCandidate(item, source, barcode) {
  const text = [item.title, item.brand, item.manufacturer, item.category, item.description]
    .filter(Boolean)
    .join(' ');
  return {
    title: item.title || '',
    description: item.description || '',
    coverUrl: (item.images && item.images[0]) || '',
    released: '',
    platforms: guessPlatforms(text),
    genres: [],
    rating: null,
    source,
    externalId: barcode,
  };
}

async function lookupBarcodeFinder(barcode) {
  const response = await fetch(`https://www.barcodefinder.info/v1/product/${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'games-lib' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.product || !data.product.title) return null;
  return productCandidate(data.product, 'barcodefinder', barcode);
}

async function lookupUpc(barcode) {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'games-lib' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const item = data.items && data.items[0];
  if (!item || !item.title) return null;
  return productCandidate(item, 'upcitemdb', barcode);
}

async function lookupScandex(barcode) {
  const token = process.env.SCANDEX_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://scandex.gamery.app/api/v2/lookup?value=${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', Authorization: token, 'User-Agent': 'games-lib' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const meta = data.igdb_metadata;
  if (!meta || !meta.name) return null;
  return {
    title: meta.name,
    description: '',
    coverUrl: '',
    released: '',
    platforms: meta.platform && meta.platform.name ? [meta.platform.name] : [],
    genres: [],
    rating: null,
    source: 'scandex',
    externalId: meta.id ? String(meta.id) : barcode,
  };
}

export async function searchGames(query) {
  const candidates = await searchRawg(query);
  return { barcode: '', candidates };
}

function withBoxPlatform(candidates, boxPlatforms, coverUrl) {
  return candidates.map((candidate) => ({
    ...candidate,
    platforms: boxPlatforms,
    coverUrl: coverUrl || candidate.coverUrl || '',
  }));
}

export async function lookupBarcode(barcode) {
  const scandex = await lookupScandex(barcode);
  const boxed = await lookupBarcodeFinder(barcode) || await lookupUpc(barcode);
  const product = scandex || boxed;
  const boxCover = (boxed && boxed.coverUrl) || '';
  const boxPlatforms = scandex && scandex.platforms.length
    ? scandex.platforms
    : (boxed && boxed.platforms) || [];
  let candidates = [];
  if (product && product.title) {
    candidates = withBoxPlatform(
      await searchRawg(product.title),
      boxPlatforms,
      boxCover,
    );
  }
  if (!candidates.length && product && product.title) {
    candidates = [{ ...product, coverUrl: boxCover, platforms: boxPlatforms }];
  }
  return { barcode, candidates };
}
