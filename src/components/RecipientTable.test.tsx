// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RecipientTable from './RecipientTable';
import { applyPaste, newCampaign, type Campaign } from '../lib/outreach';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

// The component is controlled; hold the campaign in state like App will.
function Harness({ initial }: { initial: Campaign }) {
  const [campaign, setCampaign] = useState(initial);
  return <RecipientTable campaign={campaign} onChange={setCampaign} onNext={() => undefined} />;
}

async function mount(initial: Campaign) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<Harness initial={initial} />);
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const headerValues = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLInputElement>('.sheet-head')].map((i) => i.value);
const cellInputs = (c: HTMLElement) => [...c.querySelectorAll<HTMLInputElement>('.sheet-cell')];

// Controlled inputs need the native value setter so React sees the change.
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pasteInto(target: Element, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.assign(event, { clipboardData: { getData: () => text } });
  target.dispatchEvent(event);
}

describe('RecipientTable', () => {
  it('pasting TSV with headers populates columns and rows', async () => {
    const { container, cleanup } = await mount(newCampaign());
    await act(async () => {
      pasteInto(
        container.querySelector('.people')!,
        'name\temail\tpaper\nAda\tada@cs.stanford.edu\tOn Computable Numbers',
      );
    });
    expect(headerValues(container)).toEqual(['name', 'email', 'paper']);
    expect(cellInputs(container).map((i) => i.value)).toEqual([
      'Ada',
      'ada@cs.stanford.edu',
      'On Computable Numbers',
    ]);
    await cleanup();
  });

  it('renaming a header commits on blur and migrates row values', async () => {
    const initial = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu');
    const { container, cleanup } = await mount(initial);
    const head = container.querySelector<HTMLInputElement>('.sheet-head')!;
    await act(async () => {
      head.focus();
    });
    await act(async () => {
      typeInto(head, ''); // select-all + backspace
    });
    await act(async () => {
      typeInto(head, 'first');
    });
    await act(async () => {
      head.blur();
    });
    expect(headerValues(container)).toEqual(['first', 'email']);
    // Row keys migrated: the cell under the renamed column keeps its value.
    const [first] = cellInputs(container);
    expect(first.placeholder).toBe('first');
    expect(first.value).toBe('Ada');
    await cleanup();
  });

  it('clearing a header and blurring leaves the original column intact', async () => {
    const initial = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu');
    const { container, cleanup } = await mount(initial);
    const head = container.querySelector<HTMLInputElement>('.sheet-head')!;
    await act(async () => {
      head.focus();
    });
    await act(async () => {
      typeInto(head, ''); // select-all + backspace, then blur without typing
    });
    expect(head.value).toBe(''); // no snap-back mid-edit
    await act(async () => {
      head.blur();
    });
    expect(headerValues(container)).toEqual(['name', 'email']);
    expect(cellInputs(container)[0].value).toBe('Ada');
    await cleanup();
  });
});
