'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { clearSessionCookie, setSessionCookie, validateLogin } from '@/lib/server/auth';
import {
  createWorkspace,
  parseLines,
  saveAthleteProfile,
  upsertCheckIn,
  type AthleteProfileRecord,
  type CheckInRecord,
} from '@/lib/server/workspaces';

function slugifyWorkspaceName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!normalized) {
    throw new Error('Workspace name is required.');
  }
  return normalized;
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/');
  const valid = await validateLogin(username, password);
  if (!valid) {
    redirect(`/login?error=${encodeURIComponent('Invalid username or password.')}`);
  }
  await setSessionCookie();
  redirect(next.startsWith('/') ? next : '/');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const slug = slugifyWorkspaceName(String(formData.get('workspace') ?? ''));
  await createWorkspace(slug);
  revalidatePath('/');
  redirect(`/workspace/${encodeURIComponent(slug)}`);
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const workspace = String(formData.get('workspace') ?? '');
  const profile: AthleteProfileRecord = {
    workspaceSlug: workspace,
    name: String(formData.get('name') ?? ''),
    age: parseNumber(formData.get('age')),
    sex: String(formData.get('sex') ?? ''),
    heightCm: parseNumber(formData.get('heightCm')),
    weightKg: parseNumber(formData.get('weightKg')),
    goal: String(formData.get('goal') ?? ''),
    experienceLevel: String(formData.get('experienceLevel') ?? 'beginner'),
    trainingDays: parseNumber(formData.get('trainingDays')) ?? 3,
    sessionLengthMinutes: parseNumber(formData.get('sessionLengthMinutes')) ?? 45,
    equipment: parseLines(formData.get('equipment')),
    limitations: parseLines(formData.get('limitations')),
    preferredFocus: parseLines(formData.get('preferredFocus')),
    cardioPreference: String(formData.get('cardioPreference') ?? 'walk'),
    notes: parseLines(formData.get('notes')),
  };
  await saveAthleteProfile(workspace, profile);
  revalidatePath(`/workspace/${workspace}`);
  revalidatePath('/');
  redirect(`/workspace/${encodeURIComponent(workspace)}`);
}

export async function saveCheckInAction(formData: FormData): Promise<void> {
  const workspace = String(formData.get('workspace') ?? '');
  const checkIn: CheckInRecord = {
    id: String(formData.get('id') ?? randomUUID()),
    checkInDate: String(formData.get('checkInDate') ?? ''),
    workoutsCompleted: parseNumber(formData.get('workoutsCompleted')) ?? 0,
    workoutsPlanned: parseNumber(formData.get('workoutsPlanned')) ?? 0,
    averageDifficulty: parseNumber(formData.get('averageDifficulty')) ?? 5,
    energy: parseNumber(formData.get('energy')) ?? 5,
    soreness: parseNumber(formData.get('soreness')) ?? 3,
    bodyWeightKg: parseNumber(formData.get('bodyWeightKg')),
    wins: parseLines(formData.get('wins')),
    struggles: parseLines(formData.get('struggles')),
    notes: parseLines(formData.get('notes')),
  };
  await upsertCheckIn(workspace, checkIn);
  revalidatePath(`/workspace/${workspace}`);
  redirect(`/workspace/${encodeURIComponent(workspace)}`);
}
