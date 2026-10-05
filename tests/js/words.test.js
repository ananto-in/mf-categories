import { describe, expect, it } from 'vitest';
import { findBannedWords } from '../../scripts/lib/words.mjs';

describe('findBannedWords', () => {
  it('returns nothing for clean text', () => {
    expect(findBannedWords('Open reference data for scheme categories.')).toEqual([]);
  });

  it('finds banned words case-insensitively with line numbers', () => {
    const text = 'first line\nFinancial Planning here\nan Advisory note';
    expect(findBannedWords(text)).toEqual([
      { word: 'planning', line: 2 },
      { word: 'advisory', line: 3 },
    ]);
  });

  it('ignores words that merely contain a banned word', () => {
    expect(findBannedWords('replanning and advisories')).toEqual([]);
  });

  it('handles Windows line endings', () => {
    expect(findBannedWords('ok\r\nadvisory\r\n')).toEqual([{ word: 'advisory', line: 2 }]);
  });
});
