import { buildRef } from './household-ref-picker.component';

// buildRef's output format is a cross-stack contract: the React
// HouseholdRefPicker must produce byte-identical strings, and the backend
// uses this exact string as the `householdRef` query param on PUT/DELETE
// /households/item. A drift here silently breaks household edit/delete
// with no other test catching it.
describe('HouseholdRefPickerComponent buildRef', () => {
  it('composes a single apartment', () => {
    expect(buildRef([{ building: 'X3', number: 1 }])).toBe('X3 АП1');
  });

  it('groups multiple apartments in the same building', () => {
    expect(buildRef([{ building: 'X3', number: 1 }, { building: 'X3', number: 2 }]))
      .toBe('X3 АП1/2');
  });

  it('joins apartments across two buildings, sorted by building then number', () => {
    expect(buildRef([
      { building: 'X4', number: 3 },
      { building: 'X3', number: 2 },
      { building: 'X3', number: 1 },
    ])).toBe('X3 АП1/2 / X4 АП3');
  });

  it('ignores rows with no building or no apartment number', () => {
    expect(buildRef([{ building: '', number: 0 }, { building: 'X3', number: 0 }]))
      .toBe('');
  });

  it('returns empty string for an empty list', () => {
    expect(buildRef([])).toBe('');
  });
});
