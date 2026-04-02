import { readBlobFile } from './blob-storage';
import { readLocalWorkspaceAsset } from './local-storage';
import { blobPath, getTrainerDataSource } from './storage-config';

export async function readWorkspaceAsset(workspace: string, pathParts: string[]) {
  if (getTrainerDataSource() === 'blob') {
    return readBlobFile(blobPath('workspaces', workspace, ...pathParts));
  }

  return readLocalWorkspaceAsset(workspace, pathParts);
}
