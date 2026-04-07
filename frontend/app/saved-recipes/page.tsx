import { SavedRecipesView } from '@/components/saved-recipes-view';
import { listRecipeSnapshots } from '@/lib/recipes/blob-store';

export const dynamic = 'force-dynamic';

export default async function SavedRecipesPage() {
  const items = await listRecipeSnapshots().catch(() => []);
  return <SavedRecipesView initialItems={items} snapshot={null} />;
}
