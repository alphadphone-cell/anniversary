import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

export function LetterModal() {
  const fullBlocks = useMemo(
    () => [
      ANNIVERSARY_DATA.letter.salutation,
      ...ANNIVERSARY_DATA.letter.paragraphs,
      `— ${ANNIVERSARY_DATA.letter.signature}`,
    ],
    []
  );

  const fullText = useMemo(() => fullBlocks.join('\n\n'), [fullBlocks]);

  const [visibleChars, setVisibleChars] = useState<number>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return fullText.length;
    }
    return 0;
  });

  useEffect(() => {
    if (visibleChars >= fullText.length) return;

    const timer = window.setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= fullText.length) {
          window.clearInterval(timer);
          return fullText.length;
        }
        return prev + 2;
      });
    }, 24);

    return () => window.clearInterval(timer);
  }, [fullText.length, visibleChars >= fullText.length]);

  const isTyping = visibleChars < fullText.length;
  const typedSlice = fullText.slice(0, visibleChars);
  const renderedBlocks = typedSlice.split('\n\n');

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated glowing envelope + heart header icon */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-pink/35 bg-neon-pink/12 shadow-[0_0_28px_-6px_rgba(255,62,165,0.55)]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="h-10 w-10 overflow-visible">
          <rect
            x="8"
            y="18"
            width="48"
            height="34"
            rx="6"
            fill="rgba(255, 62, 165, 0.16)"
            stroke="#f9a8d4"
            strokeWidth="2.4"
          />
          <path
            d="M10 21 L32 37 L54 21"
            fill="none"
            stroke="#f9a8d4"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <motion.path
            d="M32 28 C30.8 26.8 23 21.5 23 16.5 C23 13.4 25.4 11 28.4 11 C30.2 11 31.4 12 32 13.4 C32.6 12 33.8 11 35.6 11 C38.6 11 41 13.4 41 16.5 C41 21.5 33.2 26.8 32 28 Z"
            fill="#ff3ea5"
            animate={{ scale: [1, 1.14, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '32px 19px', filter: 'drop-shadow(0 0 8px #ff3ea5)' }}
          />
        </svg>
      </motion.div>

      <h2
        id="anni-modal-title"
        className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
      >
        {ANNIVERSARY_DATA.letter.headline}
      </h2>
      <p className="mt-1.5 text-xs text-lavender-muted tabular-nums">
        {ANNIVERSARY_DATA.letter.dateLabel}
      </p>

      {/* Typewriter letter body */}
      <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5 text-left sm:px-7 sm:py-6">
        <div className="min-h-[190px] space-y-4 text-sm leading-relaxed text-lavender sm:text-base">
          {renderedBlocks.map((block, index) => {
            const isSalutation = index === 0;
            const isSignature = index === fullBlocks.length - 1;
            const isLastRendered = index === renderedBlocks.length - 1;

            return (
              <p
                key={index}
                className={
                  isSalutation
                    ? 'font-display text-xl italic text-starlight sm:text-2xl'
                    : isSignature
                      ? 'pt-2 font-display text-xl text-starlight'
                      : 'text-lavender'
                }
              >
                {block}
                {isTyping && isLastRendered && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-neon-pink align-middle"
                  />
                )}
              </p>
            );
          })}
        </div>

        {isTyping && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setVisibleChars(fullText.length)}
              className="glass-interactive min-h-11 cursor-pointer rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs leading-normal font-medium text-lavender hover:text-starlight"
            >
              Hiện toàn bộ thư
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
