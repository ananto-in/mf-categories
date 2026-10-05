import { describe, expect, it } from 'vitest';
import { loadDataset } from '../../scripts/lib/dataset.mjs';

const ds = loadDataset();
const categories = ds.categories.categories;
const events = ds.history.events;
const byId = new Map(categories.map((c) => [c.id, c]));
const specificOf = (parent, status = 'active') =>
  categories.filter((c) => c.parent === parent && c.status === status);

describe('2026 framework structure', () => {
  it('has five active broad categories and one discontinued', () => {
    const broad = categories.filter((c) => c.level === 'broad');
    expect(broad.filter((c) => c.status === 'active').map((c) => c.id)).toEqual([
      'equity',
      'debt',
      'hybrid',
      'life_cycle',
      'other',
    ]);
    expect(broad.filter((c) => c.status === 'discontinued').map((c) => c.id)).toEqual(['solution_oriented']);
  });

  it.each([
    ['equity', 13],
    ['debt', 17],
    ['hybrid', 7],
    ['life_cycle', 6],
    ['other', 2],
  ])('has %s active specific categories: %i', (parent, count) => {
    expect(specificOf(parent)).toHaveLength(count);
  });

  it('describes every active specific category with the circular wording', () => {
    for (const c of categories.filter((x) => x.level === 'specific' && x.status === 'active')) {
      expect(c.scheme_type_description, c.id).toBeTruthy();
    }
  });

  it('cites the 2026 circular for every active category', () => {
    for (const c of categories.filter((x) => x.status === 'active')) {
      expect(c.circular, c.id).toBe('sebi-2026-02-26');
    }
  });
});

describe('characteristics taken from the circular', () => {
  const chars = (id) => byId.get(id).characteristics;
  const minPct = (id, asset) => chars(id).min_allocation.find((a) => a.asset === asset).min_pct;

  it('Multi Cap needs 75% in equity with 25% each in large, mid and small cap', () => {
    expect(minPct('equity.multi_cap', 'equity_and_equity_related')).toBe(75);
    for (const asset of ['large_cap_equity', 'mid_cap_equity', 'small_cap_equity']) {
      expect(minPct('equity.multi_cap', asset)).toBe(25);
    }
  });

  it('applies the 80% / 65% / 35% equity thresholds', () => {
    expect(minPct('equity.large_cap', 'large_cap_equity')).toBe(80);
    expect(minPct('equity.mid_cap', 'mid_cap_equity')).toBe(65);
    expect(minPct('equity.small_cap', 'small_cap_equity')).toBe(65);
    expect(minPct('equity.flexi_cap', 'equity_and_equity_related')).toBe(65);
    expect(minPct('equity.large_mid_cap', 'large_cap_equity')).toBe(35);
    expect(minPct('equity.large_mid_cap', 'mid_cap_equity')).toBe(35);
    expect(minPct('equity.elss', 'equity_and_equity_related')).toBe(80);
  });

  it('caps Focused Fund at 30 stocks', () => {
    expect(chars('equity.focused').max_stocks).toBe(30);
  });

  it.each([
    ['debt.ultra_short_term', 0.25, 0.5],
    ['debt.ultra_short_to_short_term', 0.5, 1],
    ['debt.short_term', 1, 3],
    ['debt.medium_term', 3, 4],
    ['debt.medium_to_long_term', 4, 7],
  ])('%s has Macaulay duration %d to %d years', (id, lo, hi) => {
    expect(chars(id).macaulay_duration_years).toEqual({ min: lo, max: hi });
  });

  it('Long Term is above 7 years and Medium terms may shorten to 1 year', () => {
    expect(chars('debt.long_term').macaulay_duration_years).toEqual({ min: 7 });
    expect(chars('debt.medium_term').macaulay_duration_years_adverse_conditions).toEqual({ min: 1, max: 4 });
    expect(chars('debt.medium_to_long_term').macaulay_duration_years_adverse_conditions).toEqual({ min: 1, max: 7 });
  });

  it('Sectoral debt is limited to the five permitted sectors', () => {
    expect(chars('debt.sectoral').permitted_sectors).toEqual([
      'Financial Services',
      'Energy',
      'Infrastructure',
      'Housing',
      'Real Estate',
    ]);
    expect(minPct('debt.sectoral', 'sector_debt_aa_plus_and_above')).toBe(80);
  });

  it('applies the hybrid allocation ranges', () => {
    const range = (id, asset) => chars(id).allocation_range.find((a) => a.asset === asset);
    expect(range('hybrid.conservative_hybrid', 'equity_and_equity_related')).toMatchObject({ min_pct: 10, max_pct: 25 });
    expect(range('hybrid.balanced_hybrid', 'equity_and_equity_related')).toMatchObject({ min_pct: 40, max_pct: 60 });
    expect(range('hybrid.aggressive_hybrid', 'equity_and_equity_related')).toMatchObject({ min_pct: 65, max_pct: 80 });
    expect(range('hybrid.equity_savings', 'net_equity')).toMatchObject({ min_pct: 15, max_pct: 40 });
  });

  it('requires 95% in the underlying for index funds and FoFs', () => {
    expect(minPct('other.index_funds_etfs', 'index_securities')).toBe(95);
    expect(minPct('other.fof', 'underlying_funds')).toBe(95);
  });
});

