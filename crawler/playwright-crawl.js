#!/usr/bin/env node
'use strict';

// PickFit Playwright crawler — single URL analysis worker.
// Invoked by PHP CrawlerService via proc_open with an array-form command:
//   node crawler/playwright-crawl.js --job-id <id> --url <url> --artifact-dir <dir>
//                                    --max-text-chars <n> --max-images <n>
// Emits a single JSON document to stdout (success or failure shape per
// crawler/schemas/crawl-result.schema.json). Progress logs go to stderr only.
//
// Hard policy (per tech.md §10.7):
//   - never bypass login/captcha
//   - never click purchase/cart buttons
//   - never submit forms (cookie-consent close only if it blocks layout)
//   - never run more than one navigation
//   - fresh browser context per job, no persistent profile
//   - close browser/context in finally even on uncaught errors

const path = require('path');
const fs = require('fs');

const NAVIGATION_TIMEOUT_MS = 30_000;
const SELECTOR_TIMEOUT_MS = 5_000;
const VIEWPORT = { width: 1365, height: 768 };
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fe80:/i,
  /^\[?ff[0-9a-f]{2}:/i,
];

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args['job-id'] || !args.url || !args['artifact-dir']) {
    return emitFailure('argument_missing', 'Missing required argument: --job-id, --url, --artifact-dir');
  }

  const limits = {
    maxTextChars: parseInt(args['max-text-chars'] || '20000', 10),
    maxImages: parseInt(args['max-images'] || '12', 10),
  };

  const inputUrl = args.url;
  const artifactDir = args['artifact-dir'];

  try {
    ensureDirectory(artifactDir);
  } catch (err) {
    return emitFailure('argument_missing', `Cannot create artifact dir: ${err?.message || err}`);
  }

  let playwright;
  try {
    playwright = require('playwright');
  } catch (err) {
    return emitFailure('browser_failed', `playwright module not available: ${err?.message || err}`);
  }

  let browser = null;
  let context = null;

  try {
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: USER_AGENT,
      // Hard-disable storage state — every job is a fresh client.
      storageState: undefined,
      // Avoid downloading anything.
      acceptDownloads: false,
      bypassCSP: false,
      javaScriptEnabled: true,
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    page.setDefaultTimeout(SELECTOR_TIMEOUT_MS);

    let response;
    try {
      response = await page.goto(inputUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    } catch (err) {
      const code = /timeout/i.test(err?.message || '') ? 'navigation_timeout' : 'navigation_failed';
      return emitFailure(code, truncate(err?.message || 'navigation failed', 400));
    }

    if (!response) {
      return emitFailure('navigation_failed', 'No HTTP response received');
    }

    const finalUrl = page.url();
    const finalHost = safeHost(finalUrl);
    if (!finalHost || hostLooksBlocked(finalHost)) {
      return emitFailure('post_navigation_blocked', `Final URL host is blocked: ${finalUrl}`);
    }

    // Mild settle wait — many product pages hydrate prices/images via JS shortly after DOMContentLoaded.
    await sleep(800);

    let adapterResult;
    try {
      const generic = require('./adapters/generic');
      adapterResult = await generic.extract({ page, url: finalUrl, limits });
    } catch (err) {
      return emitFailure('extraction_failed', truncate(err?.message || 'extraction failed', 400));
    }

    let screenshotPath = null;
    try {
      const file = path.join(artifactDir, 'screenshot.png');
      await page.screenshot({ path: file, fullPage: false, timeout: 10_000 });
      screenshotPath = path.relative(process.cwd(), file).split(path.sep).join('/');
    } catch (err) {
      adapterResult.warnings.push(`screenshot_failed:${truncate(err?.message || 'unknown', 80)}`);
    }

    const payload = {
      ok: true,
      url: inputUrl,
      finalUrl,
      domain: finalHost,
      adapter: adapterResult.adapter || 'generic',
      title: adapterResult.title || null,
      meta: adapterResult.meta || {},
      extracted: adapterResult.extracted || {},
      artifacts: { screenshotPath },
      warnings: Array.isArray(adapterResult.warnings) ? adapterResult.warnings : [],
    };
    process.stdout.write(JSON.stringify(payload));
  } catch (err) {
    return emitFailure('unexpected_error', truncate(err?.message || 'unexpected', 400));
  } finally {
    if (context) {
      try { await context.close(); } catch { /* swallow */ }
    }
    if (browser) {
      try { await browser.close(); } catch { /* swallow */ }
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostLooksBlocked(host) {
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(s, max) {
  if (typeof s !== 'string') return '';
  return s.length <= max ? s : s.slice(0, max);
}

function emitFailure(errorCode, errorMessage) {
  const payload = { ok: false, errorCode, errorMessage, warnings: [] };
  process.stdout.write(JSON.stringify(payload));
}

main().catch((err) => {
  emitFailure('unexpected_error', truncate(err?.message || 'top-level reject', 400));
  process.exitCode = 0; // Always exit 0 — PHP parses stdout JSON for status, not exit code.
});
