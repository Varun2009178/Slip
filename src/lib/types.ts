export interface Email {
  id: string;
  threadId: string;
  rfcMessageId: string; // Message-ID header, for reply threading
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  body: string;
  bodyHtml: string | null;
  date: string; // ISO 8601
  unread: boolean;
  starred: boolean;
}
