const PLATFORM_RULES = [
  [/playstation\s*5|\bps5\b/i, 'PlayStation 5'],
  [/playstation\s*4|\bps4\b/i, 'PlayStation 4'],
  [/playstation\s*3|\bps3\b/i, 'PlayStation 3'],
  [/playstation\s*2|\bps2\b/i, 'PlayStation 2'],
  [/playstation\s*vita|\bps vita\b/i, 'PlayStation Vita'],
  [/\bpsp\b/i, 'PSP'],
  [/xbox series|\bxsx\b|\bxss\b/i, 'Xbox Series X|S'],
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
  const head = [item.title, item.brand, item.manufacturer, item.category].filter(Boolean).join(' ');
  const fromTitle = guessPlatforms(head);
  const boxImages = imageList(item.images);
  return {
    title: item.title || '',
    description: item.description || '',
    coverUrl: boxImages[0] || '',
    boxImages,
    released: '',
    platforms: fromTitle.length ? fromTitle : guessPlatforms(item.description || ''),
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
  if (item && item.title) {
    return catalogCandidate(item.title, {
      brand: item.brand,
      category: item.category,
      description: item.description,
      images: item.images,
    }, 'upcitemdb', barcode);
  }
  return lookupUpcPage(barcode);
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

const PLATFORM_TAIL = '(?:(?:for|für|pour|na)\\s+)?(?:nintendo\\s+switch|switch|playstation\\s*[2345]|ps[2345]|xbox(?:\\s+series\\s+[xs]|\\s+one|\\s+360)?|xsx|xss)';

function retailGameTitle(title, brand) {
  let name = String(title || '')
    .replace(/\s+game\s+code\s*$/i, '')
    .replace(/\s*\[[^\]]*(?:german|deutsche|deutsch|europe|european|\beu\b|usa|\bus\b|\buk\b|polish|polska|polnisch|french|\bfr\b|italian|spanish|spanisch)[^\]]*\]\s*/ig, ' ')
    .replace(/\s*[-–]\s*(racing|adventure|action|rpg|sports|shooter|fighting|platformer)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (brand && name.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
    name = name.slice(brand.length).trim();
  }
  const trims = [
    new RegExp(`\\s*[\\[(]${PLATFORM_TAIL}[\\])]$`, 'i'),
    new RegExp(`(?:\\s*[-–:]\\s*|\\s+)${PLATFORM_TAIL}(?:\\s+game)?$`, 'i'),
    new RegExp(`^${PLATFORM_TAIL}\\s+`, 'i'),
    /^(?:nintendo|sony|microsoft)\s+/i,
  ];
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const pattern of trims) {
      const next = name.replace(pattern, '').trim();
      const kept = next.length >= 3 && (next.includes(' ') || next.length >= 10);
      if (next !== name && kept) {
        name = next.replace(/^[\s\-–:+]+/, '').replace(/[\s\-–:+]+$/, '').trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  name = name.replace(/\bAllStar\b/g, 'All-Star');
  return name || title;
}

function catalogCandidate(rawTitle, fields, source, barcode) {
  const raw = String(rawTitle || '').trim();
  if (!raw) return null;
  return productCandidate({
    title: retailGameTitle(raw, fields.brand),
    brand: fields.brand,
    category: [fields.category, raw].filter(Boolean).join(' '),
    description: fields.description || '',
    images: fields.images || [],
  }, source, barcode);
}

function goUpcCandidate(product, barcode) {
  return catalogCandidate(product.name || product.title, {
    brand: product.brand,
    category: product.category,
    description: product.description,
    images: product.imageUrl ? [product.imageUrl] : product.images,
  }, 'goupc', barcode);
}

function canonicalBarcode(code) {
  let digits = String(code || '').replace(/\D/g, '');
  if (digits.length === 14 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 13 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function sameBarcode(left, right) {
  const a = canonicalBarcode(left);
  const b = canonicalBarcode(right);
  return a.length >= 8 && a === b;
}

async function lookupUpcPage(barcode) {
  const html = await fetchText(`https://www.upcitemdb.com/upc/${encodeURIComponent(barcode)}`, {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,pl;q=0.7',
  });
  const title = html.match(/<title>(?:EAN|UPC)\s+(\d+)\s+-\s+([^|<]+?)\s*\|\s*upcitemdb\.com<\/title>/i);
  if (!title || !sameBarcode(title[1], barcode)) return null;
  const name = decodeHtml(title[2]);
  if (!name || /^(video game|unknown|n\/a)$/i.test(name)) return null;
  const crumb = html.match(/<ol class="category breadcrumb">([\s\S]*?)<\/ol>/i);
  const category = crumb ? decodeHtml(crumb[1]) : '';
  if (category && /food|grocery|snack|beverage|household|beauty|apparel/i.test(category) && !/game|spiel|software|jeu/i.test(category)) {
    return null;
  }
  const image = html.match(/<img class="product" src="(https?:\/\/[^"]+)"/i);
  return catalogCandidate(name, {
    category,
    images: image ? [image[1]] : [],
  }, 'upcitemdb', barcode);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function lookupGoUpcPage(barcode) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,pl;q=0.7',
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const html = await fetchText(`https://go-upc.com/search?q=${encodeURIComponent(barcode)}`, headers);
    const listed = html.match(/<td class="metadata-label">(?:EAN|UPC|GTIN)<\/td>\s*<td>(\d+)<\/td>/i);
    const name = html.match(/<h1 class="product-name">([^<]+)<\/h1>/);
    if (listed && sameBarcode(listed[1], barcode) && name) {
      const brand = html.match(/<td class="metadata-label">Brand<\/td>\s*<td>([^<]*)<\/td>/i);
      const image = html.match(/<img src="(https:\/\/go-upc\.s3\.amazonaws\.com\/images\/[^"]+)"/);
      const description = html.match(/<h2>\s*Description\s*<\/h2>\s*<span>([\s\S]*?)<\/span>/i);
      return goUpcCandidate({
        name: decodeHtml(name[1]),
        brand: brand ? decodeHtml(brand[1]) : '',
        description: description ? decodeHtml(description[1]) : '',
        imageUrl: image ? image[1] : '',
      }, barcode);
    }
    if (listed && name && !sameBarcode(listed[1], barcode)) return null;
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return null;
}

async function lookupGoUpc(barcode) {
  const key = process.env.GO_UPC_API_KEY;
  if (key) {
    const data = await fetchJson(`https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
    });
    const product = data && data.product;
    if (product && product.name) return goUpcCandidate(product, barcode);
  }
  return lookupGoUpcPage(barcode);
}

async function fetchText(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; games-lib)',
        Accept: 'text/html',
        'Accept-Language': 'pl-PL,pl;q=0.9',
        ...extraHeaders,
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
  const cleaned = retailGameTitle(title, '')
    .replace(/\s+[+|].*$/, '')
    .replace(/\s+-\s+edycja\b.*$/i, '')
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
      platforms: boxPlatforms.length ? boxPlatforms : candidate.platforms,
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
  const ranked = [scandex, xkom, goUpc, priceCharting, upc, finder, openProducts].filter((item) => item && item.title);
  const product = ranked[0] || null;
  const boxImages = collectImages([xkom, goUpc, priceCharting, finder, upc, openProducts]);
  const boxPlatforms = ranked.map((item) => item.platforms).find((list) => list && list.length) || [];
  let candidates = [];
  if (product && product.title) {
    candidates = withBoxPlatform(
      await searchRawg(rawgQuery(product.title)),
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
    describeHit('Go-UPC', goUpc),
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
