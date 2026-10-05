import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

// dataset key -> data file name (without .json)
const FILES = {
  categories: 'categories',
  aliases: 'aliases',
  history: 'history',
  circulars: 'circulars',
  glidePaths: 'glide-paths',
  rules: 'rules',
  meta: 'meta',
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const loadDataset = (dataDir = DATA_DIR) =>
  Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readJson(join(dataDir, `${file}.json`))]));

const buildValidators = (schemaDir) => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictRequired: false });
  addFormats(ajv);
  return Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, ajv.compile(readJson(join(schemaDir, `${file}.schema.json`)))])
  );
};

const schemaErrors = (dataset, schemaDir) => {
  const validators = buildValidators(schemaDir);
  const errors = [];
  for (const [key, file] of Object.entries(FILES)) {
    const validate = validators[key];
    if (!validate(dataset[key])) {
      for (const e of validate.errors) {
        errors.push(`${file}.json${e.instancePath}: ${e.message}`);
      }
    }
  }
  return errors;
};

const duplicates = (values) => values.filter((v, i) => values.indexOf(v) !== i);

const integrityErrors = (ds) => {
  const errors = [];
  const categories = ds.categories.categories ?? [];
  const circularIds = new Set((ds.circulars.circulars ?? []).map((c) => c.id));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const needCategory = (file, id, where) => {
    if (!byId.has(id)) errors.push(`${file}.json: ${where} references unknown category "${id}"`);
  };
  const needCircular = (file, id, where) => {
    if (id !== null && id !== undefined && !circularIds.has(id)) {
      errors.push(`${file}.json: ${where} references unknown circular "${id}"`);
    }
  };

  for (const id of duplicates(categories.map((c) => c.id))) errors.push(`categories.json: duplicate id "${id}"`);

  for (const c of categories) {
    if (c.level === 'broad') {
      if (c.parent !== null) errors.push(`categories.json: broad category "${c.id}" must have parent null`);
      if (c.id.includes('.')) errors.push(`categories.json: broad category "${c.id}" must not contain a dot`);
    } else {
      const expectedParentLevel = c.level === 'sub' ? 'specific' : 'broad';
      const expectedDots = c.level === 'sub' ? 2 : 1;
      const parent = byId.get(c.parent);
      if (!parent) errors.push(`categories.json: "${c.id}" has unknown parent "${c.parent}"`);
      else if (parent.level !== expectedParentLevel) {
        errors.push(`categories.json: parent of "${c.id}" must be a ${expectedParentLevel} category`);
      }
      if (c.parent && !c.id.startsWith(`${c.parent}.`)) {
        errors.push(`categories.json: id "${c.id}" must start with its parent "${c.parent}."`);
      }
      if (c.id.split('.').length - 1 !== expectedDots) {
        errors.push(`categories.json: ${c.level} category "${c.id}" must have ${expectedDots + 1} id segments`);
      }
    }
    if (c.group !== undefined && c.level !== 'sub') {
      errors.push(`categories.json: only sub categories may have a group ("${c.id}")`);
    }
    if (c.status === 'active' && c.valid_to !== null) errors.push(`categories.json: active "${c.id}" must have valid_to null`);
    if (c.status !== 'active' && c.valid_to === null) errors.push(`categories.json: ${c.status} "${c.id}" needs valid_to`);
    if (c.valid_from && c.valid_to && c.valid_from > c.valid_to) {
      errors.push(`categories.json: "${c.id}" has valid_from after valid_to`);
    }
    needCircular('categories', c.circular, `category "${c.id}"`);
  }

  for (const label of duplicates((ds.aliases.aliases ?? []).map((a) => a.label))) {
    errors.push(`aliases.json: duplicate label "${label}"`);
  }
  for (const a of ds.aliases.aliases ?? []) {
    if (a.category) needCategory('aliases', a.category, `alias "${a.label}"`);
    for (const id of a.candidates ?? []) needCategory('aliases', id, `alias "${a.label}"`);
  }

  for (const e of ds.history.events ?? []) {
    for (const id of [...e.from, ...e.to]) needCategory('history', id, `${e.type} event`);
    needCircular('history', e.circular, `${e.type} event`);
  }

  for (const id of duplicates((ds.circulars.circulars ?? []).map((c) => c.id))) {
    errors.push(`circulars.json: duplicate id "${id}"`);
  }
  for (const c of ds.circulars.circulars ?? []) {
    for (const id of c.supersedes ?? []) needCircular('circulars', id, `circular "${c.id}" supersedes`);
  }

  for (const g of ds.glidePaths.glide_paths ?? []) {
    needCategory('glide-paths', g.category, 'glide path');
    needCircular('glide-paths', g.circular, `glide path "${g.category}"`);
  }

  for (const id of duplicates((ds.rules.rules ?? []).map((r) => r.id))) errors.push(`rules.json: duplicate id "${id}"`);
  for (const r of ds.rules.rules ?? []) {
    for (const id of r.applies_to) needCategory('rules', id, `rule "${r.id}"`);
    needCircular('rules', r.circular, `rule "${r.id}"`);
  }

  needCircular('meta', ds.meta.circular, 'meta');

  return errors;
};

/**
 * Returns a list of human-readable problems. Integrity checks only run once every
 * file passes its JSON Schema, so they can rely on the shape of the data.
 */
export const validateDataset = (dataset, schemaDir = join(DATA_DIR, 'schema')) => {
  const errors = schemaErrors(dataset, schemaDir);
  return errors.length > 0 ? errors : integrityErrors(dataset);
};
