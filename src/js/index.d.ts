export type CategoryLevel = 'broad' | 'specific' | 'sub';
export type CategoryStatus = 'active' | 'superseded' | 'discontinued';

/** One category. Immutable; dates are 'YYYY-MM-DD' strings. */
export class Category {
  readonly id: string;
  readonly parent: string | null;
  readonly level: CategoryLevel;
  readonly name: string;
  readonly shortName: string | null;
  readonly group: string | null;
  readonly status: CategoryStatus;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly circular: string | null;
  readonly schemeTypeDescription: string | null;
  readonly description: string | null;
  /** SEBI's structured characteristics, as in categories.json (snake_case keys). */
  readonly characteristics: Readonly<Record<string, unknown>>;
  readonly formerNames: readonly string[];
  readonly note: string | null;

  constructor(row: Record<string, unknown>);

  /** True when validFrom <= date < validTo. Throws a RangeError for a malformed date. */
  isActiveOn(date: Date | string): boolean;
}

export interface HistoryEvent {
  type: 'rename' | 'split' | 'merge' | 'replace' | 'discontinue' | 'new';
  from: string[];
  to: string[];
  effective: string;
  circular: string;
  from_name?: string;
  to_name?: string;
  note?: string;
}

export interface Rule {
  id: string;
  name: string;
  applies_to: string[];
  circular: string;
  summary?: string;
  parameters: Record<string, unknown>;
}

export interface GlidePath {
  category: string;
  circular: string;
  bands: Array<{
    years_to_maturity: { min?: number; max?: number };
    equity_pct: { min?: number; max?: number };
    debt_pct: { min?: number; max?: number };
    gold_silver_etf_etcd_invit_pct?: { min?: number; max?: number };
    note?: string;
  }>;
}

export interface Circular {
  id: string;
  number: string;
  title: string;
  date: string;
  url: string;
  sha256?: string | null;
  supersedes?: string[];
}

export interface Meta {
  dataset_version: string;
  circular: string | null;
  generated_at?: string;
}

/** The parsed contents of the files in data/. */
export interface Dataset {
  categories: { categories: Array<Record<string, unknown>> };
  aliases: { aliases: Array<{ label: string; category?: string; candidates?: string[] }> };
  history: { events: HistoryEvent[] };
  circulars: { circulars: Circular[] };
  glidePaths: { glide_paths: GlidePath[] };
  rules: { rules: Rule[] };
  meta: Meta;
}

export interface Categories {
  /** Every category, including superseded and discontinued ones, in file order. */
  all(): Category[];
  find(id: string): Category | null;
  /** Direct children only (broad -> specific, specific -> sub). */
  children(id: string): Category[];
  /** Categories in force on a date (today by default). Throws a RangeError for a malformed date. */
  active(on?: Date | string): Category[];
  /** The category an AMFI label maps to; null when the label is unknown or ambiguous. */
  resolveLabel(label: string): Category | null;
  /** Every category a label can mean: several for an ambiguous label, none for an unknown one. */
  candidatesForLabel(label: string): Category[];
  /** Categories that continue a split, merged or replaced category. A rename keeps the same id. */
  successors(id: string): Category[];
  /** Lifecycle events naming the category, or every event when no id is given. */
  history(id?: string): HistoryEvent[];
  /** Rules on the category or any of its parents. */
  rulesFor(id: string): Rule[];
  glidePath(id: string): GlidePath | null;
  circular(id: string): Circular | null;
  meta(): Meta;
}

/** Builds the API over your own dataset instead of the packaged one. */
export function createCategories(dataset?: Dataset): Categories;

declare const categories: Categories;
export default categories;

export const all: Categories['all'];
export const find: Categories['find'];
export const children: Categories['children'];
export const active: Categories['active'];
export const resolveLabel: Categories['resolveLabel'];
export const candidatesForLabel: Categories['candidatesForLabel'];
export const successors: Categories['successors'];
export const history: Categories['history'];
export const rulesFor: Categories['rulesFor'];
export const glidePath: Categories['glidePath'];
export const circular: Categories['circular'];
export const meta: Categories['meta'];
