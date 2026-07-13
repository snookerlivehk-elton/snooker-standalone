import React from 'react';

export type TournamentPosterLightboxItem = {
  imageUrl: string;
  title: string;
};

type TournamentPosterLightboxProps = {
  open: boolean;
  posters: TournamentPosterLightboxItem[];
  initialIndex?: number;
  onClose: () => void;
};

const TournamentPosterLightbox: React.FC<TournamentPosterLightboxProps> = ({
  open,
  posters,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (!open) return undefined;
    setCurrentIndex(Math.max(0, Math.min(initialIndex, Math.max(0, posters.length - 1))));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev <= 0 ? Math.max(0, posters.length - 1) : prev - 1));
      }
      if (event.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev >= posters.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialIndex, onClose, open, posters.length]);

  const activePoster = posters[currentIndex] || null;
  if (!open || !activePoster?.imageUrl) return null;

  const canNavigate = posters.length > 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{activePoster.title || '海報預覽'}</div>
            <div className="text-xs cue-muted mt-1">
              {canNavigate ? `第 ${currentIndex + 1} / ${posters.length} 張，` : ''}
              點背景或按 Esc 關閉{canNavigate ? '，左右方向鍵可切換' : ''}。
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canNavigate ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev <= 0 ? posters.length - 1 : prev - 1))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                >
                  上一張
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev >= posters.length - 1 ? 0 : prev + 1))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                >
                  下一張
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
            >
              關閉
            </button>
          </div>
        </div>
        {canNavigate ? (
          <div className="mb-3 flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            {posters.map((poster, index) => (
              <button
                key={`${poster.title}-${index}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  index === currentIndex
                    ? 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {poster.title || `海報 ${index + 1}`}
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 sm:p-4">
          <img
            src={activePoster.imageUrl}
            alt={activePoster.title || '海報預覽'}
            className="max-h-[78vh] w-full rounded-xl object-contain bg-black/20"
          />
        </div>
      </div>
    </div>
  );
};

export default TournamentPosterLightbox;
