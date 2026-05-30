#!/usr/bin/env node
'use strict';

// PickFit — Fashion-expert normalizer (hybrid pipeline Phase 2).
// Combines the batch JSONL (always present: name/brand/slot/gender/reviewScore)
// with best-effort crawled detail (musinsa-detail.jsonl: real material %, 시즌,
// review snippets) and applies the fashion-expert rules in docs/fashion-expert-spec.md
// to produce one normalized record per product → musinsa-normalized.jsonl.
// Crawled facts win (confidence 0.8); name inference is the labelled fallback (0.5).

const fs = require('fs');

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]; if (!t.startsWith('--')) continue;
    const k = t.slice(2), n = argv[i + 1];
    if (n !== undefined && !n.startsWith('--')) { o[k] = n; i++; } else { o[k] = true; }
  }
  return o;
}
function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const MAT_KO = {
  cotton: '면', polyester: '폴리', linen: '린넨', wool: '울', nylon: '나일론',
  spandex: '스판', rayon: '레이온', acrylic: '아크릴', polyurethane: '폴리우레탄',
  leather: '가죽', modal: '모달', tencel: '텐셀', lyocell: '리오셀', viscose: '비스코스',
  cupra: '큐프라', cashmere: '캐시미어', '면': '면', '폴리에스터': '폴리', '폴리': '폴리',
  '린넨': '린넨', '울': '울', '나일론': '나일론', '스판덱스': '스판', '스판': '스판',
  '레이온': '레이온', '아크릴': '아크릴', '폴리우레탄': '폴리우레탄', '가죽': '가죽',
  '모달': '모달', '텐셀': '텐셀', '데님': '데님', '캐시미어': '캐시미어',
};
const MAT_RE = new RegExp(
  '(cotton|polyester|linen|wool|nylon|spandex|rayon|acrylic|polyurethane|leather|modal|tencel|lyocell|viscose|cupra|cashmere|면|폴리에스터|폴리|린넨|울|나일론|스판덱스|스판|레이온|아크릴|폴리우레탄|가죽|모달|텐셀|데님|캐시미어)\\s*[:\\-]?\\s*(\\d{1,3})\\s*%',
  'gi',
);

const COLORS = [
  [/블랙|검정|차콜|charcoal|black/i, 'black'], [/화이트|흰|white/i, 'white'],
  [/아이보리|크림|ivory|cream/i, 'ivory'], [/네이비|navy/i, 'navy'],
  [/그레이|회색|gray|grey/i, 'gray'], [/베이지|beige/i, 'beige'],
  [/브라운|갈색|brown/i, 'brown'], [/카키|khaki|올리브|olive/i, 'khaki'],
  [/데님|denim/i, 'denim'], [/블루|파랑|blue/i, 'blue'], [/그린|초록|green/i, 'green'],
  [/레드|빨강|red/i, 'red'], [/핑크|pink/i, 'pink'], [/퍼플|보라|purple/i, 'purple'],
  [/옐로우|노랑|yellow/i, 'yellow'],
];

function parseMaterial(text) {
  if (!text) return null;
  const found = [];
  let m;
  MAT_RE.lastIndex = 0;
  while ((m = MAT_RE.exec(text)) !== null) {
    const ko = MAT_KO[m[1].toLowerCase()] || MAT_KO[m[1]] || null;
    const pct = parseInt(m[2], 10);
    if (ko && pct > 0 && pct <= 100) found.push({ ko, pct });
  }
  if (found.length === 0) return null;
  // Merge dup materials (keep max %), sort desc, take top 2.
  const byKo = {};
  for (const f of found) byKo[f.ko] = Math.max(byKo[f.ko] || 0, f.pct);
  const sorted = Object.entries(byKo).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return sorted.map(([ko, pct]) => `${ko} ${pct}%`).join(', ');
}