describe('classification text', () => {
  it('carries the circular wording for the broad categories', () => {
    expect(byId.get('equity').description).toBe(
      'Mutual Fund scheme predominantly investing in equity and equity related instruments'
    );
    expect(byId.get('debt').description).toBe(
      'Mutual Fund scheme predominantly investing in debt and debt related instruments'
    );
    expect(byId.get('hybrid').description).toBe(
      'Mutual Fund scheme investing in a mix of asset class i.e. equity, debt, InvITs and commodities related instruments as permitted by SEBI'
    );
    expect(byId.get('life_cycle').description).toMatch(/^An open ended fund with a target date maturity/);
  });

  it('defines the residual portion', () => {
    const rule = ds.rules.rules.find((r) => r.id === 'residual_portion_definition');
    expect(rule.summary).toMatch(/not invested in its main, core asset classes/);
  });
});

describe('FoF sub-categories (Annexure C)', () => {
  const subs = categories.filter((c) => c.level === 'sub');
  const rule = (id) => ds.rules.rules.find((r) => r.id === id);
  const fofIds = subs.map((c) => c.id);

  it('has 17 sub-categories, all under other.fof', () => {
    expect(subs).toHaveLength(17);
    for (const c of subs) {
      expect(c.parent).toBe('other.fof');
      expect(c.group, c.id).toBeTruthy();
      expect(c.description, c.id).toBeTruthy();
    }
  });

  it('lists the sub-categories under the six Annexure C groups', () => {
    const groups = [...new Set(subs.map((c) => c.group))];
    expect(groups).toEqual([
      'Equity oriented FOF (Domestic)',
      'Debt oriented FOF (Domestic)',
      'Hybrid FoF (Domestic)',
      'Commodity based FoF (Domestic)',
      'Overseas FoF: Equity oriented FOF (Overseas)',
      'Overseas FoF: Debt oriented FOF (Overseas)',
      'Domestic and Overseas FOF',
    ]);
  });

  it('keeps the group and name pair unique', () => {
    const pairs = subs.map((c) => `${c.group}|${c.name}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('applies the hybrid FoF allocations', () => {
    const range = (id, asset) =>
      byId.get(id).characteristics.allocation_range.find((a) => a.asset === asset);
    expect(range('other.fof.hybrid_aggressive', 'equity_oriented_underlying_schemes')).toMatchObject({ min_pct: 65, max_pct: 80 });
    expect(range('other.fof.hybrid_aggressive', 'debt_oriented_underlying_schemes')).toMatchObject({ min_pct: 20, max_pct: 35 });
    expect(range('other.fof.hybrid_conservative', 'equity_oriented_underlying_schemes')).toMatchObject({ min_pct: 10, max_pct: 25 });
    expect(range('other.fof.hybrid_conservative', 'debt_oriented_underlying_schemes')).toMatchObject({ min_pct: 75, max_pct: 90 });
    expect(range('other.fof.hybrid_income_plus_arbitrage', 'debt_oriented_underlying_schemes')).toMatchObject({ min_pct: 0, max_pct: 65 });
  });

  it('requires 10% in each of equity, debt and commodity schemes for Multi Asset Allocation FoF', () => {
    const alloc = byId.get('other.fof.hybrid_multi_asset_allocation').characteristics.min_allocation;
    expect(alloc.map((a) => [a.asset, a.min_pct])).toEqual([
      ['equity_oriented_underlying_schemes', 10],
      ['debt_oriented_underlying_schemes', 10],
      ['commodity_based_underlying_schemes', 10],
    ]);
  });

  it('requires at least 35% each in domestic and overseas schemes for the three combined FoFs', () => {
    for (const id of fofIds.filter((x) => x.includes('domestic_overseas'))) {
      const alloc = byId.get(id).characteristics.min_allocation;
      expect(alloc.map((a) => [a.asset, a.min_pct]), id).toEqual([
        ['domestic_underlying_schemes', 35],
        ['overseas_underlying_schemes', 35],
      ]);
    }
  });

  it('lists the nine Annexure I regions on region specific FoFs only', () => {
    const withRegions = subs.filter((c) => c.characteristics?.permitted_regions).map((c) => c.id);
    expect(withRegions).toEqual(['other.fof.overseas_equity_region_specific', 'other.fof.overseas_debt_region_specific']);
    expect(byId.get(withRegions[0]).characteristics.permitted_regions).toEqual([
      'ASEAN',
      'Europe',
      'Asia',
      'Asia Pacific',
      'Africa',
      'Middle East',
      'North America',
      'South America',
      'Oceania/Australia',
    ]);
  });

  it('introduced the sub-categories on the 30 Jun 2025 framework date', () => {
    const event = events.find((e) => e.type === 'new' && e.to.includes('other.fof.commodity_based'));
    expect(event).toMatchObject({ effective: '2025-06-30', circular: 'sebi-2026-02-26' });
    expect([...event.to].sort()).toEqual([...fofIds].sort());
  });

  describe('Annexure IV limits', () => {
    const limits = () => rule('fof_scheme_limits').parameters.limits;

    it('covers every sub-category', () => {
      expect(Object.keys(limits()).sort()).toEqual([...fofIds].sort());
    });

    it('allows a commodity FoF only as a passive option', () => {
      expect(limits()['other.fof.commodity_based']).toEqual({
        active: null,
        passive: { max: 1 },
        active_and_passive: null,
      });
    });

    it('allows one scheme per sector/theme plus one multi-sector scheme', () => {
      expect(limits()['other.fof.equity_sectoral_thematic'].active).toEqual({
        max: 1,
        per: 'sector_or_theme',
        multi_sector_max: 1,
      });
    });

    it('allows one scheme per country or region for overseas FoFs', () => {
      expect(limits()['other.fof.overseas_equity_country_specific'].passive).toEqual({ max: 1, per: 'country' });
      expect(limits()['other.fof.overseas_debt_region_specific'].passive).toEqual({ max: 1, per: 'region' });
    });

    it('allows two schemes for the diversified and debt oriented FoFs', () => {
      for (const id of ['other.fof.equity_diversified', 'other.fof.debt_oriented', 'other.fof.domestic_overseas_debt_oriented']) {
        expect(limits()[id].active_and_passive, id).toEqual({ max: 2 });
      }
    });
  });

  describe('Annexure III names', () => {
    const templates = () => rule('fof_naming').parameters.templates;

    it('covers every sub-category with templates that start with the fund house placeholder', () => {
      expect(Object.keys(templates()).sort()).toEqual([...fofIds].sort());
      for (const [id, byOption] of Object.entries(templates())) {
        for (const list of Object.values(byOption).filter(Boolean)) {
          for (const t of list) expect(t.startsWith('<<Name of Mutual Fund>>'), `${id}: ${t}`).toBe(true);
        }
      }
    });

    it('ends templates with Active, Passive and Omni FOF per option', () => {
      const t = templates()['other.fof.hybrid_aggressive'];
      expect(t.active[0]).toMatch(/Active FOF$/);
      expect(t.passive[0]).toMatch(/Passive FOF$/);
      expect(t.active_and_passive[0]).toMatch(/Omni FOF$/);
    });
  });

  it('covers every sub-category with a benchmark entry', () => {
    const covered = rule('fof_benchmarks').parameters.entries.flatMap((e) => e.categories);
    expect([...covered].sort()).toEqual([...fofIds].sort());
  });

  it('records the 95% minimum, the options and the 31 Aug 2025 re-categorisation date', () => {
    const p = rule('fof_multi_underlying_framework').parameters;
    expect(p.min_investment_in_underlying_pct).toBe(95);
    expect(Object.keys(p.options)).toEqual(['active', 'passive', 'active_and_passive']);
    expect(p.existing_fofs).toMatchObject({ recategorise_by: '2025-08-31', fundamental_attribute_change: false });
  });
});

describe('AMFI aliases', () => {
  const aliases = ds.aliases.aliases;
  const find = (label) => aliases.find((a) => a.label === label);

  it('maps current-format labels', () => {
    expect(find('Income/Debt Oriented Schemes - Short Term Fund').category).toBe('debt.short_term');
    expect(find('Equity Schemes - Thematic Fund').category).toBe('equity.thematic');
    expect(find('Equity Schemes - Sectoral Fund').category).toBe('equity.sectoral');
    expect(find('Income/Debt Oriented Schemes - Sectoral Fund').category).toBe('debt.sectoral');
    expect(find('Income/Debt Oriented Schemes - 10-year Constant Maturity Gilt Fund').category).toBe(
      'debt.gilt_10y_constant_maturity'
    );
    expect(find('Equity Schemes - ELSS- Tax Saver Fund').category).toBe('equity.elss');
    expect(find('Hybrid Schemes - Balanced Advantage Fund/ Dynamic Asset Allocation').category).toBe(
      'hybrid.dynamic_asset_allocation'
    );
    expect(find('Life Cycle Funds - Life Cycle Fund with Maturity of 30 Years').category).toBe('life_cycle.maturity_30y');
  });

  it('maps recent pre-2026 labels to the current category', () => {
    expect(find('Debt Scheme - Low Duration Fund').category).toBe('debt.ultra_short_to_short_term');
    expect(find('Debt Scheme - Dynamic Bond').category).toBe('debt.dynamic_term');
    expect(find('Equity Scheme - Value Fund').category).toBe('equity.value');
    expect(find('Solution Oriented Schemes ** - Retirement Fund').category).toBe('solution_oriented.retirement');
  });

  it('lists both candidates for the old combined Sectoral/Thematic label', () => {
    const alias = find('Equity Scheme - Sectoral/ Thematic');
    expect(alias.category).toBeUndefined();
    expect(alias.candidates).toEqual(['equity.sectoral', 'equity.thematic']);
  });

  it('stores whitespace-normalised labels', () => {
    expect(find('Other Scheme - Other ETFs').category).toBe('other.index_funds_etfs');
    expect(aliases.some((a) => /\s{2,}/.test(a.label))).toBe(false);
  });

  it('leaves out the old bare labels', () => {
    for (const label of ['Income', 'Growth', 'Balanced', 'ELSS', 'Gilt', 'Liquid', 'Money Market', 'Assured Return']) {
      expect(find(label), label).toBeUndefined();
    }
  });

  it('reaches every active specific category from at least one alias', () => {
    const reachable = new Set(aliases.flatMap((a) => (a.category ? [a.category] : a.candidates)));
    for (const c of categories.filter((x) => x.level === 'specific' && x.status === 'active')) {
      expect(reachable.has(c.id), c.id).toBe(true);
    }
  });

  it('only points at active or discontinued categories, never superseded ones', () => {
    for (const a of aliases) {
      for (const id of a.category ? [a.category] : a.candidates) {
        expect(byId.get(id).status, `${a.label} -> ${id}`).not.toBe('superseded');
      }
    }
  });
});

describe('history', () => {
  const eventsOf = (type) => events.filter((e) => e.type === type);

  it('records every rename as the same id with from_name and to_name', () => {
    for (const e of eventsOf('rename')) {
      expect(e.from, e.to_name).toEqual(e.to);
      expect(e.from_name).toBeTruthy();
      expect(byId.get(e.to[0]).name).toBe(e.to_name);
      expect(byId.get(e.to[0]).former_names).toContain(e.from_name);
    }
  });

  it('backs every former name with a rename event', () => {
    const renamed = new Set(eventsOf('rename').map((e) => `${e.to[0]}|${e.from_name}`));
    for (const c of categories.filter((x) => x.former_names)) {
      for (const name of c.former_names) expect(renamed.has(`${c.id}|${name}`), `${c.id} ${name}`).toBe(true);
    }
  });

  it('splits the two merged 2017 categories into four', () => {
    const splits = Object.fromEntries(eventsOf('split').map((e) => [e.from[0], e.to]));
    expect(splits).toEqual({
      'equity.sectoral_thematic': ['equity.sectoral', 'equity.thematic'],
      'equity.value_contra': ['equity.value', 'equity.contra'],
    });
  });

  it('ends every split source and starts every split target on the effective date', () => {
    for (const e of eventsOf('split')) {
      expect(byId.get(e.from[0]).status).toBe('superseded');
      expect(byId.get(e.from[0]).valid_to).toBe(e.effective);
      for (const id of e.to) expect(byId.get(id).valid_from).toBe(e.effective);
    }
  });

  it('gives every superseded category a split event', () => {
    const splitSources = new Set(eventsOf('split').map((e) => e.from[0]));
    for (const c of categories.filter((x) => x.status === 'superseded')) expect(splitSources.has(c.id), c.id).toBe(true);
  });

  it('closes every discontinued category with a discontinue event on its valid_to date', () => {
    const discontinued = eventsOf('discontinue').flatMap((e) => e.from.map((id) => [id, e.effective]));
    expect(discontinued.map(([id]) => id).sort()).toEqual(
      categories.filter((c) => c.status === 'discontinued').map((c) => c.id).sort()
    );
    for (const [id, effective] of discontinued) expect(byId.get(id).valid_to).toBe(effective);
  });

  it('starts every new category on the event date', () => {
    for (const e of eventsOf('new')) {
      for (const id of e.to) expect(byId.get(id).valid_from, id).toBe(e.effective);
    }
  });

  it('introduced Flexi Cap through the 2020 circular', () => {
    expect(eventsOf('new').find((e) => e.to.includes('equity.flexi_cap'))).toMatchObject({
      effective: '2020-11-06',
      circular: 'sebi-2020-11-06',
    });
  });
});

describe('life cycle glide paths', () => {
  const tenures = [5, 10, 15, 20, 25, 30];
  const pathFor = (years) => ds.glidePaths.glide_paths.find((g) => g.category === `life_cycle.maturity_${years}y`);

  it('has one glide path per tenure', () => {
    expect(ds.glidePaths.glide_paths.map((g) => g.category).sort()).toEqual(
      tenures.map((y) => `life_cycle.maturity_${y}y`).sort()
    );
  });

  it.each([
    [5, 3],
    [10, 4],
    [15, 5],
    [20, 6],
    [25, 6],
    [30, 6],
  ])('the %i year fund has %i bands', (years, count) => {
    expect(pathFor(years).bands).toHaveLength(count);
  });

  it('never extends a band beyond the fund tenure', () => {
    for (const years of tenures) {
      for (const band of pathFor(years).bands) expect(band.years_to_maturity.max).toBeLessThanOrEqual(years);
    }
  });

  it('keeps every range ordered and allows 0 to 10% in gold, silver, ETCDs and InvITs', () => {
    for (const g of ds.glidePaths.glide_paths) {
      for (const b of g.bands) {
        expect(b.equity_pct.min).toBeLessThanOrEqual(b.equity_pct.max);
        expect(b.debt_pct.min).toBeLessThanOrEqual(b.debt_pct.max);
        expect(b.gold_silver_etf_etcd_invit_pct).toEqual({ min: 0, max: 10 });
      }
    }
  });

  it('reduces equity as maturity approaches', () => {
    const equityMax = pathFor(30).bands.map((b) => b.equity_pct.max);
    expect(equityMax).toEqual([95, 80, 65, 50, 35, 20]);
  });

  it('matches the circular for the longest and shortest funds', () => {
    expect(pathFor(30).bands[0]).toMatchObject({
      years_to_maturity: { min: 15, max: 30 },
      equity_pct: { min: 65, max: 95 },
      debt_pct: { min: 5, max: 25 },
    });
    expect(pathFor(5).bands[0]).toMatchObject({
      years_to_maturity: { min: 3, max: 5 },
      equity_pct: { min: 35, max: 50 },
      debt_pct: { min: 25, max: 50 },
    });
  });
});

describe('rules', () => {
  const rule = (id) => ds.rules.rules.find((r) => r.id === id);

  it('keeps the 50% overlap caps and the 3 year glide path', () => {
    expect(rule('value_contra_overlap').parameters.max_overlap_pct).toBe(50);
    const overlap = rule('sectoral_thematic_overlap').parameters;
    expect(overlap.max_overlap_pct).toBe(50);
    expect(overlap.exempt_categories).toEqual(['equity.large_cap']);
    expect(overlap.glide_path_excess_overlap_reduction_pct.map((s) => s.pct)).toEqual([35, 35, 30]);
  });

  it('keeps the Life Cycle limits', () => {
    const structure = rule('life_cycle_structure').parameters;
    expect(structure.max_active_funds_per_fund_house).toBe(6);
    expect(structure.tenure_years).toEqual({ min: 5, max: 30, multiple_of: 5 });
    expect(rule('life_cycle_exit_load').parameters.schedule.map((s) => s.exit_load_pct)).toEqual([3, 2, 1]);
  });

  it('dates the 6 month compliance deadline', () => {
    expect(rule('compliance_timeline').parameters).toMatchObject({ months: 6, deadline: '2026-08-26' });
  });
});

describe('circulars and meta', () => {
  it('registers the three source circulars', () => {
    expect(ds.circulars.circulars.map((c) => c.id)).toEqual(['sebi-2017-10-06', 'sebi-2020-11-06', 'sebi-2026-02-26']);
  });

  it('stores the checksum of the 2026 circular PDF', () => {
    const c = ds.circulars.circulars.find((x) => x.id === 'sebi-2026-02-26');
    expect(c.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.supersedes).toEqual(['sebi-2017-10-06', 'sebi-2020-11-06']);
  });

  it('reflects the latest circular', () => {
    const latest = [...ds.circulars.circulars].sort((a, b) => b.date.localeCompare(a.date))[0];
    expect(ds.meta.circular).toBe(latest.id);
  });
});
