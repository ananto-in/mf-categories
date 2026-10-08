# Changelog

All notable changes are recorded here. Versioning follows [Semantic Versioning](https://semver.org/):
removing or renaming a category ID or changing the API is a major change; new categories, aliases and
history entries are minor; corrections are patches.

## [Unreleased]

### Added
- Repository scaffold: JSON Schemas, dataset validator, wording check, CI skeleton.
- Dataset reflecting SEBI circular HO/24/13/15(2)2026-IMD-RAC4/I/5764/2026 (26 Feb 2026):
  - 5 active broad categories (Equity, Debt, Hybrid, Life Cycle Funds, Other) and the discontinued Solution Oriented category.
  - 45 active specific categories with SEBI's scheme type description and structured characteristics
    (minimum allocations, Macaulay duration bands, allocation ranges).
  - Superseded categories from the pre-2026 framework (`equity.sectoral_thematic`, `equity.value_contra`)
    and the renames, splits, new and discontinued categories as history events.
  - Life Cycle Fund glide paths for the 5, 10, 15, 20, 25 and 30 year tenures (Annexure B).
  - Cross-category rules: portfolio overlap limits, residual portion permissions, Life Cycle limits and exit load,
    compliance timeline.
  - Circular registry with the checksum of the 2026 circular PDF.
  - Compact `short_name` labels (for example "Short Term") on every broad and specific category, unique across the dataset;
    `name` stays SEBI's wording.
  - SEBI's classification wording on the broad categories (`description`) and the definition of the residual portion.
  - 17 Fund of Fund sub-categories (new `sub` level, 3-segment ids under `other.fof`) from Annexure C, with
    allocations, permitted regions (Annexure I), per-fund-house limits (Annexure IV), name templates
    (Annexure III), benchmarks (Annexure II) and the FoF framework rules.
  - 96 AMFI label aliases for current and recent label formats, built from the 4 Oct 2026 scheme data file.
    The oldest bare labels (`Income`, `Growth`, `Balanced`, ...) and close-ended debt labels
    (`Fixed Term Plan`, `Other Debt Scheme`) are deliberately not mapped.

- PHP package (`ananto-in/mf-categories`, PHP >= 8.1, no runtime dependencies): `Categories` with `all`, `find`,
  `children`, `active`, `resolveLabel`, `candidatesForLabel`, `successors`, `history`, `rulesFor`, `glidePath`,
  `circular`, `meta`, and an immutable `Category`. Files are loaded lazily and cached per process.
- PHP CI job (PHP 8.1 to 8.4: PSR-12 and PHPUnit).
- JavaScript package (`@ananto-in/mf-categories`, ES modules, Node >= 20.10, TypeScript types, no dependencies) with
  the same operations as the PHP package, as named exports, a default export and `createCategories(dataset)`.
- Shared API contract (`tests/contract/api-contract.json`) run by both the PHP and JS tests.
- JS CI matrix: Node 20, 22 and 24.

### Known gaps
- Pre-2026 names (renames and the two superseded categories) come from the 2017 framework and the AMFI labels
  that mirror it; the 6 Oct 2017 circular text has not yet been compared line by line.
- The Life Cycle aliases for 20 and 25 years are derived from the label pattern and not yet seen in AMFI data.
