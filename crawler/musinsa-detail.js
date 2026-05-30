#!/usr/bin/env node
'use strict';

// PickFit — Musinsa DETAIL page crawler (best-effort, hybrid pipeline Phase 1).
// Reads the batch JSONL (musinsa-batch-250.jsonl), visits each product detail
// page, and captures real signal (material/spec text, description, visible body
// text, static review numbers) into a per-product JSONL. The fashion-expert
// normalizer (Phase 2) parses this; products that can't be crawled fall back to
// name-based inference.
//
// Policy (tech.md §10.7): single navigation per product, fresh context, no
// clicks/scroll/forms, no login/captcha bypass. Anti-bot: random jitter, stop on
// 403/429/bot-check, resumable (skips goodsNo already in --out).
//
// Usage:
//   node crawler/musinsa-detail.js --in storage/seeds/musinsa-batch-250.jsonl \
//        --out storage/seeds/musinsa-detail.jsonl --limit 40

const fs = require('fs');
const readline = require('readline');

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1200;
const MAX_BODY_CHARS = 9000;
const VIEWPORT = { width: 1365, height: 768 };
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n !== undefined && !n.startsWith('--')) { out[k] = n; i++; } else { out[k] = true; }
  }
  return out;
}

function readJsonl(path) {
  if (!fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split('\n')
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function jitter(min, max) { return Math.floor(min + Math.random() * (max - min)); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args.in || 'storage/seeds/musinsa-batch-250.jsonl';
  const outPath = args.out || 'storage/seeds/musinsa-detail.jsonl';
  const limit = parseInt(args.limit || '40', 10);

  const rows = readJsonl(inPath);
  if (rows.length === 0) { console.error(`no input rows in ${inPath}`); process.exit(1); }

  const done = new Set(readJsonl(outPath).map((r) => String(r.goodsNo)));
  const pending = rows.filter((r) => r.goodsNo && !done.has(String(r.goodsNo)));
  // Randomize order so repeated runs sample different products.
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }
  const batch = pending.slice(0, limit);
  console.error(`input=${rows.length} done=${done.size} thisRun=${batch.length}`);

  let playwright;
  try { playwright = require('playwright'); }
  catch (e) { console.error(`playwright missing: ${e.message}`); process.exit(1); }

  const browser = await playwright.chromium.launch({ headless: true });
  const outStream = fs.createWriteStream(outPath, { flags: 'a' });

  let ok = 0, blocked = 0, failed = 0;
  try {
    for (const row of batch) {
      const url = row.goodsLinkUrl || `https://www.musinsa.com/products/${row.goodsNo}`;
      const context = await browser.newContext({ viewport: VIEWPORT, userAgent: USER_AGENT, acceptDownloads: false });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

      let rec = { goodsNo: row.goodsNo, ok: false };
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        const status = resp ? resp.status() : 0;
        if (status === 403 || status === 429) {
          console.error(`BLOCKED status=${status} at goodsNo=${row.goodsNo} — stopping`);
          blocked++;
          await context.close();
          break; // anti-bot: stop immediately
        }
        await sleep(SETTLE_MS);
        const data = await page.evaluate(() => {
          const pick = (sel) => { const el = document.querySelector(sel); return el ? (el.getAttribute('content') || el.textContent || '').trim() : null; };
          let ld = null;
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
              const p = JSON.parse(s.textContent || '');
              const nodes = Array.isArray(p) ? p : [p];
              for (const n of nodes) {
                const t = n && n['@type'];
                if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) { ld = n; break; }
              }
            } catch { /* ignore */ }
            if (ld) break;
          }
          const root = document.querySelector('main, #root, [class*="product"]') || document.body;
          const body = (root.innerText || '').replace(/\s+/g, ' ').trim();
          return {
            title: document.title || null,
            ogTitle: pick('meta[property="og:title"]'),
            ogDesc: pick('meta[property="og:description"]'),
            metaDesc: pick('meta[name="description"]'),
            ldName: ld && typeof ld.name === 'string' ? ld.name : null,
            ldDesc: ld && typeof ld.description === 'string' ? ld.description : null,
            body,
          };
        });

        const blockedText = /로봇|보안문자|captcha|차단되었습니다|abnormal|access denied/i.test(data.title + ' ' + data.body.slice(0, 400));
        if (blockedText) {
          console.error(`BLOCKED bot-check at goodsNo=${row.goodsNo} — stopping`);
          blocked++;
          await context.close();
          break;
        }

        rec = {
          goodsNo: row.goodsNo,
          ok: true,
          status,
          title: data.ldName || data.ogTitle || data.title,
          description: data.ldDesc || data.ogDesc || data.metaDesc || null,
          body: (data.body || '').slice(0, MAX_BODY_CHARS),
        };
        ok++;
      } catch (e) {
        rec = { goodsNo: row.goodsNo, ok: false, error: (e.message || 'error').slice(0, 200) };
        failed++;
      } finally {
        try { await context.close(); } catch { /* ignore */ }
      }

      outStream.write(JSON.stringify(rec) + '\n');
      await sleep(jitter(2000, 5000));
    }
  } finally {
    outStream.end();
    await browser.close();
  }

  console.error(JSON.stringify({ ok, blocked, failed, totalDone: done.size + ok }));
}

main().catch((e) => { console.error(`fatal: ${e.message}`); process.exit(1); });
