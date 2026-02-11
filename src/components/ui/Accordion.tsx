'use client';

import { useConfigStore } from '@/store/useConfigStore';

interface AccordionSectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

export default function AccordionSection({ number, title, children }: AccordionSectionProps) {
  const activeSection = useConfigStore((s) => s.activeAccordionSection);
  const setSection = useConfigStore((s) => s.setAccordionSection);

  const isOpen = activeSection === number;

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setSection(isOpen ? -1 : number)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {number}
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-900">{title}</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
