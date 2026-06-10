const BannedKeyword = require('../models/BannedKeyword');

// ─── In-memory keyword cache ──────────────────────────────────────────────────
let _regexes = [];

function buildFuzzyRegex(keyword) {
  const subs = { a:'[a@4]', e:'[e3]', i:'[i1!|]', o:'[o0]', s:'[s$5]', t:'[t+7]', l:'[l1]', g:'[g9]', b:'[b8]' };
  const pattern = keyword.toLowerCase().split('').map(c => {
    const safe = (subs[c] ?? c).replace(/([.+?^${}()|[\]\\])/g, (m) => subs[c] ? m : `\\${m}`);
    return safe + '[\\W_]*'; // allow punctuation/spaces between chars
  }).join('');
  return new RegExp(pattern.replace(/\[\\W_\]\*$/, ''), 'gi');
}

async function loadKeywords() {
  const docs = await BannedKeyword.find({}).select('keyword');
  _regexes = docs.map(d => buildFuzzyRegex(d.keyword));
}

function censorText(text) {
  if (!text || _regexes.length === 0) return text;
  let result = text;
  for (const re of _regexes) result = result.replace(re, '***');
  return result;
}

module.exports = { loadKeywords, censorText, buildFuzzyRegex };
