# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## Rules

- **Never commit or push without the owner reviewing and confirming it first.** Leave changes in the working tree.
- Plan first: write plans to `docs/plans/` (local only, git-ignored), e.g. `v1-design.md`. Get explicit approval before implementing a plan.
- TDD: tests before or alongside implementation; no feature without tests.
- Compliance: never use the words "planning" or "advisory" in public-facing text (README, CHANGELOG, package descriptions, data). `npm run lint:words` enforces it. `docs/plans/` is exempt.
- Licenses: code is MIT (`LICENSE`), data in `data/` is CC0 (`LICENSE-DATA`).

## Project

`mf-categories` is open reference data for Indian mutual fund scheme categories: SEBI's categorization with stable IDs, characteristics, AMFI label aliases and change history. The JSON in `data/` is the single source of truth; the PHP (`src/php`) and JS (`src/js`) packages are thin readers of it. Published names: Composer `ananto-in/mf-categories`, npm `@ananto-in/mf-categories` (`package.json` is `private` until the first release).

**IDs are the contract.** Category IDs are lowercase dotted slugs (`debt.short_term`), never renamed, reused or removed. A rename changes `name`, never `id`; splits/merges are recorded in `history.json`.

## Layout

- `data/*.json` - dataset; `data/schema/*.schema.json` - JSON Schema (2020-12) for each file
- `scripts/lib/dataset.mjs` - loads the dataset, runs schema + integrity checks; `scripts/lib/words.mjs` - banned-word check
- `tests/js/` - Vitest; `tests/php/` - PHPUnit (not yet)
- `docs/plans/` - local working plans (git-ignored)

## Commands

```bash
npm install
npm run validate     # schema + integrity checks on data/
npm run lint:words   # banned-word check on public-facing files
npm test             # vitest
```

PHP package, release workflow and PHP CI job are not built yet (see the plan's phases).

## Source material

Primary source: SEBI circular HO/24/13/15(2)2026-IMD-RAC4/I/5764/2026 dated 26-Feb-2026 (supersedes clause 2.6 of the Master Circular for Mutual Funds). Always cite the circular id on each entry; do not copy circular PDFs into the repo (store URL + sha256 in `data/circulars.json`).
