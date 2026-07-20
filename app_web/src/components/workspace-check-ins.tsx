'use client';

import { useState } from 'react';

import { saveCheckInAction } from '../../app/actions';
import type { CheckInRecord } from '@/lib/server/workspaces';
import { Button, Card, Chip, Display, FieldLabel, inputClass, textareaClass } from '@/components/ui';

/** check_in_date arrives as a stringified Date from Postgres — normalize it. */
function checkInDateParts(value: string): { display: string; inputValue: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { display: value, inputValue: value };
  }
  return {
    display: parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    inputValue: parsed.toISOString().slice(0, 10),
  };
}

const SLIDER_FIELDS = [
  { name: 'averageDifficulty', label: 'Difficulty' },
  { name: 'energy', label: 'Energy' },
  { name: 'soreness', label: 'Soreness' },
] as const;

const AREA_FIELDS = [
  { name: 'wins', label: 'Wins', placeholder: 'what went right' },
  { name: 'struggles', label: 'Struggles', placeholder: 'what fought back' },
  { name: 'notes', label: 'Notes', placeholder: 'anything else' },
] as const;

function SliderField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[11.5px]">
        <span className="font-semibold text-mut">{label}</span>
        <span className="font-bold text-acc">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        name={name}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

function CheckInFields({
  workspace,
  checkIn,
  defaultPlanned,
}: {
  workspace: string;
  checkIn?: CheckInRecord;
  defaultPlanned: number;
}) {
  return (
    <>
      <input type="hidden" name="workspace" value={workspace} />
      <input type="hidden" name="id" value={checkIn?.id ?? ''} />
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <FieldLabel>Date</FieldLabel>
          <input
            className={`${inputClass} h-10 bg-card`}
            type="date"
            name="checkInDate"
            defaultValue={
              checkIn
                ? checkInDateParts(checkIn.checkInDate).inputValue
                : new Date().toISOString().slice(0, 10)
            }
            required
          />
        </label>
        <div className="flex flex-col gap-1">
          <FieldLabel>Workouts done / planned</FieldLabel>
          <div className="flex items-center gap-1.5">
            <input
              className={`${inputClass} h-10 bg-card`}
              type="number"
              min={0}
              name="workoutsCompleted"
              defaultValue={checkIn?.workoutsCompleted ?? 0}
              aria-label="Workouts completed"
            />
            <span className="text-[13px] text-fnt">/</span>
            <input
              className={`${inputClass} h-10 bg-card`}
              type="number"
              min={0}
              name="workoutsPlanned"
              defaultValue={checkIn?.workoutsPlanned ?? defaultPlanned}
              aria-label="Workouts planned"
            />
          </div>
        </div>
      </div>
      {SLIDER_FIELDS.map((field) => (
        <SliderField
          key={field.name}
          label={field.label}
          name={field.name}
          defaultValue={checkIn ? checkIn[field.name] : 5}
        />
      ))}
      <label className="flex flex-col gap-1">
        <FieldLabel>Body weight (kg)</FieldLabel>
        <input
          className={`${inputClass} h-10 bg-card`}
          type="number"
          step="0.1"
          name="bodyWeightKg"
          defaultValue={checkIn?.bodyWeightKg ?? ''}
          placeholder="82.4"
        />
      </label>
      {AREA_FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <FieldLabel>{field.label}</FieldLabel>
          <textarea
            className={`${textareaClass} bg-card`}
            rows={2}
            name={field.name}
            defaultValue={checkIn ? checkIn[field.name].join('\n') : ''}
            placeholder={field.placeholder}
          />
        </label>
      ))}
    </>
  );
}

