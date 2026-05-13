import { readLocalWorkspaceAsset } from './local-storage';

export async function readWorkspaceAsset(workspace: string, pathParts: string[]) {
  return readLocalWorkspaceAsset(workspace, pathParts);
}