// Fibre/material inference when no crawled composition exists. Cascades:
// explicit fibre word in name/text → garment-type-typical fabric → slot default.
// Always returns a Korean material string suffixed "추정" (estimate) so the UI
// never shows empty 소재 for a known garment, and the value stays honest.
function inferMaterial(name, slot, text) {
  const t = (name + ' ' + text).toLowerCase();
  // 1) explicit fibre word
  if (/린넨|linen/.test(t)) return '린넨 추정';
  if (/데님|denim|청바지|청자켓/.test(t)) return '데님(면) 추정';
  if (/코듀로이|corduroy|골덴/.test(t)) return '코듀로이 추정';
  if (/가죽|레더|leather|무스탕/.test(t)) return '가죽 추정';
  if (/캐시미어|cashmere|울|wool/.test(t)) return '울 혼방 추정';
  if (/니트|knit|스웨터|가디건/.test(t)) return '아크릴·울 혼방 추정';
  if (/기모|후리스|플리스|fleece|양털/.test(t)) return '기모 폴리 추정';
  if (/스웨트|맨투맨|후드|hood|sweat/.test(t)) return '면·폴리 혼방 추정';
  // 2) garment-type-typical
  if (/셔츠|shirt/.test(t)) return '면 혼방 추정';
  if (/슬랙스|슬렉스|치노|면바지|slacks|chino/.test(t)) return '폴리 혼방 추정';
  if (/트랙|조거|트레이닝|track|jogger/.test(t)) return '폴리 혼방 추정';
  if (/블레이저|자켓|jacket|blazer|코트|coat/.test(t)) return '폴리 혼방 추정';
  if (/패딩|다운|padding/.test(t)) return '나일론·다운 추정';
  if (/티셔츠|반팔|tee|t-shirt|나시|민소매/.test(t)) return '면 추정';
  if (/팬츠|pants|바지|쇼츠|shorts/.test(t)) return '면·폴리 혼방 추정';
  if (/폴리|poly/.test(t)) return '폴리 추정';
  if (/면|코튼|cotton/.test(t)) return '면 추정';
  // 3) slot default
  if (slot === 'shoes') return '합성·가죽 추정';
  if (slot === 'outer') return '폴리 혼방 추정';
  if (slot === 'bottom') return '면·폴리 혼방 추정';
  return '면 혼방 추정';
}

function detectSeasonFromTag(text) {
  const m = /시즌\s*\d{0,4}\s*(SS|FW|SP|SU|FA|WI|S\/S|F\/W)/i.exec(text || '');
  if (!m) return null;
  const code = m[1].toUpperCase().replace('/', '');
  if (code === 'SS' || code === 'S' + 'S') return ['spring', 'summer'];
  if (code === 'FW') return ['fall', 'winter'];
  if (code === 'SP') return ['spring'];
  if (code === 'SU') return ['summer'];
  if (code === 'FA') return ['fall'];
  if (code === 'WI') return ['winter'];
  return null;
}

function inferSeason(text, materialMain) {
  const t = (text + ' ' + (materialMain || '')).toLowerCase();
  if (/올시즌|사계절|all\s*season/.test(t)) return ['spring', 'summer', 'fall', 'winter'];
  if (/반팔|민소매|나시|슬리브리스|린넨|linen|에어|메쉬|mesh|시어서커|쿨|하프|반바지/.test(t)) return ['spring', 'summer'];
  if (/기모|니트|코트|패딩|울|wool|플리스|fleece|무스탕|덕다운|양털|코듀로이|긴팔.*기모/.test(t)) return ['fall', 'winter'];
  if (/가디건|맨투맨|후드|자켓|셔츠|슬랙스|데님|청바지/.test(t)) return ['spring', 'fall'];
  return ['spring', 'fall'];
}

function detectFit(name, slot) {
  const t = name.toLowerCase();
  if (/오버사이즈|오버핏|세미오버|오버 |오버$|over/.test(t)) return 'oversized';
  if (/와이드|wide/.test(t)) return 'wide';
  if (/슬림|스키니|slim|skinny/.test(t)) return 'slim';
  if (/릴렉스|릴랙스|relax/.test(t)) return 'relaxed';
  if (/스트레이트|straight/.test(t)) return 'straight';
  if (/레귤러|스탠다드|regular|standard/.test(t)) return 'regular';
  if (slot === 'shoes') return 'unknown';
  if (slot === 'bottom') return 'straight';
  return 'regular';
}

function detectColor(name) {
  for (const [re, c] of COLORS) if (re.test(name)) return c;
  return null;
}

function materialTraits(materialMain, text) {
  const t = ((materialMain || '') + ' ' + text).toLowerCase();
  const stretch = /스판|spandex|elastane|니트|knit/.test(t) ? 'high' : 'low';
  let thickness = 'medium';
  if (/기모|패딩|코트|울|wool|니트|knit|무스탕|코듀로이/.test(t)) thickness = 'heavy';
  else if (/린넨|linen|에어|메쉬|mesh|반팔|시어|얇은/.test(t)) thickness = 'light';
  const opacity = /린넨|linen|시어|mesh|메쉬|시스루/.test(t) ? 'semi' : 'opaque';
  return { thickness, opacity, stretch };
}

