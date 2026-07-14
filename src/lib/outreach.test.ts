import { describe, expect, it } from 'vitest';
import {
  addColumn,
  addRow,
  applyPaste,
  hasReply,
  isValidEmail,
  MAX_GAP_MS,
  MIN_GAP_MS,
  newCampaign,
  nextSendDelayMs,
  parsePasted,
  recordFailed,
  recordReplied,
  recordSent,
  removeColumn,
  removeRow,
  renameColumn,
  renderedFor,
  renderTemplate,
  requeueRecipient,
  retryRecipient,
  setCell,
  startNextSend,
  templateVars,
  validateCampaign,
} from './outreach';
import type { Campaign } from './outreach';
import type { Email } from './types';

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

describe('newCampaign', () => {
  it('starts as an empty draft with name and email columns', () => {
    const c = newCampaign();
    expect(c.state).toBe('draft');
    expect(c.columns).toEqual(['name', 'email']);
    expect(c.recipients).toEqual([]);
    expect(c.id).not.toBe(newCampaign().id);
  });
});

describe('table editing', () => {
  it('setCell writes a field on one recipient', () => {
    let c = addRow(newCampaign());
    c = setCell(c, c.recipients[0].id, 'name', 'Ada');
    expect(c.recipients[0].fields.name).toBe('Ada');
  });
  it('addRow/removeRow', () => {
    let c = addRow(addRow(newCampaign()));
    expect(c.recipients).toHaveLength(2);
    c = removeRow(c, c.recipients[0].id);
    expect(c.recipients).toHaveLength(1);
  });
  it('addColumn ignores duplicates and empties', () => {
    let c = addColumn(newCampaign(), 'paper');
    expect(c.columns).toEqual(['name', 'email', 'paper']);
    expect(addColumn(c, 'paper').columns).toEqual(['name', 'email', 'paper']);
    expect(addColumn(c, '  ').columns).toEqual(['name', 'email', 'paper']);
  });
  it('renameColumn renames the column and every row key', () => {
    let c = addRow(newCampaign());
    c = setCell(c, c.recipients[0].id, 'name', 'Ada');
    c = renameColumn(c, 'name', 'first');
    expect(c.columns).toEqual(['first', 'email']);
    expect(c.recipients[0].fields).toEqual({ first: 'Ada' });
  });
  it('removeColumn refuses to remove email', () => {
    const c = newCampaign();
    expect(removeColumn(c, 'email').columns).toContain('email');
    expect(removeColumn(c, 'name').columns).toEqual(['email']);
  });
});

describe('applyPaste', () => {
  const text = 'name\temail\nAda\tada@cs.stanford.edu';
  it('replaces columns and rows when the table is empty', () => {
    const c = applyPaste(addRow(newCampaign()), text); // one blank row still counts as empty
    expect(c.columns).toEqual(['name', 'email']);
    expect(c.recipients).toHaveLength(1);
    expect(c.recipients[0].fields.email).toBe('ada@cs.stanford.edu');
  });
  it('appends rows and merges new columns when the table has data', () => {
    let c = applyPaste(newCampaign(), text);
    c = applyPaste(c, 'name\temail\tpaper\nGrace\tgrace@mit.edu\tCOBOL');
    expect(c.columns).toEqual(['name', 'email', 'paper']);
    expect(c.recipients).toHaveLength(2);
    expect(c.recipients[1].fields.paper).toBe('COBOL');
  });
});

describe('validateCampaign', () => {
  function filled(): ReturnType<typeof newCampaign> {
    let c = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu');
    return { ...c, subjectTemplate: 'hi {{name}}', bodyTemplate: 'about {{name}}' };
  }
  it('passes a complete campaign', () => {
    expect(validateCampaign(filled())).toEqual([]);
  });
  it('flags no recipients', () => {
    const c = { ...filled(), recipients: [] };
    expect(validateCampaign(c).map((i) => i.kind)).toContain('no-recipients');
  });
  it('flags a missing email column', () => {
    const c = filled();
    const noEmail = {
      ...c,
      columns: ['name'],
      recipients: c.recipients.map((r) => ({ ...r, fields: { name: 'Ada' } })),
    };
    expect(validateCampaign(noEmail).map((i) => i.kind)).toContain('no-email-column');
  });
  it('flags invalid emails with the recipient id', () => {
    let c = filled();
    c = setCell(c, c.recipients[0].id, 'email', 'nope');
    const issue = validateCampaign(c).find((i) => i.kind === 'bad-email');
    expect(issue?.recipientId).toBe(c.recipients[0].id);
  });
  it('flags template variables that match no column', () => {
    const c = { ...filled(), bodyTemplate: 'hi {{nmae}}' };
    const issue = validateCampaign(c).find((i) => i.kind === 'unknown-var');
    expect(issue?.variable).toBe('nmae');
  });
  it('flags empty values for used variables, unless the recipient has an override', () => {
    let c = filled();
    c = setCell(c, c.recipients[0].id, 'name', '');
    expect(validateCampaign(c).map((i) => i.kind)).toContain('empty-value');
    const overridden = {
      ...c,
      recipients: c.recipients.map((r) => ({ ...r, override: { subject: 's', body: 'b' } })),
    };
    expect(validateCampaign(overridden).map((i) => i.kind)).not.toContain('empty-value');
  });
});

