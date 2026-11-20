import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

export function GalleryModal() {
  const photos = ANNIVERSARY_DATA.gallery;
  const [activeIndex, setActiveIndex] = useState(0);

  const safeIndex = photos.length > 0 ? activeIndex % photos.length : 0;
  const current = photos[safeIndex];
  const hasMultiple = photos.length > 1;

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [hasMultiple, photos.length]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setActiveIndex((prev) => (prev + 1) % photos.length);
  }, [hasMultiple, photos.length]);

  useEffect(() => {
    if (!hasMultiple) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, hasMultiple]);

  if (!current) {
    return (
      <div className="py-8 text-center">
        <h2
          id="anni-modal-title"
          className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
        >
          Thư Viện Kỷ Niệm
        </h2>
        <p className="mt-2 text-sm text-lavender">Chưa có hình ảnh kỷ niệm nào.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon-pink/35 bg-neon-pink/15 text-neon-pink">
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2
          id="anni-modal-title"
          className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
        >
          Thư Viện Kỷ Niệm
        </h2>
      </div>

      {/* Photo Showcase with Soft Blurred Ambient Backdrop */}
      <div className="relative mt-5 w-full overflow-hidden rounded-2xl border border-neon-pink/28 bg-void/90 p-3 sm:p-4">
        {/* Ambient blurred duplicate background */}
        <img
          src={current.imageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-2xl"
        />

        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/15 bg-void/70">
          <AnimatePresence mode="wait">
            <motion.img
              key={current.id}
              src={current.imageUrl}
              alt={current.title}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full object-cover"
            />
          </AnimatePresence>

          {/* Floating frosted date & location badge */}
          <div className="glass-surface absolute top-3 left-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-starlight">
            <Calendar className="h-3.5 w-3.5 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
            <span className="font-mono tabular-nums">{current.date}</span>
            <span className="text-lavender-muted" aria-hidden="true">
              ·
            </span>
            <MapPin className="h-3.5 w-3.5 text-neon-magenta" strokeWidth={1.75} aria-hidden="true" />
            <span>{current.location}</span>
          </div>
        </div>

        {/* Romantic title & caption */}
        <div className="relative mt-4 px-1">
          <h3 className="font-display text-2xl font-semibold text-starlight">{current.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-lavender">{current.caption}</p>
        </div>
      </div>

      {/* Next / Prev Navigation & Pagination Dots */}
      {hasMultiple && (
        <div className="mt-4 flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Ảnh kỷ niệm trước"
            className="glass-interactive inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs leading-normal font-medium text-lavender hover:text-starlight"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Trước</span>
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Danh sách ảnh kỷ niệm">
            {photos.map((photo, idx) => {
              const isCurrent = idx === safeIndex;
              return (
                <button
                  key={photo.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-label={`Xem kỷ niệm ${idx + 1}: ${photo.title}`}
                  onClick={() => setActiveIndex(idx)}
                  className="flex h-11 w-7 cursor-pointer items-center justify-center"
                >
                  <span
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isCurrent
                        ? 'w-6 bg-neon-pink shadow-[0_0_10px_#ff3ea5]'
                        : 'w-2 bg-lavender-muted/45 hover:bg-lavender'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="Ảnh kỷ niệm tiếp theo"
            className="glass-interactive inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs leading-normal font-medium text-lavender hover:text-starlight"
          >
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
