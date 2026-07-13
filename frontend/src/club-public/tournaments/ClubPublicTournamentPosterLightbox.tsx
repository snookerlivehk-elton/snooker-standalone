import React from 'react';

type ClubPublicTournamentPosterLightboxProps = {
  open: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
};

const ClubPublicTournamentPosterLightbox: React.FC<ClubPublicTournamentPosterLightboxProps> = ({
  open,
  imageUrl,
  title,
  onClose,
}) => {
  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{title || '海報預覽'}</div>
            <div className="text-xs cue-muted mt-1">點背景或按 Esc 關閉，原圖會以最大尺寸顯示。</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
          >
            關閉
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 sm:p-4">
          <img
            src={imageUrl}
            alt={title || '海報預覽'}
            className="max-h-[78vh] w-full rounded-xl object-contain bg-black/20"
          />
        </div>
      </div>
    </div>
  );
};

export default ClubPublicTournamentPosterLightbox;
