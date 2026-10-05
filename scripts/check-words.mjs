import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBannedWords } from './lib/words.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Public-facing text only; docs/plans are internal working notes.
const FILES = [
  'README.md',
  'CHANGELOG.md',
  'composer.json',
  'package.json',
  'data/categories.json',
  'data/aliases.json',
  'data/history.json',
  'data/circulars.json',
  'data/glide-paths.json',
  'data/rules.json',
  'data/meta.json',
];

let failed = false;
for (const file of FILES) {
  for (const hit of findBannedWords(readFileSync(join(root, file), 'utf8'))) {
    console.error(`${file}:${hit.line}: banned word "${hit.word}"`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('No banned words found.');
