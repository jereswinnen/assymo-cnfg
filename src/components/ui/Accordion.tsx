'use client';

import { useConfigStore } from '@/store/useConfigStore';

interface AccordionSectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
}

export default function AccordionSection({ number, title, children, isLast }: AccordionSectionProps) {
  const activeSection = useConfigStore((s) => s.activeAccordionSection);
  const setSection = useConfigStore((s) => s.setAccordionSection);

  const isOpen = activeSection === number;

  return (
    <div className={!isLast ? 'border-b border-border/60' : ''}>
      <button
        onClick={() => setSection(isOpen ? -1 : number)}
        className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-[11px] font-semibold text-muted-foreground">
          {number}
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        <svg
          className={`h-4 w-4 text-muted-foreground/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
}