function sendable(): Campaign {
  let c = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu\nGrace\tgrace@mit.edu');
  return { ...c, subjectTemplate: 'hi {{name}}', bodyTemplate: 'dear {{name}}', state: 'sending' as const };
}

describe('renderedFor', () => {
  it('renders the templates with the recipient fields', () => {
    const c = sendable();
    expect(renderedFor(c, c.recipients[0])).toEqual({ subject: 'hi Ada', body: 'dear Ada' });
  });
  it('prefers a per-recipient override', () => {
    const c = sendable();
    const r = { ...c.recipients[0], override: { subject: 's', body: 'b' } };
    expect(renderedFor(c, r)).toEqual({ subject: 's', body: 'b' });
  });
});

describe('send-state transitions', () => {
  it('startNextSend picks the first queued recipient and marks it sending', () => {
    const next = startNextSend(sendable());
    expect(next?.recipient.fields.name).toBe('Ada');
    expect(next?.campaign.recipients[0].status).toBe('sending');
  });
  it('startNextSend returns null when paused or exhausted', () => {
    expect(startNextSend({ ...sendable(), state: 'paused' })).toBeNull();
    const done = {
      ...sendable(),
      recipients: sendable().recipients.map((r) => ({ ...r, status: 'sent' as const })),
    };
    expect(startNextSend(done)).toBeNull();
  });
  it('recordSent stores ids and date; campaign becomes done after the last one', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordSent(first.campaign, first.recipient.id, { id: 'm1', threadId: 't1' });
    expect(c.recipients[0]).toMatchObject({ status: 'sent', messageId: 'm1', threadId: 't1' });
    expect(c.state).toBe('sending'); // one still queued
    const second = startNextSend(c)!;
    c = recordSent(second.campaign, second.recipient.id, { id: 'm2', threadId: 't2' });
    expect(c.state).toBe('done');
  });
  it('recordFailed keeps going and retryRecipient requeues', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordFailed(first.campaign, first.recipient.id, 'gmail-500');
    expect(c.recipients[0]).toMatchObject({ status: 'failed', error: 'gmail-500' });
    c = retryRecipient(c, c.recipients[0].id);
    expect(c.recipients[0].status).toBe('queued');
    expect(c.recipients[0].error).toBeUndefined();
  });
  it('requeueRecipient puts a sending recipient back to queued (auth-expiry path)', () => {
    const first = startNextSend(sendable())!;
    const c = requeueRecipient(first.campaign, first.recipient.id);
    expect(c.recipients[0].status).toBe('queued');
  });
  it('recordReplied only flips sent recipients', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordSent(first.campaign, first.recipient.id, { id: 'm1', threadId: 't1' });
    c = recordReplied(c, c.recipients[0].id);
    expect(c.recipients[0].status).toBe('replied');
    expect(recordReplied(c, c.recipients[1].id).recipients[1].status).toBe('queued');
  });
});

describe('hasReply', () => {
  const msg = (fromEmail: string): Email => ({
    id: '1', threadId: 't', rfcMessageId: '', from: fromEmail, fromEmail,
    subject: '', snippet: '', body: '', bodyHtml: null,
    date: new Date().toISOString(), unread: false, starred: false,
  });
  it('is false when every message is from the sender', () => {
    expect(hasReply([msg('me@gmail.com')], 'me@gmail.com')).toBe(false);
  });
  it('is true when someone else appears in the thread, case-insensitively', () => {
    expect(hasReply([msg('me@gmail.com'), msg('Ada@CS.Stanford.EDU')], 'me@gmail.com')).toBe(true);
  });
});

describe('nextSendDelayMs', () => {
  it('stays within 45–120 s', () => {
    expect(nextSendDelayMs(() => 0)).toBe(MIN_GAP_MS);
    expect(nextSendDelayMs(() => 0.999999)).toBeLessThan(MAX_GAP_MS);
    expect(nextSendDelayMs(() => 0.5)).toBe(MIN_GAP_MS + (MAX_GAP_MS - MIN_GAP_MS) / 2);
  });
});
