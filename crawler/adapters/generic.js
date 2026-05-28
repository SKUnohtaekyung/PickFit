'use strict';

// Generic extraction adapter for arbitrary product pages.
// Order: JSON-LD → Open Graph → common product selectors → visible text fallback → image candidates.
// Never executes site APIs, never submits forms, never follows pagination.

const CURRENCY_HINTS = {
  KRW: /(₩|원|krw)/i,
  USD: /(\$|usd)/i,
  JPY: /(¥|円|jpy)/i,
  EUR: /(€|eur)/i,
};

async function extract({ page, url, limits }) {
  const warnings = [];
  const maxTextChars = Math.max(500, Number(limits?.maxTextChars) || 20000);
  const maxImages = Math.max(1, Number(limits?.maxImages) || 12);

  const meta = await readMeta(page).catch((err) => {
    warnings.push(`meta_read_failed:${truncate(err?.message || 'unknown', 80)}`);
    return {};
  });

  // 1) JSON-LD
  const ldData = await readJsonLd(page).catch((err) => {
    warnings.push(`json_ld_failed:${truncate(err?.message || 'unknown', 80)}`);
    return null;
  });

  // 2) common selectors
  const domData = await readDomCandidates(page).catch((err) => {
    warnings.push(`dom_read_failed:${truncate(err?.message || 'unknown', 80)}`);
    return {};
  });

  // 3) text fallback (capped)
  const text = await readVisibleText(page, maxTextChars).catch((err) => {
    warnings.push(`text_read_failed:${truncate(err?.message || 'unknown', 80)}`);
    return '';
  });

  // 4) images
  const imageUrls = await readImageCandidates(page, maxImages, url).catch((err) => {
    warnings.push(`image_read_failed:${truncate(err?.message || 'unknown', 80)}`);
    return [];
  });

  const productName = firstNonEmpty(
    ldData?.name,
    meta.ogTitle,
    domData.title,
    meta.title,
  );

  const brandName = firstNonEmpty(
    ldData?.brand,
    domData.brand,
  );

  const priceCandidates = uniqueNumbers([
    ...(ldData?.prices || []),
    ...domData.prices || [],
    ...extractPricesFromText(text),
  ]).slice(0, 8);

  const currencyCandidates = uniqueStrings([
    ...(ldData?.currencies || []),
    ...domData.currencies || [],
    ...detectCurrencies(text),
  ]).slice(0, 4);

  const description = firstNonEmpty(
    ldData?.description,
    meta.description,
    domData.description,
  );

  const mergedImages = uniqueStrings([
    ...(ldData?.images || []),
    ...(domData.images || []),
    ...(meta.ogImage ? [meta.ogImage] : []),
    ...imageUrls,
  ]).slice(0, maxImages);

  return {
    adapter: 'generic',
    title: productName,
    meta: {
      description: meta.description ?? null,
      ogTitle: meta.ogTitle ?? null,
      ogImage: meta.ogImage ?? null,
    },
    extracted: {
      productName: productName,
      brandName: brandName,
      priceCandidates,
      currencyCandidates,
      imageUrls: mergedImages,
      description: description,
      text: truncate(text, maxTextChars),
    },
    warnings,
  };
}

async function readMeta(page) {
  return page.evaluate(() => {
    const get = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute('content') || el.textContent : null;
    };
    return {
      title: document.title || null,
      description: get('meta[name="description"]') || null,
      ogTitle: get('meta[property="og:title"]') || null,
      ogImage: get('meta[property="og:image"]') || null,
    };
  });
}

async function readJsonLd(page) {
  const blocks = await page.$$eval(
    'script[type="application/ld+json"]',
    (scripts) => scripts.map((s) => s.textContent || ''),
  );

  let name = null;
  let brand = null;
  let description = null;
  const prices = [];
  const currencies = [];
  const images = [];

  for (const raw of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const graph = Array.isArray(node['@graph']) ? node['@graph'] : [node];
      for (const item of graph) {
        if (!item || typeof item !== 'object') continue;
        const type = item['@type'];
        const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
        if (!isProduct) continue;
        if (!name && typeof item.name === 'string') name = item.name;
        if (!brand) {
          if (typeof item.brand === 'string') brand = item.brand;
          else if (item.brand && typeof item.brand.name === 'string') brand = item.brand.name;
        }
        if (!description && typeof item.description === 'string') description = item.description;
        if (item.image) {
          const imgs = Array.isArray(item.image) ? item.image : [item.image];
          for (const img of imgs) {
            if (typeof img === 'string') images.push(img);
            else if (img && typeof img.url === 'string') images.push(img.url);
          }
        }
        const offers = item.offers
          ? (Array.isArray(item.offers) ? item.offers : [item.offers])
          : [];
        for (const offer of offers) {
          if (!offer || typeof offer !== 'object') continue;
          const price = parseFloat(offer.price ?? offer.lowPrice ?? offer.highPrice);
          if (!isNaN(price)) prices.push(price);
          if (typeof offer.priceCurrency === 'string') currencies.push(offer.priceCurrency.toUpperCase());
        }
      }
    }
  }

  return { name, brand, description, prices, currencies, images };
}

