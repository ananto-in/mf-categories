# mf-categories

Open reference data for Indian mutual fund scheme categories: SEBI's categorization with stable IDs, characteristics, AMFI label aliases and change history. JSON, with PHP and JS packages.

> **Status: work in progress.** The dataset is being built; nothing is published to Packagist or npm yet.

## Why

SEBI renames, splits and discontinues scheme categories from time to time (most recently by the circular dated 26 February 2026). Systems that store category *names* break when that happens. This project gives every category a **stable ID**, records what each category was called and when, and maps the labels AMFI publishes to those IDs.

## What is in the dataset

| File | Contents |
|---|---|
| `data/categories.json` | Broad and specific categories, with SEBI's characteristics and validity dates |
| `data/aliases.json` | AMFI scheme-data labels (old and new formats) mapped to category IDs |
| `data/history.json` | Renames, splits, replacements, new and discontinued categories, with effective dates |
| `data/circulars.json` | The SEBI circulars the data is derived from |
| `data/glide-paths.json` | Life Cycle Fund asset allocation by years to maturity |
| `data/rules.json` | Cross-category rules (portfolio overlap limits, per-fund-house limits, exit loads) |
| `data/meta.json` | Dataset version and the latest circular it reflects |
| `data/schema/` | JSON Schema for each file |

## Principles

- **IDs never change or get reused.** A rename changes a label, not an ID.
- **Every fact cites a circular.**
- **JSON is the source of truth.** The PHP and JS packages only read it.

## Packages (planned)

- Composer: `ananto-in/mf-categories`
- npm: `@ananto-in/mf-categories`

## API

The PHP and JS packages expose the same operations. `Category` is a typed, immutable object with camelCase properties
(`id`, `parent`, `level`, `name`, `shortName`, `group`, `status`, `validFrom`, `validTo`, `circular`,
`schemeTypeDescription`, `description`, `characteristics`, `formerNames`, `note`). Rules, history, glide paths,
circulars and meta are returned as the plain objects found in the JSON files.

| Operation | Returns |
|---|---|
| `all()` | every category, including superseded and discontinued |
| `find(id)` | a category or null |
| `children(id)` | direct children |
| `active(on?)` | categories in force on a date (today by default); `validFrom <= on < validTo` |
| `resolveLabel(label)` | the category an AMFI label maps to; null if unknown or ambiguous |
| `candidatesForLabel(label)` | every category a label can mean (several for an ambiguous label) |
| `successors(id)` | categories that continue a split, merged or replaced category (a rename keeps its id) |
| `history(id?)` | lifecycle events for a category, or all events |
| `rulesFor(id)` | rules on the category or any of its parents |
| `glidePath(id)` | Life Cycle glide path, or null |
| `circular(id)` / `meta()` | source circular / dataset version |

Label matching ignores case and repeated or surrounding whitespace.

### PHP

```php
use Ananto\MfCategories\Categories;

$categories = new Categories();
$categories->resolveLabel('Income/Debt Oriented Schemes - Short Term Fund')?->id; // "debt.short_term"
$categories->find('debt.short_term')?->formerNames;                              // ["Short Duration Fund"]
$categories->active('2026-02-25');                                               // categories before the 2026 circular
```

### JavaScript

ES modules, no dependencies, TypeScript types included. Needs Node 20.10+ (JSON import attributes) or a bundler
that supports them (Vite, webpack 5, esbuild, Rollup).

```js
import categories, { resolveLabel, active } from '@ananto-in/mf-categories';

resolveLabel('Income/Debt Oriented Schemes - Short Term Fund')?.id; // "debt.short_term"
categories.find('debt.short_term')?.formerNames;                    // ["Short Duration Fund"]
active('2026-02-25');                                               // categories before the 2026 circular
```

Every operation is available as a named export and on the default export. Dates can be a `Date` (its local calendar
day) or a `YYYY-MM-DD` string; anything else throws a `RangeError` (the PHP package throws `InvalidArgumentException`).
`createCategories(dataset)` builds the same API over your own copy of the data.

The JS package parses all data files when imported and adds about 121 KB (14 KB gzipped) to a bundle. For a front end
that needs only a label or two, fetch the JSON files you need from the package's `data/` directory instead.

Both packages are tested against the same cases in `tests/contract/api-contract.json`, so they behave identically.

### PHP: performance

Each data file is read on first use and cached for the rest of the process: the first label lookup costs about a
millisecond, later lookups under a microsecond, and about 1.5 MB of memory. Create one `Categories` per process
(or register it as a shared service); instances share the parsed data.

## Development

```bash
npm install
npm run validate   # schema and integrity checks on data/
npm run lint:words # wording rules for README and data
npm test           # JS and dataset tests

composer install
composer test      # PHPUnit
composer cs        # PSR-12
```

## Disclaimer

This is an unofficial community reference compiled from publicly available SEBI circulars and AMFI data. It is **not** an official SEBI or AMFI resource and is not investment advice. The data may contain errors or lag behind the latest circulars: always check the source circular before relying on it. Provided "as is", without warranty of any kind.

## License

- Code: [MIT](LICENSE)
- Data (`data/`): [CC0 1.0](LICENSE-DATA). Credit to ananto.in is appreciated but not required.
