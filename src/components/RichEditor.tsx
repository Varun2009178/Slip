import { useEffect, useRef } from 'react';
import { sanitizeHtml } from '../lib/html';

interface Props {
  initialHtml?: string | null;
  initialText?: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const FONTS: [string, string][] = [
  ['Font', ''],
  ['Sans', 'Helvetica, Arial, sans-serif'],
  ['Serif', 'Georgia, serif'],
  ['Mono', 'Menlo, Consolas, monospace'],
];

const SIZES: [string, string][] = [
  ['Size', ''],
  ['Small', '2'],
  ['Normal', '3'],
  ['Large', '5'],
  ['Huge', '7'],
];

export default function RichEditor({ initialHtml, initialText, editorRef }: Props) {
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    document.execCommand('styleWithCSS', false, 'true');
    if (initialHtml) el.innerHTML = sanitizeHtml(initialHtml);
    else if (initialText) el.innerText = initialText;
    el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel?.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  }

  function execSaved(cmd: string, value?: string) {
    editorRef.current?.focus();
    const range = savedRange.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    document.execCommand(cmd, false, value);
  }

  // Buttons use onMouseDown+preventDefault so the editor selection never collapses.
  const btn = (label: React.ReactNode, title: string, cmd: string, value?: string) => (
    <button title={title} onMouseDown={(e) => { e.preventDefault(); exec(cmd, value); }}>
      {label}
    </button>
  );

  return (
    <div className="editor-wrap">
      <div className="toolbar">
        {btn(<b>B</b>, 'Bold (⌘B)', 'bold')}
        {btn(<i>I</i>, 'Italic (⌘I)', 'italic')}
        {btn(<u>U</u>, 'Underline (⌘U)', 'underline')}
        {btn(<s>S</s>, 'Strikethrough', 'strikeThrough')}
        <span className="tb-sep" />
        {btn('H', 'Heading', 'formatBlock', 'h2')}
        {btn('❝', 'Quote', 'formatBlock', 'blockquote')}
        {btn('•', 'Bulleted list', 'insertUnorderedList')}
        {btn('1.', 'Numbered list', 'insertOrderedList')}
        <button
          title="Link"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
            const url = window.prompt('Link URL');
            if (url) execSaved('createLink', url);
          }}
        >
          ⛓
        </button>
        <span className="tb-sep" />
        <label className="tb-color" title="Text color" onMouseDown={saveSelection}>
          <span className="tb-a">A</span>
          <input type="color" defaultValue="#1c1c1a" onInput={(e) => execSaved('foreColor', e.currentTarget.value)} />
        </label>
        <label className="tb-color" title="Highlight color" onMouseDown={saveSelection}>
          <span className="tb-hl">A</span>
          <input type="color" defaultValue="#fff3a3" onInput={(e) => execSaved('hiliteColor', e.currentTarget.value)} />
        </label>
        <select
          title="Font"
          value=""
          onMouseDown={saveSelection}
          onChange={(e) => e.target.value && execSaved('fontName', e.target.value)}
        >
          {FONTS.map(([label, value]) => (
            <option key={label} value={value} hidden={!value}>
              {label}
            </option>
          ))}
        </select>
        <select
          title="Text size"
          value=""
          onMouseDown={saveSelection}
          onChange={(e) => e.target.value && execSaved('fontSize', e.target.value)}
        >
          {SIZES.map(([label, value]) => (
            <option key={label} value={value} hidden={!value}>
              {label}
            </option>
          ))}
        </select>
        <span className="tb-sep" />
        <button
          title="Clear formatting"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('removeFormat');
            exec('formatBlock', 'div');
          }}
        >
          ⌫A
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-body"
        contentEditable
        data-placeholder="Write…"
        suppressContentEditableWarning
      />
    </div>
  );
}
