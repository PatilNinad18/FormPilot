import { useState } from 'react';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { ResumeVaultScreen } from './screens/resumes/ResumeVaultScreen';

/**
 * Popup root. A slim brand header, a two-tab switch (Profile / Resumes), and the
 * active screen below it. The popup is width-constrained (see index.html) and
 * the body scrolls so long forms stay usable in the toolbar popup.
 */

type Tab = 'profile' | 'resumes';

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'resumes', label: 'Resumes' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="flex max-h-[600px] min-w-[360px] flex-col bg-surface font-sans text-ink">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-fg shadow-soft">
          <span className="text-base font-bold">F</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">FormPilot AI</h1>
          <p className="text-xs text-ink-faint">One Click. Every Form Filled.</p>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-line px-3 pt-2" role="tablist" aria-label="Sections">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                active
                  ? 'border-b-2 border-brand text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto px-5 py-4 animate-fade-in">
        {tab === 'profile' ? <ProfileScreen /> : <ResumeVaultScreen />}
      </main>
    </div>
  );
}
