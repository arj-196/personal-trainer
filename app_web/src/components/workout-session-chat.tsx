'use client';

import { FormEvent, useRef, useState } from 'react';

export type WorkoutSessionChatTurn = {
  id: string;
  question: string;
  arnoldResponse: string;
};

type WorkoutSessionChatProps = {
  workspace: string;
  dayHeading: string;
  isOpen: boolean;
  isStopwatchVisible: boolean;
};

type ChatResponse = {
  arnoldResponse: string;
};

const emptyError = 'Ask a question before sending.';

export function WorkoutSessionChat({ workspace, dayHeading, isOpen, isStopwatchVisible }: WorkoutSessionChatProps) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<WorkoutSessionChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastPayloadRef = useRef<{ question: string; history: WorkoutSessionChatTurn[] } | null>(null);

  if (!isOpen) {
    return null;
  }

  const sendQuestion = async (nextQuestion: string, history: WorkoutSessionChatTurn[]) => {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion) {
      setError(emptyError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPendingQuestion(trimmedQuestion);
    lastPayloadRef.current = { question: trimmedQuestion, history };

    try {
      const response = await fetch(`/api/workout-session-chat/${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayHeading,
          question: trimmedQuestion,
          history: history.map((turn) => ({
            question: turn.question,
            arnoldResponse: turn.arnoldResponse,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'The coaches could not answer right now.');
      }
      const chatResponse = payload as ChatResponse;
      setTurns((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          question: trimmedQuestion,
          arnoldResponse: chatResponse.arnoldResponse,
        },
      ]);
      setQuestion('');
      lastPayloadRef.current = null;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The coaches could not answer right now.');
    } finally {
      setIsLoading(false);
      setPendingQuestion('');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(question, turns);
  };

  const retryLastQuestion = () => {
    const lastPayload = lastPayloadRef.current;
    if (!lastPayload || isLoading) {
      return;
    }
    void sendQuestion(lastPayload.question, lastPayload.history);
  };

  return (
    <section className={[
      'fixed left-3 right-3 z-40 grid overflow-hidden rounded-[1.25rem] border border-slate-900/10 bg-white shadow-[0_24px_70px_rgba(23,24,28,0.22)] sm:left-auto sm:right-4 sm:w-[380px] xl:right-[max(1rem,calc(50%-36rem))]',
      isStopwatchVisible
        ? 'bottom-[calc(256px+env(safe-area-inset-bottom))] max-h-[min(52vh,460px)]'
        : 'bottom-[calc(76px+env(safe-area-inset-bottom))] max-h-[min(72vh,560px)]',
    ].join(' ')}>
      <header className="border-b border-slate-900/8 bg-[#17181c] px-4 py-3 text-white">
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.14em] text-white/68">Ask Arnold</p>
        <h2 className="m-0 mt-1 truncate text-base font-extrabold leading-tight">{dayHeading}</h2>
      </header>

      <div className="grid max-h-[calc(min(72vh,560px)-132px)] gap-3 overflow-y-auto bg-slate-50/80 p-3">
        {turns.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm leading-relaxed text-slate-500">
            Ask about the exercises, target muscles, setup, substitutions, or how to interpret today&apos;s prescription.
          </div>
        ) : null}

        {turns.map((turn) => (
          <article key={turn.id} className="grid gap-2">
            <div className="justify-self-end rounded-2xl bg-[#17181c] px-3.5 py-2 text-sm font-semibold leading-relaxed text-white">
              {turn.question}
            </div>
            <PersonaReply text={turn.arnoldResponse} />
          </article>
        ))}

        {isLoading ? (
          <article className="grid gap-2">
            <div className="justify-self-end rounded-2xl bg-[#17181c] px-3.5 py-2 text-sm font-semibold leading-relaxed text-white">
              {pendingQuestion}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-500">
              Arnold is answering...
            </div>
          </article>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="m-0">{error}</p>
            {lastPayloadRef.current ? (
              <button
                type="button"
                className="mt-2 inline-flex min-h-9 items-center justify-center rounded-full bg-red-700 px-3 text-xs font-bold text-white"
                onClick={retryLastQuestion}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-slate-900/8 bg-white p-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="workout-session-chat-question">Ask a workout question</label>
        <input
          id="workout-session-chat-question"
          className="min-h-11 min-w-0 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-cyan-500"
          value={question}
          maxLength={800}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this workout"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
    </section>
  );
}

function PersonaReply({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#ff6359]/35 bg-[#fff4f1] p-3">
      <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-slate-500">Arnold Schwarzenegger</p>
      <p className="m-0 mt-1 text-sm leading-relaxed text-slate-800">{text}</p>
    </div>
  );
}
