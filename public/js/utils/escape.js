// ========================================
// HTML escape helpers
// ========================================
// PickFit screens build markup via template literals + container.innerHTML.
// Any dynamic value that originates from a server response (recommendation
// outfit fields, product names, crawl-sourced text, OpenAI output) MUST be
// passed through escapeHtml() before interpolation so attribute breakout and
// <script> injection cannot happen.
//
// Static labels (SITUATION_LABELS dictionaries) are safe in principle but
// escaping them is harmless — prefer to escape uniformly so future contributors
// don't have to reason about which interpolations are "safe".

const REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for safe interpolation into HTML element bodies AND quoted
 * HTML attribute values. Handles null/undefined by returning empty string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => REPLACEMENTS[ch]);
}

/**
 * Convenience: escape and return inside template literals.
 * Alias to keep call sites short: `${e(product.name)}`
 */
export const e = escapeHtml;

/**
 * 텍스트 노드용 부분 이스케이프(기존 화면 구현과 동일: & < > 만 변환).
 * 따옴표는 변환하지 않아 기존 출력 결과를 그대로 보존한다.
 */
export function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 큰따옴표 속성값용 부분 이스케이프(기존 화면 구현과 동일: & " < > 변환).
 */
export function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
