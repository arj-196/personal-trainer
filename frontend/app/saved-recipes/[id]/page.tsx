import { SavedRecipesView } from '@/components/saved-recipes-view';
import { getRecipeSnapshot, listRecipeSnapshots } from '@/lib/recipes/blob-store';

export const dynamic = 'force-dynamic';

export default async function SavedRecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [items, snapshot] = await Promise.all([
    listRecipeSnapshots().catch(() => []),
    getRecipeSnapshot(id).catch(() => null),
  ]);

  return <SavedRecipesView initialItems={items} snapshot={snapshot} />;
}
