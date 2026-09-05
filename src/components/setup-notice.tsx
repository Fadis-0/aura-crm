import { KeyRound, Terminal } from "lucide-react";

const STEPS = [
  {
    title: "Create a Supabase project",
    body: "supabase.com → New project. Pick a region close to you and save the database password.",
  },
  {
    title: "Copy the keys",
    body: "Project Settings → API. You need the Project URL, the anon public key, and the service_role key.",
  },
  {
    title: "Fill in .env.local",
    body: "Copy .env.example to .env.local and paste the three values in.",
  },
  {
    title: "Run the migration and seed",
    body: "npm run db:push then npm run db:seed. That builds every table, the row-level security policies, and your two accounts.",
  },
];

export function SetupNotice() {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <span className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[var(--clay)] text-white shadow-raised">
          <KeyRound size={20} />
        </span>
        <h1 className="text-[28px] leading-tight">Connect Supabase to continue</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
          Aura stores everything in your own Supabase project. Four steps and
          you are running.
        </p>

        <ol className="mt-7 space-y-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-3.5 rounded-lg border border-line bg-surface p-4 shadow-soft"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-[12px] font-semibold text-ink-2">
                {i + 1}
              </span>
              <div>
                <p className="text-[13.5px] font-medium text-ink">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-ink-3">
          <Terminal size={15} className="shrink-0 text-ink-4" />
          Restart <code className="text-ink-2">npm run dev</code> after editing
          <code className="text-ink-2">.env.local</code> so Next picks up the values.
        </div>
      </div>
    </div>
  );
}
