import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './html';

describe('sanitizeHtml', () => {
  it('keeps formatting markup', () => {
    const html = '<h2>Title</h2><p><b>bold</b> <i>it</i> <span style="color: rgb(200, 0, 0);">red</span></p><ul><li>x</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('strips script and style blocks', () => {
    expect(sanitizeHtml('a<script>alert(1)</script>b<style>.x{}</style>c')).toBe('abc');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<img src="x.png" onerror="alert(1)">')).toBe('<img src="x.png">');
    expect(sanitizeHtml("<b onclick='x()'>hi</b>")).toBe('<b>hi</b>');
    expect(sanitizeHtml('<b onmouseover=steal()>hi</b>')).toBe('<b>hi</b>');
  });

  it('neutralizes javascript: urls', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="https://ok.com">x</a>')).toBe('<a href="https://ok.com">x</a>');
  });

  it('strips iframes and embeds', () => {
    expect(sanitizeHtml('a<iframe src="x"></iframe>b<embed src="y">c')).toBe('abc');
  });
});
