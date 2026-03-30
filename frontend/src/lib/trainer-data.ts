import { blobPath, getTrainerDataSource } from './storage-config';
import { listBlobFolders, readBlobText } from './blob-storage';
import { listLocalWorkspaces, readLocalExerciseCatalogText, readLocalWorkspaceText } from './local-storage';

export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes: string;
  imagePath: string | null;
  referencePath: string | null;
};

export type WorkoutDay = {
  heading: string;
  warmup: string;
  exercises: WorkoutExercise[];
  finisher: string;
  recovery: string;
};

export type WorkoutPlan = {
  title: string;
  meta: Array<{ label: string; value: string }>;
  summary: string;
  progression: string;
  days: WorkoutDay[];
  nextCheckIn: string;
};

export type ExerciseReference = {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  setup: string;
  cues: string[];
  visual_note: string;
  image_filename: string;
  source_title: string;
  source_url: string;
  author: string;
  credit: string;
  license: string;
  license_url: string;
};

export async function listWorkspaces(): Promise<string[]> {
  if (getTrainerDataSource() === 'blob') {
    const folders = await listBlobFolders(blobPath('workspaces') + '/');
    return folders
      .map((folder) => folder.replace(/\/$/, '').split('/').pop())
      .filter((workspace): workspace is string => Boolean(workspace))
      .sort();
  }

  return listLocalWorkspaces();
}

export async function readWorkoutPlan(workspace: string): Promise<WorkoutPlan | null> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('workspaces', workspace, 'plan.md'))
      : readLocalWorkspaceText(workspace, 'plan.md');

  if (!text) {
    return null;
  }

  const lines = text.split(/\r?\n/);
  const title = lines[0]?.replace(/^#\s+/, '').trim() || 'Training Plan';

  const meta: Array<{ label: string; value: string }> = [];
  const days: WorkoutDay[] = [];
  let summary = '';
  let progression = '';
  let nextCheckIn = '';

  let index = skipBlankLines(lines, 1);
  while (index < lines.length && lines[index].startsWith('- ')) {
    const [label, ...valueParts] = lines[index].slice(2).split(':');
    meta.push({ label: label.trim(), value: valueParts.join(':').trim() });
    index += 1;
  }

  while (index < lines.length) {
    const line = lines[index];

    if (line === '## Summary') {
      const block = readParagraph(lines, index + 1);
      summary = block.text;
      index = block.nextIndex;
      continue;
    }

    if (line === '## Progression') {
      const block = readParagraph(lines, index + 1);
      progression = block.text;
      index = block.nextIndex;
      continue;
    }

    if (line === '## Next Check-In') {
      const block = readParagraph(lines, index + 1);
      nextCheckIn = block.text;
      index = block.nextIndex;
      continue;
    }

    if (line.startsWith('## Day ')) {
      const parsed = readDay(lines, index + 1, line.replace(/^##\s+/, '').trim());
      days.push(parsed.day);
      index = parsed.nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    title,
    meta,
    summary,
    progression,
    days,
    nextCheckIn,
  };
}

function readParagraph(lines: string[], startIndex: number) {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const value = lines[index].trim();
    if (!value) {
      index += 1;
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if (value.startsWith('## ')) {
      break;
    }
    collected.push(value);
    index += 1;
  }

  return { text: collected.join(' '), nextIndex: index };
}

function readDay(lines: string[], startIndex: number, heading: string) {
  let warmup = '';
  let finisher = '';
  let recovery = '';
  const exercises: WorkoutExercise[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const raw = lines[index];
    const trimmed = raw.trim();

    if (trimmed.startsWith('## ')) {
      break;
    }

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('- Warm-up:')) {
      warmup = trimmed.replace('- Warm-up:', '').trim();
      index += 1;
      continue;
    }

    if (trimmed === '- Main work:') {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('- Finisher:')) {
      finisher = trimmed.replace('- Finisher:', '').trim();
      index += 1;
      continue;
    }

    if (trimmed.startsWith('- Recovery:')) {
      recovery = trimmed.replace('- Recovery:', '').trim();
      index += 1;
      continue;
    }

    const exerciseMatch = trimmed.match(/^- \*\*(.+?)\*\*: (.+?)\. (.+)$/);
    if (exerciseMatch) {
      const [, name, prescription, notes] = exerciseMatch;
      let imagePath: string | null = null;
      let referencePath: string | null = null;

      if (lines[index + 1]?.trim().startsWith('![')) {
        imagePath = extractMarkdownPath(lines[index + 1].trim());
        index += 1;
      }

      if (lines[index + 1]?.trim().startsWith('Reference:')) {
        referencePath = extractMarkdownPath(lines[index + 1].trim());
        index += 1;
      }

      exercises.push({ name, prescription, notes, imagePath, referencePath });
    }

    index += 1;
  }

  return {
    day: { heading, warmup, exercises, finisher, recovery },
    nextIndex: index,
  };
}

function extractMarkdownPath(value: string): string | null {
  const match = value.match(/\((.+?)\)/);
  return match ? match[1] : null;
}

function skipBlankLines(lines: string[], startIndex: number) {
  let index = startIndex;
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }
  return index;
}

export async function readExerciseLibrary(): Promise<ExerciseReference[]> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('exercise-library', 'catalog.json'))
      : readLocalExerciseCatalogText();

  return text ? (JSON.parse(text) as ExerciseReference[]) : [];
}

export function workspaceImageUrl(workspace: string, relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  const encodedParts = relativePath.split('/').map(encodeURIComponent).join('/');
  return `/api/workspace-images/${encodeURIComponent(workspace)}/${encodedParts}`;
}

export function libraryImageUrl(imageFilename: string): string {
  return `/api/library-images/${encodeURIComponent(imageFilename)}`;
}
