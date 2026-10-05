import { describe, expect, it } from 'vitest';
import { loadDataset, validateDataset } from '../../scripts/lib/dataset.mjs';

const circular = {
  id: 'sebi-2026-02-26',
  number: 'HO/24/13/15(2)2026-IMD-RAC4/I/5764/2026',
  title: 'Categorization and Rationalization of Mutual Fund Schemes',
  date: '2026-02-26',
  url: 'https://www.sebi.gov.in/legal/circulars/feb-2026/categorization-and-rationalization-of-mutual-fund-schemes_99983.html',
};

const category = (overrides) => ({
  parent: null,
  level: 'broad',
  status: 'active',
  valid_from: '2026-02-26',
  valid_to: null,
  circular: 'sebi-2026-02-26',
  ...overrides,
});

const validDataset = () => ({
  categories: {
    categories: [
      category({ id: 'debt', name: 'Debt Schemes' }),
      category({ id: 'debt.short_term', parent: 'debt', level: 'specific', name: 'Short Term Fund' }),
      category({
        id: 'debt.short_duration',
        parent: 'debt',
        level: 'specific',
        name: 'Short Duration Fund',
        status: 'superseded',
        valid_from: '2017-10-06',
        valid_to: '2026-02-26',
      }),
    ],
  },
  aliases: {
    aliases: [
      {
        label: 'Income/Debt Oriented Schemes - Short Term Fund',
        category: 'debt.short_term',
        source: 'amfi_scheme_data',
        seen_from: '2026-08',
      },
    ],
  },
  history: {
    events: [
      {
        type: 'rename',
        from: ['debt.short_duration'],
        to: ['debt.short_term'],
        effective: '2026-02-26',
        circular: 'sebi-2026-02-26',
      },
    ],
  },
  circulars: { circulars: [{ ...circular }] },
  glidePaths: { glide_paths: [] },
  rules: { rules: [] },
  meta: { dataset_version: '0.1.0', circular: 'sebi-2026-02-26' },
});

const withChange = (mutate) => {
  const ds = validDataset();
  mutate(ds);
  return validateDataset(ds);
};

describe('repository dataset', () => {
  it('is valid', () => {
    expect(validateDataset(loadDataset())).toEqual([]);
  });
});

