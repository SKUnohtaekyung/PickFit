#!/usr/bin/env node
// One-off recon: render Musinsa category page + one PDP, dump structural signals.
// Not part of regression. Phase 1 of Musinsa batch ingest planning.

import { chromium } from 'playwright';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const CATEGORY_URL = 'https://www.musinsa.com/category/001/goods';

async function reconCategory(page) {
  const networkLog = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/api\.musinsa\.com|musinsa\.com\/api/.test(url)) {
      networkLog.push({ method: req.method(), url: url.slice(0, 260) });
    }
  });

  await page.goto(CATEGORY_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);

  const anchors = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (!/products?\/\d+|goods\/\d+/.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
      if (out.length >= 20) break;
    }
    return out;
  });

  const cardSignals = await page.evaluate(() => {
    const card = document.querySelector('[data-product-id], [data-goods-no], [data-mds-rid]');
    if (!card) return null;
    return {
      tag: card.tagName,
      attrs: Object.fromEntries(
        Array.from(card.attributes).slice(0, 12).map((a) => [a.name, a.value.slice(0, 80)]),
      ),
    };
  });

  const cardCount = await page.evaluate(() => document.querySelectorAll('a[href*="/products/"]').length);

  return { anchors, cardSignals, cardCount, networkLog: networkLog.slice(0, 40) };
}

async function reconPdp(page, pdpUrl) {
  await page.goto(pdpUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  const data = await page.evaluate(() => {
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => {
        try {
          return JSON.parse(s.textContent || 'null');
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const meta = {};
    for (const m of document.querySelectorAll('meta[property^="og:"], meta[name="description"]')) {
      const k = m.getAttribute('property') || m.getAttribute('name');
      const v = m.getAttribute('content');
      if (k && v) meta[k] = v.slice(0, 200);
    }

    const h1 = document.querySelector('h1')?.textContent?.trim()?.slice(0, 200) || null;
    const title = document.title?.slice(0, 200) || null;
    const visibleText = (document.body?.innerText || '').slice(0, 600);

    return { title, h1, meta, jsonLdTypes: ld.map((x) => x['@type'] || (Array.isArray(x) ? x.map((y) => y['@type']) : null)), jsonLdSample: JSON.stringify(ld[0] || null).slice(0, 1200), visibleTextHead: visibleText };
  });

  return data;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1365, height: 768 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);

  const out = { category: null, pdp: null, errors: [] };
  try {
    out.category = await reconCategory(page);
  } catch (err) {
    out.errors.push(`category:${err?.message || err}`);
  }

  const pdpUrl = (out.category?.anchors || []).map((h) => {
    if (h.startsWith('http')) return h;
    if (h.startsWith('/')) return `https://www.musinsa.com${h}`;
    return null;
  }).find(Boolean);

  if (pdpUrl) {
    try {
      out.pdp = { url: pdpUrl, ...(await reconPdp(page, pdpUrl)) };
    } catch (err) {
      out.errors.push(`pdp:${err?.message || err}`);
    }
  } else {
    out.errors.push('no_pdp_anchor_found');
  }

  await ctx.close();
  await browser.close();

  process.stdout.write(JSON.stringify(out, null, 2));
})().catch((e) => {
  process.stderr.write(`fatal:${e?.message || e}\n`);
  process.exitCode = 1;
});
