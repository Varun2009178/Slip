import { beforeEach, describe, expect, it } from 'vitest';
import { newCampaign } from './outreach';
import { loadCampaigns, saveCampaigns, upsertCampaign } from './campaignStore';

beforeEach(() => localStorage.clear());

describe('campaignStore', () => {
  it('round-trips campaigns', () => {
    const c = newCampaign();
    expect(saveCampaigns([c])).toBe(true);
    expect(loadCampaigns()).toEqual([c]);
  });
  it('returns [] for missing or corrupt data', () => {
    expect(loadCampaigns()).toEqual([]);
    localStorage.setItem('slip-campaigns', '{nonsense');
    expect(loadCampaigns()).toEqual([]);
    localStorage.setItem('slip-campaigns', '"a string"');
    expect(loadCampaigns()).toEqual([]);
  });
  it('upsertCampaign prepends new and replaces existing in place', () => {
    const a = newCampaign();
    const b = newCampaign();
    let list = upsertCampaign([a], b);
    expect(list.map((c) => c.id)).toEqual([b.id, a.id]);
    list = upsertCampaign(list, { ...a, name: 'renamed' });
    expect(list[1].name).toBe('renamed');
    expect(list).toHaveLength(2);
  });
  it('drops malformed entries without losing the good ones', () => {
    const good = newCampaign();
    localStorage.setItem('slip-campaigns', JSON.stringify([good, { id: 'x' }]));
    expect(loadCampaigns()).toEqual([good]);
  });
  it('re-persists a mid-send campaign as paused (write-through)', () => {
    const c = {
      ...newCampaign(),
      state: 'sending' as const,
      recipients: [{ id: 'r1', fields: { email: 'a@b.co' }, status: 'sending' as const }],
    };
    saveCampaigns([c]);
    loadCampaigns();
    const stored = JSON.parse(localStorage.getItem('slip-campaigns') ?? '[]');
    expect(stored[0].state).toBe('paused');
    expect(stored[0].recipients[0].status).toBe('failed');
  });
  it('normalizes a campaign that died mid-send: paused, in-flight row marked failed', () => {
    const c = {
      ...newCampaign(),
      state: 'sending' as const,
      recipients: [
        { id: 'r1', fields: { email: 'a@b.co' }, status: 'sending' as const },
        { id: 'r2', fields: { email: 'c@d.co' }, status: 'queued' as const },
      ],
    };
    saveCampaigns([c]);
    const [loaded] = loadCampaigns();
    expect(loaded.state).toBe('paused');
    expect(loaded.recipients[0].status).toBe('failed');
    expect(loaded.recipients[0].error).toMatch(/check .*sent/i);
    expect(loaded.recipients[1].status).toBe('queued');
  });
});
