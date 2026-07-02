import type { Email } from './types';

// ── Wire types ─────────────────────────────────────────────

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string; // epoch millis as string
  labelIds?: string[];
  payload: GmailPart;
}

// ── Pure parsing helpers ───────────────────────────────────

export function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export function parseSender(from: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const email = m[2].trim();
    return { name: m[1].trim() || email, email };
  }
  const bare = from.trim();
  return { name: bare, email: bare };
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function stripHtml(html: string): string {
  const withoutBlocks = html.replace(/<(style|script)[\s\S]*?<\/\1\s*>/gi, ' ');
  const withBreaks = withoutBlocks
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|blockquote)[^>]*>/gi, '\n');
  const text = withBreaks.replace(/<[^>]+>/g, ' ');
  const el = document.createElement('textarea');
  el.innerHTML = text; // decodes entities; textarea never executes content
  return el.value
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

export function extractBody(payload: GmailPart): string {
  return extractBodies(payload).text;
}

export function extractBodies(payload: GmailPart): { text: string; html: string | null } {
  const plainPart = findPart(payload, 'text/plain');
  const htmlPart = findPart(payload, 'text/html');
  const html = htmlPart?.body?.data ? decodeBase64Url(htmlPart.body.data) : null;
  const text = plainPart?.body?.data
    ? decodeBase64Url(plainPart.body.data).trim()
    : html
      ? stripHtml(html)
      : '';
  return { text, html };
}

export function parseMessage(msg: GmailMessage): Email {
  const headers = msg.payload.headers;
  const sender = parseSender(header(headers, 'From'));
  const bodies = extractBodies(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId,
    rfcMessageId: header(headers, 'Message-ID'),
    from: sender.name,
    fromEmail: sender.email,
    subject: header(headers, 'Subject') || '(no subject)',
    snippet: msg.snippet,
    body: bodies.text,
    bodyHtml: bodies.html,
    date: new Date(Number(msg.internalDate)).toISOString(),
    unread: msg.labelIds?.includes('UNREAD') ?? false,
    starred: msg.labelIds?.includes('STARRED') ?? false,
  };
}

// ── Pure outbound MIME helpers ─────────────────────────────

function utf8ToBase64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${utf8ToBase64(value)}?=`;
}

export interface Attachment {
  filename: string;
  mimeType: string;
  dataBase64: string;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string; // original Message-ID header value
  attachments?: Attachment[];
}

function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

export function buildMime(mail: OutgoingMail): string {
  const common = [`To: ${mail.to}`, `Subject: ${encodeHeader(mail.subject)}`, 'MIME-Version: 1.0'];
  if (mail.inReplyTo) {
    common.push(`In-Reply-To: ${mail.inReplyTo}`, `References: ${mail.inReplyTo}`);
  }

  const textPart = [
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(mail.body),
  ].join('\r\n');

  if (!mail.attachments?.length) {
    return common.join('\r\n') + '\r\n' + textPart;
  }

  const boundary = 'tinymail_' + Math.random().toString(36).slice(2);
  const parts = [
    textPart,
    ...mail.attachments.map((a) =>
      [
        `Content-Type: ${a.mimeType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        wrap76(a.dataBase64),
      ].join('\r\n'),
    ),
  ];
  return (
    common.join('\r\n') +
    `\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
    parts.map((p) => `--${boundary}\r\n${p}`).join('\r\n') +
    `\r\n--${boundary}--`
  );
}

export function toBase64Url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Auth (Google Identity Services) ────────────────────────

const CLIENT_ID_KEY = 'tiny-mail-client-id';
const SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send';

let accessToken: string | null = null;

export function getClientId(): string | null {
  try {
    return localStorage.getItem(CLIENT_ID_KEY);
  } catch {
    return null;
  }
}

export function setClientId(id: string): void {
  try {
    localStorage.setItem(CLIENT_ID_KEY, id);
  } catch {
    // ignore — id just won't persist
  }
}

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: () => void;
}

interface GoogleGlobal {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
        error_callback?: (err: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

async function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gis-load-failed'));
    document.head.appendChild(s);
  });
}

export async function connect(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error('missing-client-id');
  await loadGis();
  accessToken = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) =>
        resp.access_token ? resolve(resp.access_token) : reject(new Error(resp.error ?? 'auth-failed')),
      error_callback: (err) => reject(new Error(err.message ?? err.type ?? 'auth-failed')),
    });
    client.requestAccessToken();
  });
}

export function isConnected(): boolean {
  return accessToken !== null;
}

// ── API calls ──────────────────────────────────────────────

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!accessToken) throw new Error('not-connected');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    accessToken = null;
    throw new Error('not-connected');
  }
  if (!res.ok) throw new Error(`gmail-${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchInbox(): Promise<Email[]> {
  const list = await api<{ messages?: { id: string }[] }>('/messages?labelIds=INBOX&maxResults=25');
  const refs = list.messages ?? [];
  const messages = await Promise.all(
    refs.map((m) => api<GmailMessage>(`/messages/${m.id}?format=full`)),
  );
  return messages.map(parseMessage);
}

export async function fetchThread(threadId: string): Promise<Email[]> {
  const thread = await api<{ messages: GmailMessage[] }>(`/threads/${threadId}?format=full`);
  return thread.messages.map(parseMessage);
}

export async function markRead(id: string): Promise<void> {
  await api(`/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

export async function archive(id: string): Promise<void> {
  await api(`/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['INBOX', 'UNREAD'] }),
  });
}

export async function unarchive(id: string): Promise<void> {
  await api(`/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: ['INBOX'] }),
  });
}

export async function fetchMessage(id: string): Promise<Email> {
  return parseMessage(await api<GmailMessage>(`/messages/${id}?format=full`));
}

export async function sendEmail(mail: OutgoingMail): Promise<void> {
  await api('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: toBase64Url(buildMime(mail)), threadId: mail.threadId }),
  });
}
