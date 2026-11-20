import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useActiveModal, useAppStore, type ModalId } from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';
import { LetterModal } from './modals/LetterModal';
import { CounterModal } from './modals/CounterModal';
import { CardsModal } from './modals/CardsModal';
import { PuzzleModal } from './modals/PuzzleModal';
import { GalleryModal } from './modals/GalleryModal';
import { SecretModal } from './modals/SecretModal';

function ModalContent({ modal }: { modal: Exclude<ModalId, null> }) {
  switch (modal) {
    case 'letter':
      return <LetterModal />;
    case 'counter':
      return <CounterModal />;
    case 'cards':
      return <CardsModal />;
    case 'puzzle':
      return <PuzzleModal />;
    case 'gallery':
      return <GalleryModal />;
    case 'secret':
      return <SecretModal />;
  }
}

export function ModalShell() {
  const activeModal = useActiveModal();
  const closeModalStore = useAppStore((s) => s.closeModal);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    sfxEngine.playModalClose();
    closeModalStore();
  }, [closeModalStore]);

  useEffect(() => {
    if (!activeModal) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, handleClose]);

  const widthClass = activeModal === 'cards' ? 'max-w-3xl' : 'max-w-xl';
  const isSecret = activeModal === 'secret';

  return (
    <AnimatePresence>
      {activeModal && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isSecret ? 0.48 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleClose}
          className={`pointer-events-auto fixed inset-0 z-20 flex items-center justify-center px-3 py-5 sm:px-6 ${
            isSecret ? 'bg-void/42 backdrop-blur-[5px]' : 'bg-void/72 backdrop-blur-md'
          }`}
        >
          <motion.section
            key={activeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="anni-modal-title"
            initial={
              isSecret ? { opacity: 0, y: 12, scale: 0.92 } : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: isSecret ? 0.56 : 0.26, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className={`glass-modal cosmic-scroll relative max-h-[88vh] w-full overflow-y-auto rounded-[28px] px-5 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-7 ${widthClass} ${
              isSecret
                ? '!border-amber-200/45 shadow-[0_0_54px_-10px_rgba(255,95,180,0.52),0_0_30px_-8px_rgba(253,224,71,0.34)]'
                : ''
            }`}
          >
            <ModalContent modal={activeModal} />

            {/* Signature Centered ĐÓNG x Pill */}
            <div className="mt-6 flex justify-center">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                aria-label="Đóng hộp thoại"
                className="glass-interactive inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.04] px-6 font-sans text-xs leading-normal font-semibold tracking-[0.16em] text-starlight uppercase hover:border-neon-pink/65"
              >
                <span>ĐÓNG</span>
                <X className="h-3.5 w-3.5 text-neon-pink" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
