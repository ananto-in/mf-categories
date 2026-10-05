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

## Development

```bash
npm install
npm run validate   # schema and integrity checks on data/
npm run lint:words # wording rules for README and data
npm test
```

## Disclaimer

This is an unofficial community reference compiled from publicly available SEBI circulars and AMFI data. It is **not** an official SEBI or AMFI resource and is not investment advice. The data may contain errors or lag behind the latest circulars: always check the source circular before relying on it. Provided "as is", without warranty of any kind.

## License

- Code: [MIT](LICENSE)
- Data (`data/`): [CC0 1.0](LICENSE-DATA). Credit to ananto.in is appreciated but not required.
