import { describe, expect, it } from 'vitest';
import { extractText, systemPromptFor } from './ai';

describe('systemPromptFor', () => {
  it('includes the mode-specific instruction', () => {
    expect(systemPromptFor('shorter')).toMatch(/shorter/i);
    expect(systemPromptFor('formal')).toMatch(/formal/i);
    expect(systemPromptFor('blunt')).toMatch(/blunt/i);
  });

  it('demands only the rewritten text', () => {
    expect(systemPromptFor('shorter')).toMatch(/only the rewritten email body/i);
  });
});

describe('extractText', () => {
  it('joins text blocks and ignores other block types', () => {
    const content = [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ];
    expect(extractText(content)).toBe('Hello world');
  });

  it('trims surrounding whitespace', () => {
    expect(extractText([{ type: 'text', text: '\n  hi  \n' }])).toBe('hi');
  });

  it('returns empty string for no text blocks', () => {
    expect(extractText([{ type: 'thinking' }])).toBe('');
  });
});