function styleTags(name, slot) {
  const t = name.toLowerCase();
  const out = new Set();
  if (/트랙|조거|스웨트|후드|hood|sweat/.test(t)) { out.add('street'); out.add('casual'); }
  if (/셔츠|블레이저|슬랙스|자켓|blazer/.test(t)) { out.add('classic'); out.add('clean'); }
  if (/니트|가디건|knit/.test(t)) { out.add('minimal'); out.add('soft'); }
  if (/티셔츠|반팔|tee|t-shirt/.test(t)) out.add('casual');
  if (/데님|denim|청/.test(t)) { out.add('casual'); out.add('street'); }
  if (out.size === 0) out.add(slot === 'outer' ? 'classic' : 'casual');
  return [...out].slice(0, 3);
}

function occasionTags(name, slot) {
  const t = name.toLowerCase();
  const out = new Set();
  if (/셔츠|블레이저|슬랙스|자켓|면바지|치노/.test(t)) { out.add('office'); out.add('interview'); out.add('date'); }
  if (/트레이닝|트랙|조거|스웨트|후드|반팔티|반팔 티/.test(t)) { out.add('daily'); out.add('casual'); }
  if (/니트|가디건/.test(t)) { out.add('daily'); out.add('date'); out.add('office'); }
  if (/코트|패딩|블레이저/.test(t)) { out.add('daily'); out.add('office'); }
  if (out.size === 0) { out.add('daily'); out.add('casual'); }
  return [...out].slice(0, 4);
}

function riskFlags(fit) {
  if (fit === 'oversized' || fit === 'wide') return ['volume_size_check'];
  if (fit === 'slim') return ['tight_fit'];
  return [];
}

function main() {
  const a = args(process.argv.slice(2));
  const batch = readJsonl(a.batch || 'storage/seeds/musinsa-batch-250.jsonl');
  const detail = readJsonl(a.detail || 'storage/seeds/musinsa-detail.jsonl');
  const outPath = a.out || 'storage/seeds/musinsa-normalized.jsonl';

  const detailByNo = {};
  for (const d of detail) if (d.ok) detailByNo[String(d.goodsNo)] = d;

  let crawled = 0, inferred = 0;
  const lines = batch.map((b) => {
    const d = detailByNo[String(b.goodsNo)] || null;
    const crawlText = d ? ((d.title || '') + ' ' + (d.description || '') + ' ' + (d.body || '')) : '';
    const name = b.goodsName || '';
    const allText = name + ' ' + crawlText;

    let materialMain = parseMaterial(crawlText);      // real composition from crawl
    let confidence;
    if (materialMain) { confidence = 0.82; crawled++; }
    else { materialMain = inferMaterial(name, b.slot, crawlText); confidence = 0.5; inferred++; }

    let season = (d && detectSeasonFromTag(crawlText)) || inferSeason(allText, materialMain);
    const fit = detectFit(name, b.slot);
    const color = detectColor(name);
    const traits = materialTraits(materialMain, allText);

    const reviewScore = typeof b.reviewScore === 'number' ? b.reviewScore : null;
    const reviewCount = typeof b.reviewCount === 'number' ? b.reviewCount : 0;
    const rating = (reviewScore !== null && reviewCount > 0)
      ? Math.max(0, Math.min(5, Math.round((reviewScore / 20) * 10) / 10))
      : null;

    return {
      goodsNo: b.goodsNo,
      sourceUrl: b.goodsLinkUrl || `https://www.musinsa.com/products/${b.goodsNo}`,
      categoryMain: b.slot,
      fitType: fit,
      materialMain,
      materialSub: null,
      thickness: traits.thickness,
      opacity: traits.opacity,
      stretch: traits.stretch,
      seasonality: season,
      colorFamily: color,
      styleTags: styleTags(name, b.slot),
      occasionTags: occasionTags(name, b.slot),
      riskFlags: riskFlags(fit),
      confidence,
      rating,
      reviewCount,
      reviewHighlight: null,
    };
  });

  fs.writeFileSync(outPath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  console.error(JSON.stringify({ total: lines.length, materialFromCrawl: crawled, materialInferred: inferred, out: outPath }));
}

main();
