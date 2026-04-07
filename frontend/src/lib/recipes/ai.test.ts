import { describe, expect, it, vi } from 'vitest';

import { createRecipeState } from './state';
import { interpretUtterance } from './ai';

const chatJsonMock = vi.fn();

vi.mock('@/lib/recipes/openai', () => ({
  chatJson: (...args: unknown[]) => chatJsonMock(...args),
}));

describe('interpretUtterance', () => {
  it('maps nullable schema fields back to an empty patch', async () => {
    chatJsonMock.mockResolvedValueOnce({
      intent: 'no_change',
      explanation: 'No state updates are needed.',
      statePatch: {
        ingredients: null,
        notesRaw: null,
        mode: null,
      },
    });

    const draft = createRecipeState({
      ingredients: ['chicken'],
      notesRaw: 'keep it simple',
      mode: 'hybrid',
    });
    const result = await interpretUtterance('sounds good', draft);

    expect(result.statePatch).toEqual({});
    expect(result.updatedDraft).toEqual(draft);
  });
});
