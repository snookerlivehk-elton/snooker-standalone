import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type FAQItem = { q: string; a: string };

export default function HelpGuide(props: {
  title: string;
  label?: string;
  intro?: string;
  steps?: string[];
  tips?: string[];
  faq?: FAQItem[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const canUseDom = typeof document !== 'undefined' && !!document.body;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const steps = useMemo(() => (Array.isArray(props.steps) ? props.steps.filter(Boolean) : []), [props.steps]);
  const tips = useMemo(() => (Array.isArray(props.tips) ? props.tips.filter(Boolean) : []), [props.tips]);
  const faq = useMemo(() => (Array.isArray(props.faq) ? props.faq.filter((x) => x && x.q) : []), [props.faq]);

  const modal = open ? (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl cue-card">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-extrabold accent-yellow truncate">{props.title}</div>
              {props.intro && <div className="text-sm cue-muted mt-1">{props.intro}</div>}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
            >
              關閉
            </button>
          </div>

          <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {steps.length > 0 && (
              <div className="cue-surface rounded-lg p-3">
                <div className="font-semibold mb-2">操作步驟</div>
                <ol className="list-decimal pl-5 space-y-1 text-sm marker:text-[var(--brand-fg)]">
                  {steps.map((s, i) => (
                    <li key={`${i}-${s}`} className="text-[var(--brand-fg)]">
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {tips.length > 0 && (
              <div className="cue-surface rounded-lg p-3">
                <div className="font-semibold mb-2">注意事項</div>
                <ul className="list-disc pl-5 space-y-1 text-sm marker:text-[var(--brand-fg)]">
                  {tips.map((s, i) => (
                    <li key={`${i}-${s}`} className="text-[var(--brand-fg)]">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {faq.length > 0 && (
              <div className="cue-surface rounded-lg p-3">
                <div className="font-semibold mb-2">常見問題</div>
                <div className="space-y-2">
                  {faq.map((x, i) => (
                    <details key={`${i}-${x.q}`} className="cue-surface-strong rounded-lg px-3 py-2">
                      <summary className="cursor-pointer font-semibold text-sm text-[var(--brand-fg)]">{x.q}</summary>
                      <div className="mt-2 text-sm cue-muted whitespace-pre-wrap">{x.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          try { e.preventDefault(); } catch {}
          try { e.stopPropagation(); } catch {}
          setOpen(true);
        }}
        className={
          props.buttonClassName ||
          'px-3 py-1.5 rounded-full text-sm font-semibold cue-surface hover:brightness-95 ring-1 ring-white/10'
        }
        aria-label={props.label || '操作說明'}
      >
        {props.label || '操作說明'}
      </button>

      {canUseDom ? (modal ? createPortal(modal, document.body) : null) : modal}
    </>
  );
}