function CheckInListItem({
  workspace,
  checkIn,
  defaultPlanned,
}: {
  workspace: string;
  checkIn: CheckInRecord;
  defaultPlanned: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="overflow-hidden rounded-[14px] border border-ln">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setIsEditing(false);
        }}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-bg2 px-3.5 py-3 text-left"
      >
        <div className="text-[13px] font-bold">{checkInDateParts(checkIn.checkInDate).display}</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-fnt">
            diff {checkIn.averageDifficulty} · energy {checkIn.energy} · sore {checkIn.soreness}
          </span>
          <span className="text-[11px] font-bold text-acc">{isOpen ? 'Close' : 'Open'}</span>
        </div>
      </button>
      {isOpen ? (
        <div className="flex flex-col gap-2 px-3.5 py-3">
          {isEditing ? (
            <form action={saveCheckInAction} className="flex flex-col gap-2.5">
              <CheckInFields workspace={workspace} checkIn={checkIn} defaultPlanned={defaultPlanned} />
              <Button type="submit" size="sm" className="h-10">
                Save changes
              </Button>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Chip>Done {checkIn.workoutsCompleted}/{checkIn.workoutsPlanned}</Chip>
                <Chip>Difficulty {checkIn.averageDifficulty}/10</Chip>
                <Chip>Energy {checkIn.energy}/10</Chip>
                <Chip>Soreness {checkIn.soreness}/10</Chip>
                <Chip>{checkIn.bodyWeightKg !== null ? `${checkIn.bodyWeightKg} kg` : 'no weight'}</Chip>
              </div>
              <div className="text-[12.5px] leading-relaxed text-ink">
                <b>Wins:</b> {checkIn.wins.join(' · ') || '—'}
              </div>
              <div className="text-[12.5px] leading-relaxed text-mut">
                <b>Struggles:</b> {checkIn.struggles.join(' · ') || '—'}
              </div>
              {checkIn.notes.length > 0 ? (
                <div className="text-[12.5px] leading-relaxed text-mut">
                  <b>Notes:</b> {checkIn.notes.join(' · ')}
                </div>
              ) : null}
              <Button
                type="button"
                variant="soft"
                size="sm"
                className="h-8 self-start"
                onClick={() => setIsEditing(true)}
              >
                ✎ Edit check-in
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceCheckIns({
  workspace,
  checkIns,
  hasPlan,
  defaultPlanned,
}: {
  workspace: string;
  checkIns: CheckInRecord[];
  hasPlan: boolean;
  defaultPlanned: number;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Display as="h2" className="text-[16px] font-bold">
          Check-ins
        </Display>
        {hasPlan ? (
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => setIsFormOpen((open) => !open)}
          >
            {isFormOpen ? 'Close' : '+ New'}
          </Button>
        ) : null}
      </div>

      {!hasPlan ? (
        <div className="flex flex-col items-center gap-1.5 rounded-[14px] border border-dashed border-ln2 bg-bg2 px-4 py-[18px] text-center">
          <div className="text-[22px]">🔒</div>
          <div className="text-[13.5px] font-bold">Check-ins unlock with your first plan</div>
          <div className="text-[12.5px] leading-relaxed text-mut">
            A check-in tells the coach how a plan felt — energy, soreness, wins. No plan yet,
            nothing to check in on. Generate one above.
          </div>
        </div>
      ) : null}

      {hasPlan && isFormOpen ? (
        <form
          action={saveCheckInAction}
          className="flex flex-col gap-2.5 rounded-[14px] border border-ln bg-bg2 p-3.5"
        >
          <CheckInFields workspace={workspace} defaultPlanned={defaultPlanned} />
          <Button type="submit" className="h-11 text-[13.5px]">
            Log check-in
          </Button>
        </form>
      ) : null}

      {hasPlan && checkIns.length === 0 && !isFormOpen ? (
        <div className="px-1.5 py-1.5 text-center text-[12.5px] text-fnt">
          No check-ins yet. After a few workout days, tell the coach how it went.
        </div>
      ) : null}

      {hasPlan
        ? checkIns.map((checkIn) => (
            <CheckInListItem
              key={checkIn.id}
              workspace={workspace}
              checkIn={checkIn}
              defaultPlanned={defaultPlanned}
            />
          ))
        : null}
    </Card>
  );
}
