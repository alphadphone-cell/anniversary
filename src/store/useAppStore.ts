import { create } from 'zustand';

export type AppStage = 'intro' | 'warp' | 'galaxy';
export type ModalId = 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery' | 'secret' | null;

interface AppState {
  stage: AppStage;
  activeModal: ModalId;
  isMuted: boolean;
  isTransitionFlashing: boolean;
  setStage: (stage: AppStage) => void;
  setActiveModal: (modal: ModalId) => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
  toggleModal: (modal: Exclude<ModalId, null>) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setTransitionFlashing: (flashing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  stage: 'intro',
  activeModal: null,
  isMuted: false,
  isTransitionFlashing: false,

  setStage: (stage) => set({ stage }),

  setActiveModal: (activeModal) => set({ activeModal }),

  openModal: (modal) => set({ activeModal: modal }),

  closeModal: () => set({ activeModal: null }),

  toggleModal: (modal) =>
    set((state) => ({
      activeModal: state.activeModal === modal ? null : modal,
    })),

  setMuted: (isMuted) => set({ isMuted }),

  toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),

  setTransitionFlashing: (isTransitionFlashing) => set({ isTransitionFlashing }),
}));

/** Atomic selector hooks so UI updates never trigger WebGL Canvas re-renders. */
export const useStage = () => useAppStore((s) => s.stage);
export const useActiveModal = () => useAppStore((s) => s.activeModal);
export const useIsMuted = () => useAppStore((s) => s.isMuted);
export const useIsTransitionFlashing = () => useAppStore((s) => s.isTransitionFlashing);
