function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function upcCandidates(barcode) {
  const code = String(barcode || '').replace(/\D/g, '');
  const list = [];
  if (code.length === 12 || code.length === 13) list.push(code);
  if (code.length === 13 && code.startsWith('0')) list.push(code.slice(1));
  return list;
}

async function fetchProduct(token, params) {
  const query = new URLSearchParams({ t: token, ...params });
  const response = await fetch(`https://www.pricecharting.com/api/product?${query}`);
  if (!response.ok) return null;
  const data = await response.json();
  if (data.status !== 'success' || !data.id) return null;
  return data;
}

export async function usedPrice(game) {
  const token = process.env.PRICECHARTING_TOKEN;
  if (!token || !game.title) return null;

  let product = null;
  for (const upc of upcCandidates(game.barcode)) {
    product = await fetchProduct(token, { upc });
    if (product) break;
  }
  if (!product) {
    const platform = Array.isArray(game.platforms) && game.platforms[0] ? ` ${game.platforms[0]}` : '';
    product = await fetchProduct(token, { q: `${game.title}${platform}`.trim() });
  }
  if (!product) return null;

  return {
    priceLoose: cents(product['loose-price']),
    priceCib: cents(product['cib-price']),
    priceNew: cents(product['new-price']),
    priceName: product['product-name'] || '',
    priceConsole: product['console-name'] || '',
    priceId: String(product.id),
    priceUpdatedAt: new Date(),
  };
}
