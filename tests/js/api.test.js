import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import defaultCategories, {
  Category,
  active,
  all,
  candidatesForLabel,
  children,
  circular,
  createCategories,
  find,
  glidePath,
  history,
  meta,
  resolveLabel,
  rulesFor,
  successors,
} from '../../src/js/index.js';

// vitest runs from the repository root
const file = (name) => JSON.parse(readFileSync(join(process.cwd(), 'data', `${name}.json`), 'utf8'));
const ids = (list) => list.map((c) => c.id);

describe('all / find', () => {
  it('returns every category in file order', () => {
    expect(ids(all())).toEqual(file('categories').categories.map((c) => c.id));
    expect(all().every((c) => c instanceof Category)).toBe(true);
  });

  it('exposes camelCase properties', () => {
    const category = find('debt.short_term');
    expect(category).toMatchObject({
      id: 'debt.short_term',
      parent: 'debt',
      level: 'specific',
      name: 'Short Term Fund',
      status: 'active',
      validFrom: '2017-10-06',
      validTo: null,
      circular: 'sebi-2026-02-26',
      formerNames: ['Short Duration Fund'],
    });
    expect(category.characteristics.macaulay_duration_years).toEqual({ min: 1, max: 3 });
    expect(category.schemeTypeDescription).toContain('between 1 year to 3 years');
  });

  it('returns null for an unknown id', () => {
    expect(find('debt.nope')).toBeNull();
  });

  it('carries the classification description of a broad category', () => {
    expect(find('equity').description).toBe(
      'Mutual Fund scheme predominantly investing in equity and equity related instruments'
    );
  });

  it('has a group on sub-categories', () => {
    expect(find('other.fof.commodity_based')).toMatchObject({ level: 'sub', group: 'Commodity based FoF (Domestic)' });
  });

  it('defaults optional fields to empty values', () => {
    expect(find('equity')).toMatchObject({ shortName: 'Equity', group: null, formerNames: [], characteristics: {} });
    expect(find('other.fof.commodity_based').shortName).toBeNull();
  });

  it('is immutable', () => {
    const category = find('debt.short_term');
    expect(Object.isFrozen(category)).toBe(true);
    expect(() => {
      'use strict';
      category.name = 'changed';
    }).toThrow(TypeError);
    expect(() => category.formerNames.push('x')).toThrow(TypeError);
  });

  it('hands out copies of the lists', () => {
    all().pop();
    children('equity').pop();
    expect(all().length).toBe(file('categories').categories.length);
    expect(children('equity')).toHaveLength(15);
  });
});

describe('children', () => {
  it('lists specific categories of a broad category', () => {
    expect(ids(children('equity'))).toContain('equity.large_cap');
    expect(children('equity')).toHaveLength(15);
  });

  it('lists the 17 FoF sub-categories', () => {
    expect(children('other.fof')).toHaveLength(17);
  });

  it('is empty for a leaf or an unknown id', () => {
    expect(children('debt.short_term')).toEqual([]);
    expect(children('nope')).toEqual([]);
  });
});

describe('active', () => {
  it('defaults to today', () => {
    const list = ids(active());
    expect(list).toContain('equity.sectoral');
    expect(list).not.toContain('equity.sectoral_thematic');
    expect(list).not.toContain('solution_oriented.retirement');
  });

  it('accepts a Date', () => {
    expect(ids(active(new Date(2026, 1, 26)))).toContain('life_cycle.maturity_5y');
    expect(ids(active(new Date(2026, 1, 25)))).not.toContain('life_cycle.maturity_5y');
  });

  it('rejects an invalid Date object', () => {
    expect(() => active(new Date('nope'))).toThrow(RangeError);
  });

  it('rejects values that are not a string or a Date', () => {
    expect(() => active(20260226)).toThrow(RangeError);
    expect(() => active(null)).toThrow(RangeError);
  });

  it('isActiveOn accepts a Date', () => {
    expect(find('solution_oriented.retirement').isActiveOn(new Date(2026, 1, 25))).toBe(true);
    expect(find('solution_oriented.retirement').isActiveOn(new Date(2026, 1, 26))).toBe(false);
  });
});

