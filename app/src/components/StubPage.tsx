interface StubPageProps {
  title: string;
  description: string;
  nextSteps: string[];
}

/**
 * Page placeholder utilisée pendant le rebuild pour matérialiser la route
 * et documenter ce qui reste à implémenter.
 */
export function StubPage({ title, description, nextSteps }: StubPageProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-400">{description}</p>
      <div className="glass px-5 py-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
          Todo
        </div>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {nextSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-600">·</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
