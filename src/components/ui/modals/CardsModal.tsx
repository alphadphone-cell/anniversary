import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, Lock, Shuffle, Sparkles } from 'lucide-react';
import { ANNIVERSARY_DATA, type LoveCardItem } from '../../../data/anniversaryData';
import { useAppStore, usePickedCardId } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

function shuffleDeck(items: LoveCardItem[]): LoveCardItem[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ACCENT_RING: Record<LoveCardItem['accent'], string> = {
  pink: 'border-neon-pink/70 shadow-[0_14px_34px_-10px_rgba(255,62,165,0.58)]',
  magenta: 'border-neon-magenta/70 shadow-[0_14px_34px_-10px_rgba(217,70,239,0.58)]',
  violet: 'border-neon-violet/70 shadow-[0_14px_34px_-10px_rgba(139,92,246,0.58)]',
};

function fireCardConfetti(timerIdsRef: React.MutableRefObject<number[]>) {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const colors = ['#ff3ea5', '#d946ef', '#a855f7', '#fbcfe8', '#fde047', '#fff5fb'];
  let shapes: confetti.Shape[] | undefined;
  try {
    if (typeof confetti.shapeFromPath === 'function') {
      shapes = [
        confetti.shapeFromPath({
          path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
        }),
      ];
    }
  } catch {
    shapes = undefined;
  }

  const id = window.setTimeout(() => {
    void confetti({
      particleCount: 36,
      spread: 84,
      startVelocity: 34,
      gravity: 0.78,
      scalar: 1.4,
      ticks: 185,
      origin: { x: 0.5, y: 0.52 },
      colors,
      ...(shapes ? { shapes } : {}),
    });
  }, 180);
  timerIdsRef.current.push(id);
}

export function CardsModal() {
  const [deck, setDeck] = useState<LoveCardItem[]>(() => ANNIVERSARY_DATA.cards.slice(0, 5));
  const pickedCardId = usePickedCardId();
  const pickGiftCard = useAppStore((s) => s.pickGiftCard);
  const timerIdsRef = useRef<number[]>([]);

  const hasPicked = pickedCardId !== null;
  const pickedCard = hasPicked ? deck.find((c) => c.id === pickedCardId) ?? null : null;

  useEffect(() => {
    return () => {
      timerIdsRef.current.forEach((id) => window.clearTimeout(id));
      timerIdsRef.current = [];
      confetti.reset();
    };
  }, []);

  const handlePickCard = useCallback(
    (id: string) => {
      // Strictly one-card draw: once flipped, all other cards lock and the draw finishes
      if (useAppStore.getState().pickedCardId !== null) return;
      pickGiftCard(id);
      sfxEngine.playFinaleUnlockChime();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
      fireCardConfetti(timerIdsRef);
    },
    [pickGiftCard]
  );

  const handleShuffleBeforePick = useCallback(() => {
    if (useAppStore.getState().pickedCardId !== null) return;
    sfxEngine.playStarSelect();
    setDeck((prev) => shuffleDeck(prev));
  }, []);

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
          Thẻ Quà &amp; Điều Ước Cho Em
        </h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-lavender">
        {hasPicked
          ? 'Em chọn trúng món quà này rồi nè — anh giữ trọn lời hứa đó nha ♥'
          : 'Em chỉ được chọn đúng 1 lá thẻ bí mật thôi nha, chạm nhẹ vào lá em thích nhất đi.'}
      </p>

      {/* 5 Face-Down 3D Flip Cards — Pick 1 then Finish */}
      <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
        {deck.map((card, index) => {
          const isPicked = pickedCardId === card.id;
          const isLockedOut = hasPicked && !isPicked;
          const spanLastOnMobile =
            index === deck.length - 1 ? 'col-span-2 mx-auto w-[48%] sm:col-span-1 sm:w-full' : '';

          return (
            <button
              key={card.id}
              type="button"
              data-card-id={card.id}
              data-card-state={isPicked ? 'picked' : isLockedOut ? 'locked' : 'ready'}
              disabled={hasPicked}
              onClick={() => handlePickCard(card.id)}
              aria-pressed={isPicked}
              aria-label={
                isPicked
                  ? `Quà em đã chọn: ${card.title} — ${card.message}`
                  : isLockedOut
                    ? `Lá thẻ số ${index + 1} đã khóa vì em đã chọn quà rồi`
                    : `Chọn lá thẻ số ${index + 1} nha em`
              }
              className={`group relative h-60 text-left transition-all duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink sm:h-64 ${spanLastOnMobile} ${
                hasPicked
                  ? isPicked
                    ? 'z-10 scale-[1.03] cursor-default'
                    : 'scale-[0.96] cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:-translate-y-1'
              }`}
              style={{ perspective: '1000px' }}
            >
              <div
                className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isPicked ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Card Front (Face-Down Obsidian + Twin Glowing Hearts) */}
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-gradient-to-b from-[#170b2b] via-[#0e061d] to-[#130826] p-3 transition-colors duration-200 ${
                    isLockedOut
                      ? 'border-white/10'
                      : 'border-white/15 group-hover:border-neon-pink/55 group-hover:shadow-[0_12px_28px_-10px_rgba(255,62,165,0.42)]'
                  }`}
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <svg viewBox="0 0 84 84" className="h-14 w-14 overflow-visible" aria-hidden="true">
                    <path
                      d="M37 64 C35.5 62.6 14 48.5 14 34.5 C14 26.8 19.8 21.5 26.8 21.5 C31.2 21.5 34.8 23.6 37 27.2 C39.2 23.6 42.8 21.5 47.2 21.5 C54.2 21.5 60 26.8 60 34.5 C60 48.5 38.5 62.6 37 64 Z"
                      fill="#ff3ea5"
                      style={{ filter: 'drop-shadow(0 0 12px rgba(255, 62, 165, 0.78))' }}
                    />
                    <path
                      d="M57 36 C56 35 45 27.8 45 20.8 C45 16.8 48 14 51.6 14 C53.8 14 55.8 15.1 57 17 C58.2 15.1 60.2 14 62.4 14 C66 14 69 16.8 69 20.8 C69 27.8 58 35 57 36 Z"
                      fill="#ec4899"
                      style={{ filter: 'drop-shadow(0 0 10px rgba(236, 72, 153, 0.72))' }}
                    />
                  </svg>
                  <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.2em] text-lavender-muted tabular-nums">
                    {isLockedOut && <Lock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}
                    <span>0{index + 1}</span>
                  </span>
                </div>

                {/* Card Back (Revealed Romantic Coupon — Permanently Unlocked Winner) */}
                <div
                  className={`absolute inset-0 flex flex-col justify-between rounded-2xl border bg-gradient-to-b from-[#2b124d] via-[#1c0b36] to-[#120624] p-3.5 ${ACCENT_RING[card.accent]}`}
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
                  <span className="inline-flex items-center gap-1 text-[11px] leading-normal font-medium text-neon-pink">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span>Quà của em rồi nè</span>
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Status / Pre-Pick Shuffle Only */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {hasPicked && pickedCard ? (
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neon-pink/45 bg-neon-pink/12 px-4 py-2 text-xs leading-normal font-medium text-starlight">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
            <span>
              Đã chốt quà: <strong className="font-semibold text-pink-200">{pickedCard.title}</strong> · Lượt lật thẻ hoàn tất
            </span>
          </div>
        ) : (
          <>
            <span className="font-mono text-xs text-lavender-muted tabular-nums">
              Chọn 1 trong {deck.length} lá thẻ bí mật
            </span>
            <button
              type="button"
              onClick={handleShuffleBeforePick}
              className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neon-pink/35 bg-neon-pink/12 px-4 text-xs leading-normal font-medium text-starlight hover:border-neon-pink/65"
            >
              <Shuffle className="h-3.5 w-3.5 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
              <span>Xáo lại trước khi chọn nha</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
