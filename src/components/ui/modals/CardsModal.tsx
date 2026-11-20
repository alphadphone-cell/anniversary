import { useCallback, useState } from 'react';
import { Shuffle, Sparkles } from 'lucide-react';
import { ANNIVERSARY_DATA, type LoveCardItem } from '../../../data/anniversaryData';

function shuffleDeck(items: LoveCardItem[]): LoveCardItem[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ACCENT_RING: Record<LoveCardItem['accent'], string> = {
  pink: 'border-neon-pink/55 shadow-[0_12px_30px_-10px_rgba(255,62,165,0.45)]',
  magenta: 'border-neon-magenta/55 shadow-[0_12px_30px_-10px_rgba(217,70,239,0.45)]',
  violet: 'border-neon-violet/55 shadow-[0_12px_30px_-10px_rgba(139,92,246,0.45)]',
};

export function CardsModal() {
  const [deck, setDeck] = useState<LoveCardItem[]>(() => ANNIVERSARY_DATA.cards.slice(0, 5));
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});

  const toggleCard = useCallback((id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleShuffleReset = useCallback(() => {
    setFlippedIds({});
    setDeck((prev) => shuffleDeck(prev));
  }, []);

  const revealedCount = Object.values(flippedIds).filter(Boolean).length;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon-magenta/35 bg-neon-magenta/15 text-neon-pink">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2
          id="anni-modal-title"
          className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
        >
          Thẻ Lời Chúc &amp; Quà Tặng
        </h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-lavender">
        Chạm vào một lá thẻ để lật mở điều ước ngọt ngào dành riêng cho em nhé.
      </p>

      {/* 5 Face-Down 3D Flip Cards */}
      <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
        {deck.map((card, index) => {
          const isFlipped = Boolean(flippedIds[card.id]);
          const spanLastOnMobile = index === deck.length - 1 ? 'col-span-2 mx-auto w-[48%] sm:col-span-1 sm:w-full' : '';

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleCard(card.id)}
              aria-pressed={isFlipped}
              aria-label={
                isFlipped ? `${card.title}: ${card.message}` : `Lật thẻ lời chúc số ${index + 1}`
              }
              className={`group relative h-60 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink sm:h-64 ${spanLastOnMobile}`}
              style={{ perspective: '1000px' }}
            >
              <div
                className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Card Front (Face-Down Obsidian + Twin Glowing Hearts matching reference) */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-[#170b2b] via-[#0e061d] to-[#130826] p-3 transition-colors duration-200 group-hover:border-neon-pink/55 group-hover:shadow-[0_12px_28px_-10px_rgba(255,62,165,0.42)]"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <svg viewBox="0 0 84 84" className="h-14 w-14 overflow-visible" aria-hidden="true">
                    {/* Larger foreground neon heart */}
                    <path
                      d="M37 64 C35.5 62.6 14 48.5 14 34.5 C14 26.8 19.8 21.5 26.8 21.5 C31.2 21.5 34.8 23.6 37 27.2 C39.2 23.6 42.8 21.5 47.2 21.5 C54.2 21.5 60 26.8 60 34.5 C60 48.5 38.5 62.6 37 64 Z"
                      fill="#ff3ea5"
                      style={{ filter: 'drop-shadow(0 0 12px rgba(255, 62, 165, 0.78))' }}
                    />
                    {/* Smaller companion heart upper right */}
                    <path
                      d="M57 36 C56 35 45 27.8 45 20.8 C45 16.8 48 14 51.6 14 C53.8 14 55.8 15.1 57 17 C58.2 15.1 60.2 14 62.4 14 C66 14 69 16.8 69 20.8 C69 27.8 58 35 57 36 Z"
                      fill="#ec4899"
                      style={{ filter: 'drop-shadow(0 0 10px rgba(236, 72, 153, 0.72))' }}
                    />
                  </svg>
                  <span className="mt-3 font-mono text-[11px] tracking-[0.2em] text-lavender-muted tabular-nums">
                    0{index + 1}
                  </span>
                </div>

                {/* Card Back (Revealed Romantic Coupon) */}
                <div
                  className={`absolute inset-0 flex flex-col justify-between rounded-2xl border bg-gradient-to-b from-[#261142] via-[#190a30] to-[#120624] p-3.5 ${ACCENT_RING[card.accent]}`}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <span className="font-mono text-[10px] tracking-[0.18em] text-neon-pink uppercase">
                    {card.couponTag}
                  </span>
                  <div className="my-auto py-1">
                    <h3 className="font-display text-base leading-snug font-semibold text-starlight sm:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-[11px] leading-snug text-lavender">{card.message}</p>
                  </div>
                  <span className="text-[11px] leading-normal font-medium text-lavender-muted">
                    Chạm để úp lại
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Shuffle / Reset Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span className="font-mono text-xs text-lavender-muted tabular-nums">
          Đã lật {revealedCount} / {deck.length} thẻ
        </span>
        <button
          type="button"
          onClick={handleShuffleReset}
          className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neon-pink/35 bg-neon-pink/12 px-4 text-xs leading-normal font-medium text-starlight hover:border-neon-pink/65"
        >
          <Shuffle className="h-3.5 w-3.5 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
          <span>Trộn lại / Úp thẻ</span>
        </button>
      </div>
    </div>
  );
}
