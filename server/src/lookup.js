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

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`[lookup] ${url.split('?')[0]} ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchRawg(query) {
  const key = process.env.RAWG_API_KEY;
  if (!key || !query) return [];
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=8`;
  const data = await fetchJson(url);
  return ((data && data.results) || []).map(mapRawg);
}

export async function rawgDetails(id) {
  const key = process.env.RAWG_API_KEY;
  if (!key || !id) return null;
  const data = await fetchJson(`https://api.rawg.io/api/games/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
  return data ? mapRawg(data) : null;
}

function imageList(images) {
  if (!Array.isArray(images)) return [];
  const urls = images.map((image) => {
    if (typeof image === 'string') return image;
    return (image && (image.url || image.src)) || '';
  }).map((url) => String(url || '').trim()).filter(Boolean);
  return [...new Set(urls)];
}

function productCandidate(item, source, barcode) {
  const text = [item.title, item.brand, item.manufacturer, item.category, item.description]
    .filter(Boolean)
    .join(' ');
  const boxImages = imageList(item.images);
  return {
    title: item.title || '',
    description: item.description || '',
    coverUrl: boxImages[0] || '',
    boxImages,
    released: '',
    platforms: guessPlatforms(text),
    genres: [],
    rating: null,
    source,
    externalId: barcode,
  };
}

async function lookupBarcodeFinder(barcode) {
  const data = await fetchJson(`https://www.barcodefinder.info/v1/product/${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'games-lib' },
  });
  if (!data || !data.product || !data.product.title) return null;
  return productCandidate(data.product, 'barcodefinder', barcode);
}

async function lookupUpc(barcode) {
  const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'games-lib' },
  });
  const item = data && data.items && data.items[0];
  if (!item || !item.title) return null;
  return productCandidate(item, 'upcitemdb', barcode);
}

async function lookupOpenProducts(barcode) {
  const data = await fetchJson(`https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'games-lib' },
  });
  const product = data && data.product;
  const title = product && (product.product_name || product.product_name_pl || product.product_name_en);
  if (!title) return null;
  return productCandidate({
    title,
    brand: product.brands,
    category: product.categories,
    description: '',
    images: [product.image_front_url, product.image_url].filter(Boolean),
  }, 'openproductsfacts', barcode);
}

async function lookupGoUpc(barcode) {
  const key = process.env.GO_UPC_API_KEY;
  if (!key) return null;
  const data = await fetchJson(`https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
  });
  const product = data && data.product;
  if (!product || !product.name) return null;
  return productCandidate({
    title: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
    images: product.imageUrl ? [product.imageUrl] : [],
  }, 'goupc', barcode);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; games-lib)',
        Accept: 'text/html',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      },
    });
    if (!response.ok) return '';
    return await response.text();
  } catch (error) {
    console.error(`[lookup] ${url.split('?')[0]} ${error.message}`);
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function unescapeJson(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

async function lookupXkom(barcode) {
  const html = await fetchText(`https://www.x-kom.pl/szukaj?q=${encodeURIComponent(barcode)}`);
  const at = html.indexOf(`"producerCode":"${barcode}`);
  if (at < 0) return null;
  const window = html.slice(Math.max(0, at - 4500), at + 1600);
  const nameMatch = window.match(/"descriptiveProductName":"((?:\\.|[^"\\])*)"/);
  if (!nameMatch) return null;
  const title = unescapeJson(nameMatch[1]).trim();
  if (!title) return null;
  const photoMatch = window.match(/"photo":\{"url":"([^"]+)"/);
  const platformMatch = window.match(/"shortName":"Platforma"[\s\S]{0,220}?"shortName":"((?:\\.|[^"\\])*)"/);
  const platformText = platformMatch ? unescapeJson(platformMatch[1]).trim() : '';
  const platforms = platformText
    ? (guessPlatforms(platformText).length ? guessPlatforms(platformText) : [platformText])
    : guessPlatforms(title);
  const photo = photoMatch ? photoMatch[1] : '';
  return {
    title,
    description: '',
    coverUrl: photo,
    boxImages: photo ? [photo] : [],
    released: '',
    platforms,
    genres: [],
    rating: null,
    source: 'xkom',
    externalId: barcode,
  };
}

function rawgQuery(title) {
  const cleaned = title
    .replace(/\s+[+|].*$/, '')
    .replace(/\s+-\s+edycja\b.*$/i, '')
    .replace(/^(?:microsoft\s+|sony\s+)?(?:xbox(?:\s+series(?:\s+[xs])?|\s+one|\s+360)?|playstation(?:\s*[2345])?|ps[2345]|nintendo(?:\s+switch)?)\s+/i, '')
    .trim();
  return cleaned.length >= 3 ? cleaned : title;
}

