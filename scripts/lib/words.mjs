// Ananto compliance rule: these words must not appear in public-facing text.
export const BANNED_WORDS = ['planning', 'advisory'];

const PATTERN = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'gi');

export const findBannedWords = (text) => {
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(PATTERN)) {
      hits.push({ word: match[1].toLowerCase(), line: index + 1 });
    }
  });
  return hits;
};