describe('validateDataset', () => {
  it('accepts a well-formed dataset', () => {
    expect(validateDataset(validDataset())).toEqual([]);
  });

  describe('schema', () => {
    it('rejects an id that is not a lowercase dotted slug', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[0].id = 'Debt Schemes';
      });
      expect(errors.join('\n')).toContain('categories.json/categories/0/id');
    });

    it('rejects an unknown status', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[0].status = 'retired';
      });
      expect(errors.join('\n')).toContain('categories.json/categories/0/status');
    });

    it('requires an alias to name a category or candidates', () => {
      const errors = withChange((ds) => {
        delete ds.aliases.aliases[0].category;
      });
      expect(errors.join('\n')).toContain('aliases.json');
    });

    it('requires a split event to produce at least two categories', () => {
      const errors = withChange((ds) => {
        ds.history.events[0].type = 'split';
      });
      expect(errors.join('\n')).toContain('history.json');
    });

    it('rejects a malformed date', () => {
      const errors = withChange((ds) => {
        ds.circulars.circulars[0].date = '26-02-2026';
      });
      expect(errors.join('\n')).toContain('circulars.json/circulars/0/date');
    });

    it('does not run integrity checks while schema errors exist', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[0].status = 'retired';
        ds.aliases.aliases[0].category = 'debt.missing';
      });
      expect(errors.join('\n')).not.toContain('unknown category');
    });
  });

  describe('integrity', () => {
    it('rejects duplicate category ids', () => {
      const errors = withChange((ds) => {
        ds.categories.categories.push({ ...ds.categories.categories[0] });
      });
      expect(errors).toContain('categories.json: duplicate id "debt"');
    });

    it('rejects a specific category with an unknown parent', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[1].parent = 'equity';
        ds.categories.categories[1].id = 'equity.short_term';
      });
      expect(errors).toContain('categories.json: "equity.short_term" has unknown parent "equity"');
    });

    it('requires a specific id to start with its parent', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[1].id = 'hybrid.short_term';
      });
      expect(errors).toContain('categories.json: id "hybrid.short_term" must start with its parent "debt."');
    });

    it('rejects a broad category that has a parent', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[0].parent = 'debt';
      });
      expect(errors).toContain('categories.json: broad category "debt" must have parent null');
    });

    it('requires active categories to have no valid_to', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[1].valid_to = '2030-01-01';
      });
      expect(errors).toContain('categories.json: active "debt.short_term" must have valid_to null');
    });

    it('requires superseded categories to have valid_to', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[2].valid_to = null;
      });
      expect(errors).toContain('categories.json: superseded "debt.short_duration" needs valid_to');
    });

    it('rejects valid_from after valid_to', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[2].valid_from = '2027-01-01';
      });
      expect(errors).toContain('categories.json: "debt.short_duration" has valid_from after valid_to');
    });

    it('rejects a category that cites an unknown circular', () => {
      const errors = withChange((ds) => {
        ds.categories.categories[0].circular = 'sebi-1999-01-01';
      });
      expect(errors).toContain('categories.json: category "debt" references unknown circular "sebi-1999-01-01"');
    });

    it('rejects an alias pointing at an unknown category', () => {
      const errors = withChange((ds) => {
        ds.aliases.aliases[0].category = 'debt.missing';
      });
      expect(errors).toContain('aliases.json: alias "Income/Debt Oriented Schemes - Short Term Fund" references unknown category "debt.missing"');
    });

    it('rejects duplicate alias labels', () => {
      const errors = withChange((ds) => {
        ds.aliases.aliases.push({ ...ds.aliases.aliases[0] });
      });
      expect(errors).toContain('aliases.json: duplicate label "Income/Debt Oriented Schemes - Short Term Fund"');
    });

    it('rejects a history event referencing an unknown category', () => {
      const errors = withChange((ds) => {
        ds.history.events[0].to = ['debt.missing'];
      });
      expect(errors).toContain('history.json: rename event references unknown category "debt.missing"');
    });

    it('rejects a circular superseding an unknown circular', () => {
      const errors = withChange((ds) => {
        ds.circulars.circulars[0].supersedes = ['sebi-2017-10-06'];
      });
      expect(errors).toContain('circulars.json: circular "sebi-2026-02-26" supersedes references unknown circular "sebi-2017-10-06"');
    });

    it('rejects a rule applying to an unknown category', () => {
      const errors = withChange((ds) => {
        ds.rules.rules.push({
          id: 'overlap',
          name: 'Overlap',
          applies_to: ['equity.thematic'],
          circular: 'sebi-2026-02-26',
          parameters: {},
        });
      });
      expect(errors).toContain('rules.json: rule "overlap" references unknown category "equity.thematic"');
    });

    it('rejects a glide path for an unknown category', () => {
      const errors = withChange((ds) => {
        ds.glidePaths.glide_paths.push({
          category: 'life_cycle.maturity_5y',
          circular: 'sebi-2026-02-26',
          bands: [{ years_to_maturity: { min: 3, max: 5 }, equity_pct: { min: 35, max: 50 }, debt_pct: { min: 25, max: 50 } }],
        });
      });
      expect(errors).toContain('glide-paths.json: glide path references unknown category "life_cycle.maturity_5y"');
    });

    it('rejects meta pointing at an unknown circular', () => {
      const errors = withChange((ds) => {
        ds.meta.circular = 'sebi-1999-01-01';
      });
      expect(errors).toContain('meta.json: meta references unknown circular "sebi-1999-01-01"');
    });
  });
});
