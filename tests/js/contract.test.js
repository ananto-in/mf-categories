import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { active, candidatesForLabel, children, circular, find, glidePath, history, resolveLabel, rulesFor, successors } from '../../src/js/index.js';

// The same cases tests/php/ContractTest.php runs: the two packages must behave identically.
const contract = JSON.parse(readFileSync(new URL('../contract/api-contract.json', import.meta.url), 'utf8'));
const ids = (list) => list.map((c) => c.id);

describe('shared API contract', () => {
  it.each(contract.find)('find($id)', (c) => {
    const category = find(c.id);
    expect(category?.name ?? null).toBe(c.name);
    if (c.name !== null) {
      expect(category).toMatchObject({ parent: c.parent, level: c.level, status: c.status });
    }
  });

  it.each(contract.children)('children($id)', (c) => {
    const list = ids(children(c.id));
    expect(list).toHaveLength(c.count);
    for (const id of c.includes ?? []) expect(list).toContain(id);
  });

  it.each(contract.isActiveOn)('isActiveOn: $id on $on is $active', (c) => {
    expect(find(c.id).isActiveOn(c.on)).toBe(c.active);
  });

  it.each(contract.active)('active($on)', (c) => {
    const list = ids(active(c.on));
    for (const id of c.includes) expect(list).toContain(id);
    for (const id of c.excludes) expect(list).not.toContain(id);
  });

  it.each(contract.invalidDates)('active() rejects the date %j', (date) => {
    expect(() => active(date)).toThrow(RangeError);
  });

  it.each(contract.resolveLabel)('resolveLabel($label)', (c) => {
    expect(resolveLabel(c.label)?.id ?? null).toBe(c.id);
  });

  it.each(contract.candidatesForLabel)('candidatesForLabel($label)', (c) => {
    expect(ids(candidatesForLabel(c.label))).toEqual(c.ids);
  });

  it.each(contract.successors)('successors($id)', (c) => {
    expect(ids(successors(c.id))).toEqual(c.ids);
  });

  it.each(contract.history)('history($id)', (c) => {
    expect(history(c.id).map((e) => e.type)).toEqual(c.types);
  });

  it.each(contract.rulesFor)('rulesFor($id)', (c) => {
    const list = rulesFor(c.id).map((r) => r.id);
    for (const id of c.includes) expect(list).toContain(id);
    for (const id of c.excludes) expect(list).not.toContain(id);
    if (c.includes.length === 0 && c.excludes.length === 0) expect(list).toEqual([]);
  });

  it.each(contract.glidePath)('glidePath($id)', (c) => {
    expect(glidePath(c.id)?.bands.length ?? null).toBe(c.bands);
  });

  it.each(contract.circular)('circular($id)', (c) => {
    expect(circular(c.id)?.number ?? null).toBe(c.number);
  });
});