describe('labels', () => {
  it('resolves the label of the last circular-defined category regardless of case and spacing', () => {
    expect(resolveLabel('EQUITY   SCHEMES -  thematic fund')?.id).toBe('equity.thematic');
    expect(resolveLabel('Equity Schemes - Thematic Fund')?.id).toBe('equity.thematic');
  });

  it('resolves every alias in the dataset to existing categories', () => {
    for (const alias of file('aliases').aliases) {
      const expected = alias.candidates ?? [alias.category];
      expect(ids(candidatesForLabel(alias.label)), alias.label).toEqual(expected);
    }
  });
});

describe('history and rules', () => {
  it('lists every event when no id is given', () => {
    expect(history()).toHaveLength(file('history').events.length);
    expect(history('nope')).toEqual([]);
  });

  it('includes the rules of a parent category', () => {
    expect(rulesFor('other.fof.commodity_based').map((r) => r.id)).toContain('fof_multi_underlying_framework');
  });

  it('returns copies that cannot corrupt the dataset', () => {
    rulesFor('equity')[0].id = 'tampered';
    history()[0].type = 'tampered';
    glidePath('life_cycle.maturity_5y').bands.length = 0;
    circular('sebi-2026-02-26').number = 'tampered';
    meta().dataset_version = 'tampered';

    expect(rulesFor('equity')[0].id).not.toBe('tampered');
    expect(history()[0].type).not.toBe('tampered');
    expect(glidePath('life_cycle.maturity_5y').bands).toHaveLength(3);
    expect(circular('sebi-2026-02-26').number).not.toBe('tampered');
    expect(meta().dataset_version).toBe(file('meta').dataset_version);
  });

  it('returns the dataset version', () => {
    expect(meta().dataset_version).toBe(file('meta').dataset_version);
  });

  it('returns successors of splits only', () => {
    expect(ids(successors('equity.value_contra'))).toEqual(['equity.value', 'equity.contra']);
    expect(successors('debt.short_term')).toEqual([]);
  });
});

describe('createCategories', () => {
  const dataset = {
    categories: {
      categories: [
        { id: 'a', parent: null, level: 'broad', name: 'A', status: 'active', valid_from: null, valid_to: null, circular: null },
        { id: 'a.b', parent: 'a', level: 'specific', name: 'B', status: 'active', valid_from: '2020-01-01', valid_to: null, circular: null },
      ],
    },
    aliases: { aliases: [{ label: 'A - B', category: 'a.b' }] },
    history: { events: [] },
    circulars: { circulars: [] },
    glidePaths: { glide_paths: [] },
    rules: { rules: [] },
    meta: { dataset_version: '9.9.9', circular: null },
  };

  it('works over a custom dataset', () => {
    const custom = createCategories(dataset);
    expect(ids(custom.all())).toEqual(['a', 'a.b']);
    expect(custom.resolveLabel('a - b').id).toBe('a.b');
    expect(ids(custom.children('a'))).toEqual(['a.b']);
    expect(ids(custom.active('2019-12-31'))).toEqual(['a']);
    expect(custom.meta().dataset_version).toBe('9.9.9');
  });

  it('treats a missing validFrom as valid from the beginning', () => {
    expect(createCategories(dataset).find('a').isActiveOn('1900-01-01')).toBe(true);
  });

  it('exposes the same operations as the named exports and the default export', () => {
    expect(Object.keys(defaultCategories).sort()).toEqual(
      ['active', 'all', 'candidatesForLabel', 'children', 'circular', 'find', 'glidePath', 'history', 'meta', 'resolveLabel', 'rulesFor', 'successors']
    );
    expect(Object.keys(createCategories(dataset)).sort()).toEqual(Object.keys(defaultCategories).sort());
  });
});
