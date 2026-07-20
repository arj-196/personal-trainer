'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { ErrorBanner } from '@/components/ui';

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
  onClose: () => void;
};

type ChatResponse = {
  arnoldResponse: string;
};

export function WorkoutSessionChat({
  workspace,
  dayHeading,
  isOpen,
  isStopwatchVisible,
  onClose,
}: WorkoutSessionChatProps) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<WorkoutSessionChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastPayloadRef = useRef<{ question: string; history: WorkoutSessionChatTurn[] } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [turns, isLoading, error, isOpen]);

  if (!isOpen) {
    return null;
  }

  const sendQuestion = async (nextQuestion: string, history: WorkoutSessionChatTurn[]) => {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || isLoading) {
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
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Arnold dropped the connection, not the weight.',
        );
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
    } catch {
      setError('Arnold dropped the connection, not the weight.');
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
    <section
      className={[
        'fixed inset-x-0 top-[70px] z-40 mx-auto flex w-auto max-w-[460px] flex-col overflow-hidden rounded-[20px] border border-ln bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-[480px]:mx-2.5',
        isStopwatchVisible
          ? 'bottom-[calc(232px+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(18px+env(safe-area-inset-bottom))]',
      ].join(' ')}
    >
      <header className="flex items-center justify-between border-b border-ln bg-bg2 px-4 py-3">
        <div className="flex flex-col">
          <h2 className="m-0 font-display text-[16px] font-extrabold">Ask Arnold</h2>
          <p className="m-0 text-[10.5px] text-fnt">ephemeral — nothing here is saved</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="h-[30px] w-[30px] cursor-pointer rounded-full border border-ln bg-transparent text-ink"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3.5">
        {turns.length === 0 && !isLoading && !error ? (
          <div className="flex flex-col items-center gap-1.5 px-5 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg2 font-display text-[18px] font-extrabold">
              A
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-mut">
              Stuck on form? Want a swap?
              <br />
              Arnold has opinions. Ask.
            </p>
          </div>
        ) : null}

        {turns.map((turn, index) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <div className="max-w-[85%] self-end rounded-[16px] rounded-br-[4px] bg-ink px-3 py-2 text-[13px] leading-snug text-onink">
              {turn.question}
            </div>
            <div className="flex max-w-[85%] flex-col items-start self-start">
              <div className="rounded-[16px] rounded-bl-[4px] border border-ln bg-bg2 px-3 py-2 text-[13px] leading-snug text-ink">
                {turn.arnoldResponse}
              </div>
              {index === turns.length - 1 ? (
                <div className="px-1 pt-0.5 text-[10px] text-fnt">Arnold Schwarzenegger</div>
              ) : null}
            </div>
          </div>
        ))}

        {isLoading ? (
          <>
            <div className="max-w-[85%] self-end rounded-[16px] rounded-br-[4px] bg-ink px-3 py-2 text-[13px] leading-snug text-onink">
              {pendingQuestion}
            </div>
            <div className="animate-pulse-soft self-start text-[12px] text-fnt">
              Arnold is answering…
            </div>
          </>
        ) : null}

        {error ? <ErrorBanner onRetry={retryLastQuestion}>{error}</ErrorBanner> : null}
      </div>

      <form className="flex gap-2 border-t border-ln p-2.5" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="workout-session-chat-question">
          Ask Arnold anything
        </label>
        <input
          id="workout-session-chat-question"
          className="h-[42px] min-w-0 flex-1 rounded-full border border-ln bg-bg2 px-4 text-[13px] text-ink placeholder:text-fnt"
          value={question}
          maxLength={800}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask Arnold anything…"
          disabled={isLoading}
        />
        <button
          type="submit"
          aria-label="Send"
          className="h-[42px] w-[42px] flex-none cursor-pointer rounded-full border-none bg-acc text-[15px] text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || question.trim().length === 0}
        >
          ↑
        </button>
      </form>
    </section>
  );
}