async function lookupPriceCharting(barcode) {
  const token = process.env.PRICECHARTING_TOKEN;
  if (!token) return null;
  const data = await fetchJson(`https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&upc=${encodeURIComponent(barcode)}`);
  if (!data || data.status !== 'success' || !data['product-name']) return null;
  return productCandidate({
    title: data['product-name'],
    category: data['console-name'],
    description: '',
    images: [],
  }, 'pricecharting', barcode);
}

async function lookupScandex(barcode) {
  const token = process.env.SCANDEX_TOKEN;
  if (!token) return null;
  const data = await fetchJson(`https://scandex.gamery.app/api/v2/lookup?value=${encodeURIComponent(barcode)}`, {
    headers: { Accept: 'application/json', Authorization: token, 'User-Agent': 'games-lib' },
  });
  const meta = data && data.igdb_metadata;
  if (!meta || !meta.name) return null;
  return {
    title: meta.name,
    description: '',
    coverUrl: '',
    boxImages: [],
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

function withBoxPlatform(candidates, boxPlatforms, boxImages) {
  return candidates.map((candidate) => {
    const artwork = candidate.coverUrl || '';
    const extras = boxImages.filter((url) => url && url !== artwork);
    return {
      ...candidate,
      platforms: boxPlatforms,
      coverUrl: artwork || boxImages[0] || '',
      boxImages: artwork ? extras : boxImages.slice(1),
    };
  });
}

function describeHit(label, product) {
  if (!product || !product.title) return `${label}: brak tego kodu`;
  const platform = product.platforms && product.platforms[0] ? `, ${product.platforms[0]}` : '';
  return `${label}: ${product.title}${platform}`;
}

function barcodeForms(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  const forms = [];
  const add = (value) => {
    if (value && value.length >= 8 && value.length <= 14 && !forms.includes(value)) forms.push(value);
  };
  add(code);
  if (code.length === 13 && code.startsWith('0')) add(code.slice(1));
  if (code.length === 12) add(`0${code}`);
  if (code.length === 14 && code.startsWith('0')) add(code.slice(1));
  return forms;
}

async function firstProduct(lookup, barcode) {
  for (const code of barcodeForms(barcode)) {
    const product = await lookup(code);
    if (product && product.title) return product;
  }
  return null;
}

function collectImages(products) {
  return [...new Set(products.flatMap((product) => (product && product.boxImages) || []))];
}

export async function lookupBarcode(barcode) {
  const started = Date.now();
  console.log(`[lookup] ${barcode} start`);
  const [scandex, xkom, goUpc, priceCharting, finder, upc, openProducts] = await Promise.all([
    firstProduct(lookupScandex, barcode),
    firstProduct(lookupXkom, barcode),
    firstProduct(lookupGoUpc, barcode),
    firstProduct(lookupPriceCharting, barcode),
    firstProduct(lookupBarcodeFinder, barcode),
    firstProduct(lookupUpc, barcode),
    firstProduct(lookupOpenProducts, barcode),
  ]);
  const boxed = goUpc || finder || upc || openProducts;
  const product = scandex || xkom || priceCharting || boxed;
  const boxImages = collectImages([xkom, goUpc, finder, upc, openProducts]);
  const boxPlatforms = (scandex && scandex.platforms.length && scandex.platforms)
    || (xkom && xkom.platforms.length && xkom.platforms)
    || (priceCharting && priceCharting.platforms.length && priceCharting.platforms)
    || (boxed && boxed.platforms)
    || [];
  let candidates = [];
  if (product && product.title) {
    const query = product.source === 'xkom' ? rawgQuery(product.title) : product.title;
    candidates = withBoxPlatform(
      await searchRawg(query),
      boxPlatforms,
      boxImages,
    );
  }
  if (!candidates.length && product && product.title) {
    candidates = [{
      ...product,
      coverUrl: boxImages[0] || product.coverUrl || '',
      boxImages: boxImages.slice(1),
      platforms: boxPlatforms,
    }];
  }
  const trace = [
    describeHit('x-kom', xkom),
    process.env.SCANDEX_TOKEN ? describeHit('ScanDex', scandex) : 'ScanDex: brak tokenu',
    process.env.GO_UPC_API_KEY ? describeHit('Go-UPC', goUpc) : 'Go-UPC: brak klucza',
    process.env.PRICECHARTING_TOKEN ? describeHit('PriceCharting', priceCharting) : 'PriceCharting: brak tokenu',
    describeHit('BarcodeFinder', finder),
    describeHit('UPC Item DB', upc),
    describeHit('Open Products Facts', openProducts),
    process.env.RAWG_API_KEY
      ? `RAWG: ${candidates.filter((item) => item.source === 'rawg').length} propozycji`
      : 'RAWG: brak klucza',
  ];
  console.log(`[lookup] ${barcode} ${trace.join(' | ')} ${Date.now() - started}ms`);
  return { barcode, candidates, trace };
}
