import { loadDataset, validateDataset } from './lib/dataset.mjs';

const errors = validateDataset(loadDataset());

if (errors.length > 0) {
  console.error(`Dataset has ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('Dataset is valid.');
