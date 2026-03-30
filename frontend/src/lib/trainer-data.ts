import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

const REPO_ROOT = resolve(process.cwd(), '..');
const WORKSPACES_DIR = join(REPO_ROOT, 'workspaces');
const EXERCISE_CATALOG = join(
  REPO_ROOT,
  'trainer',
  'src',
  'personal_trainer',
  'assets',
  'exercise_library',
  'catalog.json'
);

export function listWorkspaces(): string[] {
  if (!existsSync(WORKSPACES_DIR)) {
    return [];
  }

  return readdirSync(WORKSPACES_DIR)
    .filter((entry) => {
      const fullPath = join(WORKSPACES_DIR, entry);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'profile.md'));
    })
    .sort();
}

export function readWorkoutPlan(workspace: string): WorkoutPlan | null {
  const planPath = join(WORKSPACES_DIR, workspace, 'plan.md');
  if (!existsSync(planPath)) {
    return null;
  }

  const lines = readFileSync(planPath, 'utf-8').split(/\r?\n/);
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

export function readExerciseLibrary(): ExerciseReference[] {
  return JSON.parse(readFileSync(EXERCISE_CATALOG, 'utf-8')) as ExerciseReference[];
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

export function getWorkspaceRoot(workspace: string): string {
  return join(WORKSPACES_DIR, workspace);
}
