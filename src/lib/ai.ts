import Anthropic from '@anthropic-ai/sdk';

export type RewriteMode = 'shorter' | 'formal' | 'blunt';

const INSTRUCTIONS: Record<RewriteMode, string> = {
  shorter: 'Rewrite the email to be significantly shorter while keeping every essential point.',
  formal: 'Rewrite the email in a more formal, professional register.',
  blunt: 'Rewrite the email to be blunt and direct. Cut hedging, softeners, and filler.',
};

export function systemPromptFor(mode: RewriteMode): string {
  return `You rewrite email drafts. ${INSTRUCTIONS[mode]} Keep the sender's intent and any names, dates, and facts intact. Respond with only the rewritten email body — no preamble, no quotes, no commentary.`;
}

interface TextishBlock {
  type: string;
  text?: string;
}

export function extractText(content: TextishBlock[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

const KEY_STORAGE = 'tiny-mail-api-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // ignore — key just won't persist
  }
}

export async function rewrite(text: string, mode: RewriteMode): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('missing-api-key');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: systemPromptFor(mode),
    messages: [{ role: 'user', content: text }],
  });

  const result = extractText(message.content);
  if (!result) throw new Error('empty-response');
  return result;
}
