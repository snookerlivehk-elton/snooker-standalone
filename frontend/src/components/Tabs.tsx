import React from 'react';

export type TabItem = {
  key: string;
  label: React.ReactNode;
};

type TabsProps = {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange }) => {
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex min-w-full items-center gap-2 bg-black/30 border border-white/10 rounded-lg p-1">
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              type="button"
              className={[
                'whitespace-nowrap px-3 py-2 rounded-md text-sm font-semibold transition-colors',
                active ? 'bg-white/15 text-white' : 'text-gray-300 hover:bg-white/10',
              ].join(' ')}
              onClick={() => onChange(it.key)}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Tabs;
