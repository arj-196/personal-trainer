'use client';

import { useEffect, useRef, useState } from 'react';

import { autosaveProfileAction } from '../../app/actions';
import type { AthleteProfileRecord } from '@/lib/server/workspaces';
import { Card, Display, ErrorBanner, FieldLabel, cx, inputClass, textareaClass } from '@/components/ui';

type ProfileFormState = {
  name: string;
  goal: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  experienceLevel: string;
  cardioPreference: string;
  trainingDays: string;
  sessionLengthMinutes: string;
  equipment: string;
  limitations: string;
  preferredFocus: string;
  notes: string;
};

type FieldDef = {
  field: keyof ProfileFormState;
  label: string;
  placeholder: string;
  span2?: boolean;
  type?: 'number';
};

const GRID_FIELDS: FieldDef[] = [
  { field: 'name', label: 'Name', placeholder: 'Athlete name' },
  { field: 'goal', label: 'Goal', placeholder: 'e.g. build muscle', span2: true },
  { field: 'age', label: 'Age', placeholder: '34', type: 'number' },
  { field: 'sex', label: 'Sex', placeholder: 'M / F' },
  { field: 'heightCm', label: 'Height (cm)', placeholder: '182', type: 'number' },
  { field: 'weightKg', label: 'Weight (kg)', placeholder: '82', type: 'number' },
  { field: 'experienceLevel', label: 'Experience', placeholder: 'Beginner / Intermediate…' },
  { field: 'cardioPreference', label: 'Cardio preference', placeholder: 'Low / moderate…' },
  { field: 'trainingDays', label: 'Training days / week', placeholder: '4', type: 'number' },
  { field: 'sessionLengthMinutes', label: 'Session length (min)', placeholder: '60', type: 'number' },
];

const AREA_FIELDS: Array<{ field: keyof ProfileFormState; label: string; placeholder: string; rows: number }> = [
  { field: 'equipment', label: 'Equipment (one per line)', placeholder: 'Barbell + rack…', rows: 3 },
  { field: 'limitations', label: 'Limitations', placeholder: 'injuries, no-go movements…', rows: 2 },
  { field: 'preferredFocus', label: 'Preferred focus', placeholder: 'back width…', rows: 2 },
  { field: 'notes', label: 'Notes', placeholder: 'anything else', rows: 2 },
];

function toFormState(profile: AthleteProfileRecord): ProfileFormState {
  return {
    name: profile.name ?? '',
    goal: profile.goal ?? '',
    age: profile.age === null ? '' : String(profile.age),
    sex: profile.sex ?? '',
    heightCm: profile.heightCm === null ? '' : String(profile.heightCm),
    weightKg: profile.weightKg === null ? '' : String(profile.weightKg),
    experienceLevel: profile.experienceLevel ?? '',
    cardioPreference: profile.cardioPreference ?? '',
    trainingDays: String(profile.trainingDays ?? ''),
    sessionLengthMinutes: String(profile.sessionLengthMinutes ?? ''),
    equipment: profile.equipment.join('\n'),
    limitations: profile.limitations.join('\n'),
    preferredFocus: profile.preferredFocus.join('\n'),
    notes: profile.notes.join('\n'),
  };
}

const AUTOSAVE_DEBOUNCE_MS = 800;

export function AthleteProfileEditor({
  workspace,
  profile,
}: {
  workspace: string;
  profile: AthleteProfileRecord;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(profile));
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const save = async () => {
    setSaveState('saving');
    const current = formRef.current;
    const formData = new FormData();
    formData.set('workspace', workspace);
    for (const [key, value] of Object.entries(current)) {
      formData.set(key, value);
    }
    const result = await autosaveProfileAction(formData);
    // A newer edit may already be pending; don't overwrite its status.
    if (formRef.current === current || result.ok === false) {
      setSaveState(result.ok ? 'saved' : 'error');
    }
  };

  const scheduleSave = () => {
    setSaveState('pending');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const setField = (field: keyof ProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    scheduleSave();
  };

  const statusLine =
    saveState === 'saving' || saveState === 'pending'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved. The coach reads this before every plan.'
        : 'Saved as you type. The coach reads this before every plan.';

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3.5 text-left"
      >
        <div>
          <Display as="div" className="text-[16px] font-bold">
            Athlete Profile
          </Display>
          <div className="text-[12px] text-fnt">
            {form.goal.trim() || 'Tell the coach who they’re training'}
          </div>
        </div>
        <div className="text-[13px] font-bold text-acc">{isOpen ? 'Close' : 'Edit'}</div>
      </button>
      {isOpen ? (
        <div className="flex flex-col gap-2.5 border-t border-dashed border-ln px-4 pb-4">
          <div className="grid grid-cols-2 gap-2.5 pt-3">
            {GRID_FIELDS.map((def) => (
              <label
                key={def.field}
                className={cx('flex flex-col gap-1', def.span2 && 'col-span-2')}
              >
                <FieldLabel>{def.label}</FieldLabel>
                <input
                  className={inputClass}
                  type={def.type ?? 'text'}
                  value={form[def.field]}
                  placeholder={def.placeholder}
                  onChange={(event) => setField(def.field, event.target.value)}
                />
              </label>
            ))}
          </div>
          {AREA_FIELDS.map((def) => (
            <label key={def.field} className="flex flex-col gap-1">
              <FieldLabel>{def.label}</FieldLabel>
              <textarea
                className={textareaClass}
                rows={def.rows}
                value={form[def.field]}
                placeholder={def.placeholder}
                onChange={(event) => setField(def.field, event.target.value)}
              />
            </label>
          ))}
          {saveState === 'error' ? (
            <ErrorBanner onRetry={() => void save()}>
              The profile didn&apos;t save. Your edits are still here — retry.
            </ErrorBanner>
          ) : (
            <div className="text-[11px] text-fnt">{statusLine}</div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
