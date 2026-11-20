import { Sparkles, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';
import { sfxEngine } from '../../../utils/sfxEngine';

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

      {/* Secret Supernova Keepsake Artwork */}
      <div className="relative mt-5 w-full overflow-hidden rounded-2xl border border-neon-pink/35 bg-void/85 p-2 shadow-[0_18px_42px_-16px_rgba(255,62,165,0.45)]">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10">
          <img
            src={secret.imageUrl}
            alt="Siêu tân tinh trái tim bí mật của tụi mình"
            className="h-full w-full object-cover"
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

      {/* Keepsake Promise Strip & Replay Ethereal Chime */}
      <div className="mt-4 flex w-full flex-col items-center justify-between gap-3 rounded-2xl border border-neon-magenta/30 bg-neon-magenta/10 px-4 py-3 sm:flex-row sm:text-left">
        <span className="text-xs leading-relaxed font-medium text-starlight">
          {secret.promiseLabel}
        </span>
        <button
          type="button"
          onClick={() => sfxEngine.playSupernovaBurst()}
          className="glass-interactive inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-neon-pink/40 bg-neon-pink/15 px-4 text-xs leading-normal font-medium text-starlight hover:border-neon-pink/75"
        >
          <Volume2 className="h-3.5 w-3.5 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
          <span>Nghe Lại Chuông Sao</span>
        </button>
      </div>
    </div>
  );
}
