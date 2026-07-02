import { useEffect, useRef, useState } from 'react';
import type { Email } from '../lib/types';
import type { Attachment, OutgoingMail } from '../lib/gmail';

interface Props {
  replyTo?: Email;
  onClose: () => void;
  onSend: (mail: OutgoingMail) => Promise<void>;
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

export default function Composer({ replyTo, onClose, onSend }: Props) {
  const [to, setTo] = useState(replyTo?.fromEmail ?? '');
  const [subject, setSubject] = useState(
    replyTo ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : '',
  );
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attached[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const current = attachments.reduce((sum, a) => sum + a.size, 0);
    let total = current;
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
    if (sending) return;
    if (!to.trim()) {
      setError('Add a recipient');
      return;
    }
    if (!body.trim() && attachments.length === 0) {
      setError('Write something first');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSend({
        to: to.trim(),
        subject,
        body,
        threadId: replyTo?.threadId,
        inReplyTo: replyTo?.rfcMessageId || undefined,
        attachments: attachments.length ? attachments : undefined,
      });
    } catch {
      setError("Couldn't send — try again");
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void trySend();
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
        <button className="send" onClick={trySend} disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
          <kbd>⌘↵</kbd>
        </button>
      </header>

      <input className="field" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input
        className="field subject"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        ref={bodyRef}
        className="body-input"
        placeholder="Write…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <footer className="attach-bar">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void addFiles(e.target.files)}
        />
        <button onClick={() => fileRef.current?.click()} disabled={sending}>
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
        {error && <span className="ai-error">{error}</span>}
      </footer>
    </div>
  );
}
