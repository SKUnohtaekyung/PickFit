// PickFit — occasion_tags 재적용 헬퍼 (Phase 3)
//
// crawler/musinsa-normalize.js 가 새로 산출한 occasion_tags 만 떼어,
//   (a) 커밋된 시드(database/seeds/musinsa_catalog_seed.sql)의 products 행을 in-place 갱신
//   (b) 라이브 DB 갱신용 UPDATE 문(storage/logs/_occasion_update.sql)을 생성
// 한다. id/public_id/리뷰/기타 컬럼은 절대 건드리지 않아 diff 가 occasion_tags 로만 한정된다.
//
// 사용: node crawler/apply-occasion-tags.js
//       mysql -u root --protocol=TCP pickfit < storage/logs/_occasion_update.sql
//
// source_url 로 매칭하므로 행 정체성(id)이 안정적으로 보존된다.

const fs = require('fs');

const JSONL = 'storage/seeds/musinsa-normalized.jsonl';
const SEED = 'database/seeds/musinsa_catalog_seed.sql';
const UPDATE_SQL = 'storage/logs/_occasion_update.sql';

// 1) 새 occasion_tags 를 source_url 기준으로 인덱싱
const rows = fs.readFileSync(JSONL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const tagsByUrl = new Map();
for (const r of rows) {
  if (typeof r.sourceUrl === 'string' && Array.isArray(r.occasionTags)) {
    tagsByUrl.set(r.sourceUrl, r.occasionTags.filter((t) => typeof t === 'string'));
  }
}

// 덤프 문자열 리터럴 형식: '["office", "interview"]'  (큰따옴표는 \" 로 escape)
const toDumpLiteral = (tags) => "'[" + tags.map((t) => '\\"' + t + '\\"').join(', ') + "]'";
// UPDATE 문 형식: JSON 컬럼에 그대로 대입 (single-quote 안 큰따옴표는 escape 불필요)
const toSqlValue = (tags) => "'[" + tags.map((t) => '"' + t + '"').join(', ') + "]'";

// products INSERT 한 줄에서 source_url(3번째 값) 추출
const URL_RE = /VALUES \(\d+,'[^']*','([^']*)'/;
// style_tags, occasion_tags(둘 다 SQL 따옴표 문자열) 뒤에 body_type_notes..policy_note = NULL 8개가
// 이어지는 패턴으로 occasion_tags 토큰만 정확히 교체한다.
const OCC_RE = /('(?:\\.|[^'\\])*'),('(?:\\.|[^'\\])*')(,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,)/;

const seedLines = fs.readFileSync(SEED, 'utf8').split('\n');
let matched = 0, unmatched = 0, replaced = 0;
const updates = [];

const out = seedLines.map((line) => {
  if (!line.includes('INTO `products`') || !line.includes('VALUES (')) return line;
  const m = line.match(URL_RE);
  if (!m) { unmatched++; return line; }
  const url = m[1];
  if (!tagsByUrl.has(url)) { unmatched++; return line; }
  matched++;
  const tags = tagsByUrl.get(url);
  updates.push(`UPDATE products SET occasion_tags=${toSqlValue(tags)} WHERE source_url='${url.replace(/'/g, "''")}' AND origin_type='batch';`);
  const next = line.replace(OCC_RE, (whole, style, _occ, nulls) => {
    replaced++;
    return style + ',' + toDumpLiteral(tags) + nulls;
  });
  return next;
});

fs.writeFileSync(SEED, out.join('\n'), 'utf8');
fs.writeFileSync(UPDATE_SQL, updates.join('\n') + '\n', 'utf8');

console.error(JSON.stringify({ jsonlRows: rows.length, productsMatched: matched, productsUnmatched: unmatched, occasionReplaced: replaced, updateStatements: updates.length }));
