import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  parsePasted,
  renderTemplate,
  templateVars,
} from './outreach';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('ada@cs.stanford.edu')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('tolerates surrounding whitespace', () => {
    expect(isValidEmail('  ada@cs.stanford.edu ')).toBe(true);
  });
});

describe('parsePasted', () => {
  it('uses the first row as headers when it has no email', () => {
    const text = 'name\temail\tpaper\nAda\tada@cs.stanford.edu\tOn Computable Numbers';
    expect(parsePasted(text)).toEqual({
      columns: ['name', 'email', 'paper'],
      rows: [{ name: 'Ada', email: 'ada@cs.stanford.edu', paper: 'On Computable Numbers' }],
    });
  });
  it('lowercases header names', () => {
    const text = 'Name\tEmail\nAda\tada@cs.stanford.edu';
    expect(parsePasted(text).columns).toEqual(['name', 'email']);
  });
  it('treats the first row as data when it contains an email, auto-naming columns', () => {
    const text = 'Ada\tada@cs.stanford.edu\nGrace\tgrace@mit.edu';
    expect(parsePasted(text)).toEqual({
      columns: ['col1', 'email'],
      rows: [
        { col1: 'Ada', email: 'ada@cs.stanford.edu' },
        { col1: 'Grace', email: 'grace@mit.edu' },
      ],
    });
  });
  it('handles CRLF, blank lines, and ragged short rows', () => {
    const text = 'name\temail\r\nAda\tada@cs.stanford.edu\r\n\r\nGrace\t';
    expect(parsePasted(text).rows).toEqual([
      { name: 'Ada', email: 'ada@cs.stanford.edu' },
      { name: 'Grace', email: '' },
    ]);
  });
  it('returns empty for empty paste', () => {
    expect(parsePasted('  \n ')).toEqual({ columns: [], rows: [] });
  });
});

describe('templateVars', () => {
  it('finds unique variables, whitespace-tolerant', () => {
    expect(templateVars('hi {{name}}, i read {{ paper }} and {{name}}')).toEqual([
      'name',
      'paper',
    ]);
  });
  it('is empty for a plain string', () => {
    expect(templateVars('no variables here')).toEqual([]);
  });
});

describe('renderTemplate', () => {
  it('substitutes fields', () => {
    expect(renderTemplate('hi {{name}}, re: {{ paper }}', { name: 'Ada', paper: 'CN' })).toBe(
      'hi Ada, re: CN',
    );
  });
  it('leaves unknown variables literal so they are visible in preview', () => {
    expect(renderTemplate('hi {{nmae}}', { name: 'Ada' })).toBe('hi {{nmae}}');
  });
});
