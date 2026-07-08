// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from 'vitest';
import { act } from 'react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RichEditor from './RichEditor';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks execCommand; RichEditor calls it on mount
  document.execCommand = () => true;
});

describe('RichEditor toolbar toggle', () => {
  it('keeps typed content in the DOM when the toolbar mounts and unmounts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editorRef = createRef<HTMLDivElement>();
    let root: Root;

    await act(async () => {
      root = createRoot(container);
      root.render(<RichEditor editorRef={editorRef} toolbar={false} />);
    });

    // Simulate the user typing: contentEditable text lives in the DOM, not React state
    editorRef.current!.innerHTML = '<p>hello draft</p>';
    const bodyNode = editorRef.current;

    await act(async () => {
      root.render(<RichEditor editorRef={editorRef} toolbar={true} />);
    });
    expect(container.querySelector('.toolbar')).not.toBeNull();
    expect(container.querySelector('.rich-body')).toBe(bodyNode);
    expect(container.querySelector('.rich-body')!.innerHTML).toBe('<p>hello draft</p>');

    await act(async () => {
      root.render(<RichEditor editorRef={editorRef} toolbar={false} />);
    });
    expect(container.querySelector('.toolbar')).toBeNull();
    expect(container.querySelector('.rich-body')!.innerHTML).toBe('<p>hello draft</p>');

    await act(async () => {
      root!.unmount();
    });
    container.remove();
  });
});
