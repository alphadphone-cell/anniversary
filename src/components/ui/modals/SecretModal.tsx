import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

export function SecretModal() {
  const secret = ANNIVERSARY_DATA.secretSupernova;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Radiant Supernova Crest */}
      <motion.div
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-pink/45 bg-neon-pink/15 text-neon-pink shadow-[0_0_32px_-4px_rgba(255,62,165,0.68)]"
        aria-hidden="true"
      >
        <Sparkles className="h-6 w-6" strokeWidth={1.75} />
      </motion.div>

      <h2
        id="anni-modal-title"
        className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
      >
        {secret.headline}
      </h2>
      <p className="mt-1.5 text-xs leading-normal text-lavender-muted">{secret.subtitle}</p>

      {/* Secret Supernova Keepsake Artwork (portrait-safe ambient blur backdrop) */}
      <div className="relative mt-5 w-full overflow-hidden rounded-2xl border border-neon-pink/35 bg-void/85 p-2 shadow-[0_18px_42px_-16px_rgba(255,62,165,0.45)]">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10 bg-void/80">
          {secret.aspect === 'portrait' && (
            <img
              src={secret.imageUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full scale-115 object-cover opacity-55 blur-2xl brightness-75"
            />
          )}
          <img
            src={secret.imageUrl}
            alt="Tấm ảnh đặc biệt nhất của AD và Tlinh"
            className={
              secret.aspect === 'portrait'
                ? 'relative z-10 mx-auto h-full w-full object-contain drop-shadow-[0_14px_30px_rgba(5,2,12,0.8)]'
                : 'relative z-10 h-full w-full object-cover'
            }
          />
        </div>
      </div>

      {/* Secret Transmission Copy */}
      <div className="mt-5 w-full space-y-3.5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5 text-left text-sm leading-relaxed text-lavender sm:px-6 sm:text-base">
        {secret.paragraphs.map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}
        <p className="pt-1 font-display text-xl italic text-starlight">— {secret.signature}</p>
      </div>
    </div>
  );
}
