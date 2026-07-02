import { describe, expect, it } from 'vitest';
import {
  buildMime,
  decodeBase64Url,
  encodeHeader,
  extractBody,
  header,
  parseMessage,
  parseSender,
  stripHtml,
  toBase64Url,
  type GmailMessage,
} from './gmail';

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_');
}

describe('header', () => {
  it('finds headers case-insensitively', () => {
    const headers = [{ name: 'Subject', value: 'Hi' }];
    expect(header(headers, 'subject')).toBe('Hi');
    expect(header(headers, 'SUBJECT')).toBe('Hi');
  });

  it('returns empty string when missing', () => {
    expect(header([], 'From')).toBe('');
    expect(header(undefined, 'From')).toBe('');
  });
});

describe('parseSender', () => {
  it('parses "Name" <email> form', () => {
    expect(parseSender('"Dana Whitfield" <dana@northbeam.io>')).toEqual({
      name: 'Dana Whitfield',
      email: 'dana@northbeam.io',
    });
  });

  it('parses unquoted Name <email> form', () => {
    expect(parseSender('Dana Whitfield <dana@northbeam.io>')).toEqual({
      name: 'Dana Whitfield',
      email: 'dana@northbeam.io',
    });
  });

  it('falls back to the address for bare emails', () => {
    expect(parseSender('dana@northbeam.io')).toEqual({
      name: 'dana@northbeam.io',
      email: 'dana@northbeam.io',
    });
  });

  it('uses email as name when display name is empty', () => {
    expect(parseSender('<dana@northbeam.io>')).toEqual({
      name: 'dana@northbeam.io',
      email: 'dana@northbeam.io',
    });
  });
});

describe('decodeBase64Url', () => {
  it('decodes url-safe base64 with UTF-8', () => {
    expect(decodeBase64Url(b64url('héllo — wörld'))).toBe('héllo — wörld');
  });
});

describe('stripHtml', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtml('<b>Tom &amp; Jerry</b>')).toBe('Tom & Jerry');
  });

  it('turns block ends and breaks into newlines', () => {
    expect(stripHtml('<p>one</p><p>two<br>three</p>')).toBe('one\ntwo\nthree');
  });

  it('drops style and script contents', () => {
    expect(stripHtml('<style>.x{color:red}</style>hi<script>alert(1)</script>')).toBe('hi');
  });
});

describe('extractBody', () => {
  it('reads a simple text/plain body', () => {
    expect(extractBody({ mimeType: 'text/plain', body: { data: b64url('hello') } })).toBe('hello');
  });

  it('prefers text/plain in nested multiparts', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<b>html</b>') } },
        {
          mimeType: 'multipart/related',
          parts: [{ mimeType: 'text/plain', body: { data: b64url('plain') } }],
        },
      ],
    };
    expect(extractBody(payload)).toBe('plain');
  });

  it('falls back to stripped html', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [{ mimeType: 'text/html', body: { data: b64url('<p>only html</p>') } }],
    };
    expect(extractBody(payload)).toBe('only html');
  });

  it('returns empty string when nothing usable', () => {
    expect(extractBody({ mimeType: 'multipart/mixed', parts: [] })).toBe('');
  });
});

describe('encodeHeader', () => {
  it('passes plain ASCII through', () => {
    expect(encodeHeader('Hello world')).toBe('Hello world');
  });

  it('RFC 2047-encodes non-ASCII', () => {
    const encoded = encodeHeader('héllo');
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });
});

describe('buildMime', () => {
  it('builds headers and base64 body', () => {
    const mime = buildMime({ to: 'a@b.com', subject: 'Hi', body: 'hello' });
    expect(mime).toContain('To: a@b.com\r\n');
    expect(mime).toContain('Subject: Hi\r\n');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    const body = mime.split('\r\n\r\n')[1];
    expect(atob(body)).toBe('hello');
  });

  it('adds reply threading headers', () => {
    const mime = buildMime({ to: 'a@b.com', subject: 'Re: Hi', body: 'x', inReplyTo: '<msg1@mail>' });
    expect(mime).toContain('In-Reply-To: <msg1@mail>\r\n');
    expect(mime).toContain('References: <msg1@mail>\r\n');
  });
});

describe('toBase64Url', () => {
  it('produces url-safe unpadded output', () => {
    const out = toBase64Url('subjects?>>~~');
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe('parseMessage', () => {
  it('maps a Gmail message to an Email', () => {
    const msg: GmailMessage = {
      id: 'm1',
      threadId: 't1',
      snippet: 'snippet…',
      internalDate: String(Date.UTC(2026, 6, 1, 9, 12)),
      labelIds: ['INBOX', 'UNREAD', 'STARRED'],
      payload: {
        mimeType: 'text/plain',
        body: { data: b64url('the body') },
        headers: [
          { name: 'From', value: 'Priya Raman <priya@lattice.dev>' },
          { name: 'Subject', value: 'Roadmap' },
          { name: 'Message-ID', value: '<abc@mail.gmail.com>' },
        ],
      },
    };
    expect(parseMessage(msg)).toEqual({
      id: 'm1',
      threadId: 't1',
      rfcMessageId: '<abc@mail.gmail.com>',
      from: 'Priya Raman',
      fromEmail: 'priya@lattice.dev',
      subject: 'Roadmap',
      snippet: 'snippet…',
      body: 'the body',
      date: new Date(Date.UTC(2026, 6, 1, 9, 12)).toISOString(),
      unread: true,
      starred: true,
    });
  });

  it('defaults subject and flags', () => {
    const msg: GmailMessage = {
      id: 'm2',
      threadId: 't2',
      snippet: '',
      internalDate: '1751300000000',
      payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'a@b.com' }] },
    };
    const email = parseMessage(msg);
    expect(email.subject).toBe('(no subject)');
    expect(email.unread).toBe(false);
    expect(email.starred).toBe(false);
  });
});
