import React from 'react';

export default function PageSection(props: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={props.className}>
      <div className="cue-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1 rounded bg-[var(--brand-yellow)]" />
              <div className="cue-zh-title text-lg truncate">{props.title}</div>
            </div>
          </div>
          {props.right && <div className="flex-shrink-0">{props.right}</div>}
        </div>
        <div className="mt-3">{props.children}</div>
      </div>
    </section>
  );
}

