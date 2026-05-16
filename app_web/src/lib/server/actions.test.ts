import { describe, expect, it, vi } from 'vitest';

const { redirectMock, revalidatePathMock, upsertCheckInMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  upsertCheckInMock: vi.fn(async () => undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/server/workspaces', () => ({
  createWorkspace: vi.fn(),
  parseLines: (value: FormDataEntryValue | null) => String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
  saveAthleteProfile: vi.fn(),
  upsertCheckIn: upsertCheckInMock,
}));

import { saveCheckInAction } from '../../../app/actions';

describe('saveCheckInAction', () => {
  it('generates a UUID when a new check-in submits a blank id', async () => {
    const formData = new FormData();
    formData.set('workspace', 'wk_test');
    formData.set('id', '');
    formData.set('checkInDate', '2026-05-16');

    await expect(saveCheckInAction(formData)).rejects.toThrow('redirect:/workspace/wk_test');

    expect(upsertCheckInMock).toHaveBeenCalledTimes(1);
    const [workspace, checkIn] = upsertCheckInMock.mock.calls[0];
    expect(workspace).toBe('wk_test');
    expect(checkIn.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(checkIn.checkInDate).toBe('2026-05-16');
    expect(revalidatePathMock).toHaveBeenCalledWith('/workspace/wk_test');
  });

  it('keeps an existing check-in id for edits', async () => {
    const existingId = '11111111-1111-4111-8111-111111111111';
    const formData = new FormData();
    formData.set('workspace', 'wk_test');
    formData.set('id', existingId);
    formData.set('checkInDate', '2026-05-16');

    await expect(saveCheckInAction(formData)).rejects.toThrow('redirect:/workspace/wk_test');

    const [, checkIn] = upsertCheckInMock.mock.calls[0];
    expect(checkIn.id).toBe(existingId);
  });
});
