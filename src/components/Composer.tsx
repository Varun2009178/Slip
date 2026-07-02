import { useRef, useState } from 'react';
import type { Email } from '../lib/types';
import type { Attachment, Draft, OutgoingMail } from '../lib/gmail';
import { sanitizeHtml } from '../lib/html';
import RichEditor from './RichEditor';

interface Props {
  replyTo?: Email;
  draft?: Draft;
  onClose: () => void;
  onSend: (mail: OutgoingMail, draftId?: string) => Promise<void>;
  onSaveDraft: (mail: OutgoingMail, draftId?: string) => Promise<void>;
}

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // Gmail simple-send limit is 5MB; leave headroom

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Attached extends Attachment {
  size: number;
}

export default function Composer({ replyTo, draft, onClose, onSend, onSaveDraft }: Props) {
  const [to, setTo] = useState(draft?.to ?? replyTo?.fromEmail ?? '');
  const [subject, setSubject] = useState(
    draft?.subject ??
      (replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''),
  );
  const [attachments, setAttachments] = useState<Attached[]>([]);
  const [busy, setBusy] = useState<'send' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function currentMail(): OutgoingMail {
    const el = editorRef.current;
    const text = el?.innerText.trim() ?? '';
    const html = el ? sanitizeHtml(el.innerHTML) : '';
    return {
      to: to.trim(),
      subject,
      body: text,
      bodyHtml: html || undefined,
      threadId: draft?.threadId ?? replyTo?.threadId,
      inReplyTo: replyTo?.rfcMessageId || undefined,
      attachments: attachments.length ? attachments : undefined,
    };
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    let total = attachments.reduce((sum, a) => sum + a.size, 0);
    const added: Attached[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (total + file.size > MAX_TOTAL_BYTES) {
        setError('Images too large — keep the total under 4 MB');
        break;
      }
      total += file.size;
      added.push({
        filename: file.name,
        mimeType: file.type,
        dataBase64: await readAsBase64(file),
        size: file.size,
      });
    }
    if (added.length) setAttachments((a) => [...a, ...added]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function trySend() {
    if (busy) return;
    const mail = currentMail();
    if (!mail.to) {
      setError('Add a recipient');
      return;
    }
    if (!mail.body && attachments.length === 0) {
      setError('Write something first');
      return;
    }
    setBusy('send');
    setError(null);
    try {
      await onSend(mail, draft?.draftId);
    } catch {
      setError("Couldn't send — try again");
      setBusy(null);
    }
  }

  async function trySave() {
    if (busy) return;
    const mail = currentMail();
    if (!mail.to && !mail.subject.trim() && !mail.body && attachments.length === 0) {
      setError('Nothing to save');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      await onSaveDraft(mail, draft?.draftId);
    } catch {
      setError("Couldn't save — try again");
      setBusy(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void trySend();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void trySave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div className="composer" onKeyDown={handleKeyDown}>
      <header className="composer-nav">
        <button onClick={onClose}>
          ← Discard<kbd>Esc</kbd>
        </button>
        <div>
          <button onClick={trySave} disabled={!!busy}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
            <kbd>⌘S</kbd>
          </button>
          <button className="send" onClick={trySend} disabled={!!busy}>
            {busy === 'send' ? 'Sending…' : 'Send'}
            <kbd>⌘↵</kbd>
          </button>
        </div>
      </header>

      <input className="field" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input
        className="field subject"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <RichEditor editorRef={editorRef} initialHtml={draft?.bodyHtml} initialText={draft?.body} />

      <footer className="attach-bar">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void addFiles(e.target.files)}
        />
        <button onClick={() => fileRef.current?.click()} disabled={!!busy}>
          + Add images
        </button>
        {attachments.map((a, i) => (
          <span key={`${a.filename}-${i}`} className="chip">
            {a.filename} <span className="chip-size">{formatSize(a.size)}</span>
            <button
              className="chip-x"
              title="Remove"
              onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        {draft && draft.attachmentNames.length > 0 && attachments.length === 0 && (
          <span className="chip chip-note" title="Images from the saved draft aren't carried over — re-add them">
            re-add: {draft.attachmentNames.join(', ')}
          </span>
        )}
        {error && <span className="ai-error">{error}</span>}
      </footer>
    </div>
  );
}
