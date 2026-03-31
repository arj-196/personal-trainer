import Link from 'next/link';

import { libraryImageUrl, readExerciseLibrary } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? '';
  const allExercises = await readExerciseLibrary();
  const exercises = query
    ? allExercises.filter((exercise) => {
        const haystack = [exercise.name, exercise.summary, ...exercise.aliases, ...exercise.cues]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : allExercises;

  return (
    <main className="shell">
      <section className="hero">
        <span className="hero-eyebrow">Exercise Library</span>
        <h1 className="hero-title">Movement references that are actually usable.</h1>
        <p className="hero-subtitle">
          Browse the trainer&apos;s exercise library, see the image reference, and use the setup and cue notes
          when you forget what a movement means in the middle of training.
        </p>
        <div className="hero-links">
          <Link className="chip-link" href="/">
            Current Workout
          </Link>
          <Link className="chip-link" href="/recipes">
            Recipes
          </Link>
          <Link className="chip-link active" href="/library">
            Exercise Library
          </Link>
        </div>
      </section>

      <section className="panel panel-spaced">
        <div className="library-toolbar">
          <div>
            <h2 className="library-title section-title">{exercises.length} exercise references</h2>
            <p className="section-copy">Use the query string like <code>?q=squat</code> to filter.</p>
          </div>
          {query ? (
            <Link className="chip-link" href="/library">
              Clear filter
            </Link>
          ) : null}
        </div>

        <div className="library-grid">
          {exercises.map((exercise) => (
            <article key={exercise.slug} className="library-card">
              <img
                className="library-image"
                src={libraryImageUrl(exercise.image_filename)}
                alt={exercise.name}
              />
              <div className="library-body">
                <h3 className="library-name">{exercise.name}</h3>
                <p className="library-copy">{exercise.summary}</p>
                <div className="detail-list">
                  <section className="detail-section">
                    <span className="detail-label">Setup</span>
                    <p className="library-copy">{exercise.setup}</p>
                  </section>
                  <section className="detail-section">
                    <span className="detail-label">Coaching Cues</span>
                    <ul className="cues">
                      {exercise.cues.map((cue) => (
                        <li key={cue}>{cue}</li>
                      ))}
                    </ul>
                  </section>
                  {exercise.visual_note ? (
                    <section className="detail-section">
                      <span className="detail-label">Visual Note</span>
                      <p className="library-copy">{exercise.visual_note}</p>
                    </section>
                  ) : null}
                </div>
                <div className="badge-row">
                  <span className="badge">{exercise.license}</span>
                  <span className="badge">{exercise.author || 'Unknown author'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