async function readDomCandidates(page) {
  return page.evaluate(() => {
    const get = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return (el.getAttribute('content') || el.textContent || '').trim() || null;
    };
    const getAll = (sel) => Array.from(document.querySelectorAll(sel))
      .map((el) => (el.getAttribute('content') || el.textContent || '').trim())
      .filter(Boolean);

    const title = get('[itemprop="name"]') || get('h1');
    const brand = get('[itemprop="brand"]') || get('[class*="brand"]');
    const description = get('[itemprop="description"]') || get('[class*="description"]');

    const priceTexts = [
      ...getAll('[itemprop="price"]'),
      ...getAll('[class*="price"]'),
      ...getAll('[data-price]'),
    ];
    const prices = priceTexts
      .map((t) => parseFloat(String(t).replace(/[^\d.\-]/g, '')))
      .filter((n) => !isNaN(n) && n > 0)
      .slice(0, 8);

    const currencyAttr = document.querySelector('[itemprop="priceCurrency"]');
    const currencies = currencyAttr
      ? [(currencyAttr.getAttribute('content') || currencyAttr.textContent || '').trim().toUpperCase()].filter(Boolean)
      : [];

    return { title, brand, description, prices, currencies, images: [] };
  });
}

async function readVisibleText(page, maxTextChars) {
  const text = await page.evaluate(() => {
    const root = document.querySelector('main, article, [role="main"]') || document.body;
    if (!root) return '';
    return (root.innerText || '').replace(/\s+/g, ' ').trim();
  });
  return typeof text === 'string' ? text.slice(0, maxTextChars) : '';
}

async function readImageCandidates(page, maxImages, baseUrl) {
  const raw = await page.evaluate((limit) => {
    const urls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src;
      if (src) urls.add(src);
    });
    document.querySelectorAll('source').forEach((source) => {
      const src = source.getAttribute('srcset');
      if (src) {
        src.split(',').forEach((entry) => {
          const candidate = entry.trim().split(' ')[0];
          if (candidate) urls.add(candidate);
        });
      }
    });
    return Array.from(urls).slice(0, limit * 2);
  }, maxImages);

  const resolved = [];
  for (const candidate of raw) {
    try {
      const abs = new URL(candidate, baseUrl).toString();
      if (/^https?:/i.test(abs)) resolved.push(abs);
    } catch {
      // ignore malformed URLs
    }
  }
  return resolved.slice(0, maxImages);
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

function uniqueNumbers(arr) {
  const seen = new Set();
  const out = [];
  for (const n of arr) {
    if (typeof n !== 'number' || isNaN(n)) continue;
    const key = Math.round(n * 100);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function uniqueStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    if (typeof s !== 'string' || s === '') continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function extractPricesFromText(text) {
  if (!text) return [];
  // Pull standalone numbers immediately adjacent to currency markers.
  const matches = text.match(/(\d{3,}(?:[,.\s]\d{3})*(?:\.\d{1,2})?)/g) || [];
  return matches
    .map((m) => parseFloat(m.replace(/[,\s]/g, '')))
    .filter((n) => !isNaN(n) && n > 100 && n < 100_000_000)
    .slice(0, 6);
}

function detectCurrencies(text) {
  if (!text) return [];
  const found = [];
  for (const [code, pattern] of Object.entries(CURRENCY_HINTS)) {
    if (pattern.test(text)) found.push(code);
  }
  return found;
}

function truncate(s, max) {
  if (typeof s !== 'string') return '';
  return s.length <= max ? s : s.slice(0, max);
}

module.exports = { extract };
