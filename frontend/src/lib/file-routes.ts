import { readBlobFile } from './blob-storage';
import { readLocalLibraryImage, readLocalWorkspaceAsset } from './local-storage';
import { blobPath, getTrainerDataSource } from './storage-config';

export async function readWorkspaceAsset(workspace: string, pathParts: string[]) {
  if (getTrainerDataSource() === 'blob') {
    return readBlobFile(blobPath('workspaces', workspace, ...pathParts));
  }

  return readLocalWorkspaceAsset(workspace, pathParts);
}

export async function readLibraryImage(imageFilename: string) {
  if (getTrainerDataSource() === 'blob') {
    return readBlobFile(blobPath('exercise-library', 'images', imageFilename));
  }

  return readLocalLibraryImage(imageFilename);
}
