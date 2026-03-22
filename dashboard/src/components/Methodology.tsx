import { useRef, useEffect, useState } from "react";

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typeset?: (elements?: HTMLElement[]) => void;
    };
  }
}

interface MethodologyProps {
  children: React.ReactNode;
}

export default function Methodology({ children }: MethodologyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && ref.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([ref.current]).catch(() => {});
    }
  }, [open, children]);

  return (
    <div className="mt-6 border-t border-[#334155]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
      >
        <span className="font-semibold uppercase tracking-wider">Methodology & Data Notes</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          ref={ref}
          className="pb-4 text-xs text-[#94a3b8] leading-relaxed space-y-3 methodology-content"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MathBlock({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([ref.current]).catch(() => {});
    }
  }, [children]);
  return (
    <div ref={ref} className="bg-[#0f172a] rounded p-3 border border-[#334155]/50 overflow-x-auto my-2 text-[#e2e8f0]">
      {children}
    </div>
  );
}

export function MNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[#e2e8f0] font-semibold">{title}: </span>
      {children}
    </div>
  );
}
