#!/usr/bin/env node
'use strict';

// PickFit Musinsa PLP batch ingest.
// Calls https://api.musinsa.com/api2/dp/v2/plp/goods per category and writes
// one JSONL row per product to --out. Operator-scoped; not a user-facing
// crawl. Caller is responsible for downstream PHP import.
//
// Categories (verified via /api2/dp/v1/categories?gf=A on 2026-05-29):
//   001=상의 → top, 002=아우터 → outer, 003=바지 → bottom, 103=신발 → shoes
//
// Anti-bot policy (we self-throttle, don't fight back):
//   - 1.0–3.0s jitter between requests
//   - Stop immediately on HTTP != 200, HTTP 429, or 3 consecutive empty pages
//   - Default User-Agent matches a real desktop Chrome
//   - max 10 pages per category as a hard cap (10*60 = 600, way over our 80 target)
//
// CLI:
//   node crawler/musinsa-batch.js \
//     --out storage/seeds/musinsa-batch.jsonl \
//     --plan "001:top:5,002:outer:5,003:bottom:5,103:shoes:5"
//
// Plan tokens: "<categoryCode>:<slot>:<targetCount>" comma-separated.

const fs = require('fs');
const path = require('path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const PLP_PAGE_SIZE = 60;
const MAX_PAGES_PER_CATEGORY = 10;
const MAX_CONSECUTIVE_EMPTY = 3;

const ALLOWED_SLOTS = new Set(['top', 'bottom', 'outer', 'shoes']);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const k = tok.slice(2);
    const v = argv[i + 1];
    if (v !== undefined && !v.startsWith('--')) { out[k] = v; i++; } else { out[k] = true; }
  }
  return out;
}

function parsePlan(spec) {
  if (!spec || typeof spec !== 'string') {
    throw new Error('--plan is required, e.g. "001:top:5,103:shoes:5"');
  }
  const items = [];
  for (const raw of spec.split(',')) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const parts = trimmed.split(':');
    if (parts.length !== 3) throw new Error(`Bad plan token: "${trimmed}"`);
    const [category, slot, countStr] = parts;
    if (!/^[0-9]{3}$/.test(category)) throw new Error(`Bad categoryCode: "${category}"`);
    if (!ALLOWED_SLOTS.has(slot)) throw new Error(`Bad slot: "${slot}" (expected top/bottom/outer/shoes)`);
    const target = parseInt(countStr, 10);
    if (!Number.isFinite(target) || target <= 0 || target > 1000) {
      throw new Error(`Bad count: "${countStr}"`);
    }
    items.push({ category, slot, target });
  }
  if (items.length === 0) throw new Error('Plan has no entries');
  return items;
}

async function fetchPlp(categoryCode, page) {
  const url = `https://api.musinsa.com/api2/dp/v2/plp/goods?gf=A&sortCode=POPULAR&category=${categoryCode}&size=${PLP_PAGE_SIZE}&page=${page}&caller=CATEGORY&seen=0&seenAds=`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    redirect: 'follow',
  });
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status} for category ${categoryCode} page ${page}`);
  }
  const body = await res.json();
  if (!body || body.meta?.result !== 'SUCCESS') {
    throw new Error(`API non-success: ${JSON.stringify(body?.meta || {}).slice(0, 200)}`);
  }
  const list = body.data?.list;
  return Array.isArray(list) ? list : [];
}

function jitter(minMs, maxMs) {
  const delta = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, delta));
}

function pickFields(item, slot) {
  return {
    slot,
    goodsNo: item.goodsNo,
    goodsName: item.goodsName,
    goodsLinkUrl: item.goodsLinkUrl,
    thumbnail: item.thumbnail,
    brand: item.brand,
    brandName: item.brandName,
    brandLinkUrl: item.brandLinkUrl,
    normalPrice: item.normalPrice,
    price: item.price,
    couponPrice: item.couponPrice,
    finalPrice: item.finalPrice,
    saleRate: item.saleRate,
    finalDiscount: item.finalDiscount,
    displayGenderText: item.displayGenderText,
    isSoldOut: !!item.isSoldOut,
    reviewCount: item.reviewCount,
    reviewScore: item.reviewScore,
  };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out;
  if (!outPath || typeof outPath !== 'string') {
    process.stderr.write('Missing --out\n');
    process.exit(2);
  }
  let plan;
  try {
    plan = parsePlan(args.plan);
  } catch (err) {
    process.stderr.write(`plan_parse_failed: ${err.message}\n`);
    process.exit(2);
  }

  // Ensure parent directory exists.
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const stream = fs.createWriteStream(outPath, { encoding: 'utf8', flags: 'w' });

  const seenGoodsNo = new Set();
  const summary = { written: 0, perSlot: { top: 0, bottom: 0, outer: 0, shoes: 0 }, errors: [] };

  for (const { category, slot, target } of plan) {
    process.stderr.write(`category=${category} slot=${slot} target=${target}\n`);
    let consecutiveEmpty = 0;
    let collected = 0;

    for (let page = 1; page <= MAX_PAGES_PER_CATEGORY && collected < target; page++) {
      try {
        const items = await fetchPlp(category, page);
        if (items.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            process.stderr.write(`  empty pages exhausted at page=${page}\n`);
            break;
          }
        } else {
          consecutiveEmpty = 0;
        }

        for (const raw of items) {
          if (collected >= target) break;
          if (!raw || typeof raw.goodsNo !== 'number' || !raw.goodsLinkUrl) continue;
          if (seenGoodsNo.has(raw.goodsNo)) continue;
          seenGoodsNo.add(raw.goodsNo);
          const row = pickFields(raw, slot);
          stream.write(JSON.stringify(row) + '\n');
          summary.written++;
          summary.perSlot[slot]++;
          collected++;
        }

        process.stderr.write(`  page=${page} got=${items.length} collected=${collected}/${target}\n`);
      } catch (err) {
        summary.errors.push(`category=${category} page=${page} ${err.message}`);
        process.stderr.write(`  ERROR page=${page}: ${err.message}\n`);
        // Hard stop on error per anti-bot policy.
        break;
      }

      // Jitter between page requests.
      if (collected < target && page < MAX_PAGES_PER_CATEGORY) {
        await jitter(1000, 3000);
      }
    }

    // Jitter between categories too.
    await jitter(1500, 3500);
  }

  await new Promise((r) => stream.end(r));

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
})().catch((err) => {
  process.stderr.write(`fatal: ${err?.message || err}\n`);
  process.exit(1);
});
