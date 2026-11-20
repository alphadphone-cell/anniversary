import { create } from 'zustand';

export type AppStage = 'intro' | 'warp' | 'galaxy';
export type ViewMode = 'galaxy' | 'constellation';
export type ModalId = 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery' | 'secret' | null;

interface AppState {
  stage: AppStage;
  viewMode: ViewMode;
  activeModal: ModalId;
  selectedMilestoneId: string | null;
  isMuted: boolean;
  isTransitionFlashing: boolean;
  setStage: (stage: AppStage) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setActiveModal: (modal: ModalId) => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
  toggleModal: (modal: Exclude<ModalId, null>) => void;
  setSelectedMilestoneId: (id: string | null) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setTransitionFlashing: (flashing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  stage: 'intro',
  viewMode: 'galaxy',
  activeModal: null,
  selectedMilestoneId: null,
  isMuted: false,
  isTransitionFlashing: false,

  setStage: (stage) => set({ stage }),

  setViewMode: (viewMode) =>
    set({
      viewMode,
      activeModal: viewMode === 'constellation' ? null : undefined,
      selectedMilestoneId: viewMode === 'galaxy' ? null : undefined,
    }),

  toggleViewMode: () =>
    set((state) => {
      const next: ViewMode = state.viewMode === 'galaxy' ? 'constellation' : 'galaxy';
      return {
        viewMode: next,
        activeModal: next === 'constellation' ? null : state.activeModal,
        selectedMilestoneId: next === 'galaxy' ? null : state.selectedMilestoneId,
      };
    }),

  setActiveModal: (activeModal) =>
    set({
      activeModal,
      ...(activeModal ? { selectedMilestoneId: null } : {}),
    }),

  openModal: (modal) => set({ activeModal: modal, selectedMilestoneId: null }),

  closeModal: () => set({ activeModal: null }),

  toggleModal: (modal) =>
    set((state) => ({
      activeModal: state.activeModal === modal ? null : modal,
      selectedMilestoneId: null,
    })),

  setSelectedMilestoneId: (selectedMilestoneId) => set({ selectedMilestoneId }),

  setMuted: (isMuted) => set({ isMuted }),

  toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),

  setTransitionFlashing: (isTransitionFlashing) => set({ isTransitionFlashing }),
}));

/** Atomic selector hooks so UI updates never trigger unnecessary WebGL Canvas re-renders. */
export const useStage = () => useAppStore((s) => s.stage);
export const useViewMode = () => useAppStore((s) => s.viewMode);
export const useActiveModal = () => useAppStore((s) => s.activeModal);
export const useSelectedMilestoneId = () => useAppStore((s) => s.selectedMilestoneId);
export const useIsMuted = () => useAppStore((s) => s.isMuted);
export const useIsTransitionFlashing = () => useAppStore((s) => s.isTransitionFlashing);
