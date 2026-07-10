"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
          <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Application Error</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Something failed while rendering the page.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The details below are shown to help recover the local environment during development.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">{error.message || "Unknown error"}</p>
              {error.digest ? <p className="mt-2 text-xs text-slate-500">Digest: {error.digest}</p> : null}
            </div>

            {"stack" in error && typeof error.stack === "string" ? (
              <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {error.stack}
              </pre>
            ) : null}

            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
