import aliasesFile from '../../data/aliases.json' with { type: 'json' };
import categoriesFile from '../../data/categories.json' with { type: 'json' };
import circularsFile from '../../data/circulars.json' with { type: 'json' };
import glidePathsFile from '../../data/glide-paths.json' with { type: 'json' };
import historyFile from '../../data/history.json' with { type: 'json' };
import metaFile from '../../data/meta.json' with { type: 'json' };
import rulesFile from '../../data/rules.json' with { type: 'json' };

/**
 * One category (broad, specific or sub). Immutable.
 *
 * Dates are 'YYYY-MM-DD' strings. A category is in force on a date when
 * validFrom <= date and (validTo is null or date < validTo).
 */
export class Category {
  constructor(row) {
    this.id = row.id;
    this.parent = row.parent;
    this.level = row.level;
    this.name = row.name;
    this.shortName = row.short_name ?? null;
    this.group = row.group ?? null;
    this.status = row.status;
    this.validFrom = row.valid_from;
    this.validTo = row.valid_to;
    this.circular = row.circular;
    this.schemeTypeDescription = row.scheme_type_description ?? null;
    this.description = row.description ?? null;
    this.characteristics = structuredClone(row.characteristics ?? {});
    this.formerNames = [...(row.former_names ?? [])];
    this.note = row.note ?? null;
    Object.freeze(this.formerNames);
    Object.freeze(this);
  }

  isActiveOn(date) {
    const day = toDay(date);
    return (this.validFrom === null || this.validFrom <= day) && (this.validTo === null || day < this.validTo);
  }
}

const pad = (n, width) => String(n).padStart(width, '0');

/** Accepts a Date (its local calendar day) or a 'YYYY-MM-DD' string; anything else throws a RangeError. */
const toDay = (date) => {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new RangeError('Expected a valid Date');
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
  }

  const match = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day) {
      return date;
    }
  }
  throw new RangeError(`Expected a date as YYYY-MM-DD, got "${date}"`);
};

const normalizeLabel = (label) => label.replace(/\s+/g, ' ').trim().toLowerCase();

const defaultDataset = {
  categories: categoriesFile,
  aliases: aliasesFile,
  history: historyFile,
  circulars: circularsFile,
  glidePaths: glidePathsFile,
  rules: rulesFile,
  meta: metaFile,
};

/**
 * Creates the read-only API over a dataset (the parsed contents of the files in data/).
 * Indexes are built on first use. Categories are immutable objects; rules, history, glide paths,
 * circulars and meta are returned as copies of the plain objects found in the JSON files.
 */
export const createCategories = (dataset = defaultDataset) => {
  let categoryIndex;
  let aliasIndex;

  const categories = () => {
    if (!categoryIndex) {
      const list = dataset.categories.categories.map((row) => new Category(row));
      const byId = new Map();
      const children = new Map();
      for (const category of list) {
        byId.set(category.id, category);
        if (category.parent !== null) {
          if (!children.has(category.parent)) children.set(category.parent, []);
          children.get(category.parent).push(category);
        }
      }
      categoryIndex = { list, byId, children };
    }
    return categoryIndex;
  };

  const aliases = () => {
    if (!aliasIndex) {
      aliasIndex = new Map(
        dataset.aliases.aliases.map((alias) => [normalizeLabel(alias.label), alias.candidates ?? [alias.category]])
      );
    }
    return aliasIndex;
  };

  const find = (id) => categories().byId.get(id) ?? null;

  const candidatesForLabel = (label) =>
    (aliases().get(normalizeLabel(label)) ?? []).map(find).filter((category) => category !== null);

  return Object.freeze({
    all: () => [...categories().list],

    find,

    children: (id) => [...(categories().children.get(id) ?? [])],

    active: (on = new Date()) => {
      const day = toDay(on);
      return categories().list.filter((category) => category.isActiveOn(day));
    },

    resolveLabel: (label) => {
      const candidates = candidatesForLabel(label);
      return candidates.length === 1 ? candidates[0] : null;
    },

    candidatesForLabel,

    successors: (id) => {
      const ids = new Set();
      for (const event of dataset.history.events) {
        if (['split', 'merge', 'replace'].includes(event.type) && event.from.includes(id)) {
          event.to.forEach((target) => ids.add(target));
        }
      }
      ids.delete(id);
      return [...ids].map(find).filter((category) => category !== null);
    },

    history: (id) =>
      structuredClone(
        id === undefined || id === null
          ? dataset.history.events
          : dataset.history.events.filter((event) => event.from.includes(id) || event.to.includes(id))
      ),

    rulesFor: (id) => {
      const chain = [];
      for (let current = find(id); current !== null; current = find(current.parent ?? '')) {
        chain.push(current.id);
      }
      return structuredClone(dataset.rules.rules.filter((rule) => rule.applies_to.some((target) => chain.includes(target))));
    },

    glidePath: (id) => {
      const glidePath = dataset.glidePaths.glide_paths.find((entry) => entry.category === id);
      return glidePath ? structuredClone(glidePath) : null;
    },

    circular: (id) => {
      const circular = dataset.circulars.circulars.find((entry) => entry.id === id);
      return circular ? structuredClone(circular) : null;
    },

    meta: () => structuredClone(dataset.meta),
  });
};

const categories = createCategories();

export const { all, find, children, active, resolveLabel, candidatesForLabel, successors, history, rulesFor, glidePath, circular, meta } =
  categories;

export default categories;
