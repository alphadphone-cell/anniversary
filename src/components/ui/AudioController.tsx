import { useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore, useIsMuted } from '../../store/useAppStore';
import { syncAudioMuted } from '../../audio/audioEngine';

export function AudioController() {
  const isMuted = useIsMuted();
  const setMuted = useAppStore((s) => s.setMuted);

  const handleToggle = useCallback(() => {
    const nextMuted = !isMuted;
    setMuted(nextMuted);
    syncAudioMuted(nextMuted);
  }, [isMuted, setMuted]);

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileTap={{ scale: 0.94 }}
      aria-label={isMuted ? 'Unmute ambient audio' : 'Mute ambient audio'}
      aria-pressed={!isMuted}
      className={`glass-surface glass-interactive flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium ${
        isMuted ? 'text-lavender' : 'glass-active text-starlight'
      }`}
    >
      {isMuted ? (
        <VolumeX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4 shrink-0 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{isMuted ? 'Sound Off' : 'Sound On'}</span>
    </motion.button>
  );
}
