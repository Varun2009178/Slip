import { useEffect, useRef } from 'react';
import { sanitizeHtml } from '../lib/html';

interface Props {
  initialHtml?: string | null;
  initialText?: string;
  toolbar?: boolean;
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

export default function RichEditor({ initialHtml, initialText, toolbar = true, editorRef }: Props) {
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

  // Setting hiliteColor to transparent visually clears a highlight, but leaves
  // `background-color: transparent` spans behind — strip those so the HTML
  // (and therefore the sent email) is genuinely back to normal.
  function dropTransparentBackgrounds() {
    editorRef.current?.querySelectorAll<HTMLElement>('[style*="background"]').forEach((n) => {
      const bg = n.style.backgroundColor;
      if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'initial') {
        n.style.removeProperty('background-color');
        if (!n.style.length) n.removeAttribute('style');
      }
    });
  }

  function removeHighlight() {
    exec('hiliteColor', 'transparent');
    dropTransparentBackgrounds();
  }

  function clearFormatting() {
    exec('removeFormat');
    exec('formatBlock', 'div');
    // removeFormat doesn't reliably strip highlight spans — finish the job
    exec('hiliteColor', 'transparent');
    dropTransparentBackgrounds();
  }

  // Buttons use onMouseDown+preventDefault so the editor selection never collapses.
  const btn = (label: React.ReactNode, title: string, cmd: string, value?: string) => (
    <button title={title} onMouseDown={(e) => { e.preventDefault(); exec(cmd, value); }}>
      {label}
    </button>
  );

  return (
    <div className="editor-wrap">
      {/* Keys keep React from recycling the contentEditable div (whose content
          lives in the DOM, not state) when the toolbar mounts/unmounts. */}
      {toolbar && (
      <div className="toolbar" key="toolbar">
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
        <button
          title="Remove highlight"
          onMouseDown={(e) => {
            e.preventDefault();
            removeHighlight();
          }}
        >
          <span className="tb-nohl">A</span>
        </button>
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
            clearFormatting();
          }}
        >
          ⌫A
        </button>
      </div>
      )}
      <div
        key="body"
        ref={editorRef}
        className="rich-body"
        contentEditable
        data-placeholder="Write…"
        suppressContentEditableWarning
      />
    </div>
  );
}
