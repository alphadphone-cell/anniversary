import { create } from 'zustand';
import { ANNIVERSARY_DATA } from '../data/anniversaryData';

export type AppStage = 'intro' | 'warp' | 'galaxy';
export type ViewMode = 'galaxy' | 'constellation';
export type ModalId = 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery' | 'secret' | null;

interface AppState {
  stage: AppStage;
  viewMode: ViewMode;
  activeModal: ModalId;
  selectedMilestoneId: string | null;
  maxUnlockedMilestoneIndex: number;
  constellationFinaleActive: boolean;
  isMuted: boolean;
  isMusicPlaying: boolean;
  currentTrackIndex: number;
  isSupernovaTrackActive: boolean;
  isTransitionFlashing: boolean;
  supernovaFlashKey: number;
  setStage: (stage: AppStage) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setActiveModal: (modal: ModalId) => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
  toggleModal: (modal: Exclude<ModalId, null>) => void;
  setSelectedMilestoneId: (id: string | null) => void;
  startConstellationFinale: () => void;
  endConstellationFinale: () => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setIsMusicPlaying: (playing: boolean) => void;
  setCurrentTrackIndex: (index: number) => void;
  setSupernovaTrackActive: (active: boolean) => void;
  setTransitionFlashing: (flashing: boolean) => void;
  triggerSupernovaFlash: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  stage: 'intro',
  viewMode: 'galaxy',
  activeModal: null,
  selectedMilestoneId: null,
  maxUnlockedMilestoneIndex: 0,
  constellationFinaleActive: false,
  isMuted: false,
  isMusicPlaying: false,
  currentTrackIndex: 0,
  isSupernovaTrackActive: false,
  isTransitionFlashing: false,
  supernovaFlashKey: 0,

  setStage: (stage) => set({ stage }),

  setViewMode: (viewMode) =>
    set((state) => ({
      viewMode,
      activeModal: viewMode === 'constellation' ? null : state.activeModal,
      selectedMilestoneId: null,
      constellationFinaleActive: false,
      maxUnlockedMilestoneIndex: viewMode === 'constellation' ? 0 : state.maxUnlockedMilestoneIndex,
    })),

  toggleViewMode: () =>
    set((state) => {
      const next: ViewMode = state.viewMode === 'galaxy' ? 'constellation' : 'galaxy';
      return {
        viewMode: next,
        activeModal: next === 'constellation' ? null : state.activeModal,
        selectedMilestoneId: null,
        constellationFinaleActive: false,
        maxUnlockedMilestoneIndex: next === 'constellation' ? 0 : state.maxUnlockedMilestoneIndex,
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

  setSelectedMilestoneId: (selectedMilestoneId) =>
    set((state) => {
      if (!selectedMilestoneId) {
        return { selectedMilestoneId: null };
      }
      const idx = ANNIVERSARY_DATA.constellationMilestones.findIndex(
        (m) => m.id === selectedMilestoneId
      );
      return {
        selectedMilestoneId,
        constellationFinaleActive: false,
        maxUnlockedMilestoneIndex:
          idx >= 0
            ? Math.max(state.maxUnlockedMilestoneIndex, idx)
            : state.maxUnlockedMilestoneIndex,
      };
    }),

  startConstellationFinale: () =>
    set({
      selectedMilestoneId: null,
      constellationFinaleActive: true,
      maxUnlockedMilestoneIndex: Math.max(0, ANNIVERSARY_DATA.constellationMilestones.length - 1),
    }),

  endConstellationFinale: () =>
    set((state) => ({
      viewMode: 'galaxy',
      selectedMilestoneId: null,
      constellationFinaleActive: false,
      activeModal: state.activeModal,
    })),

  setMuted: (isMuted) => set({ isMuted }),

  toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),

  setIsMusicPlaying: (isMusicPlaying) => set({ isMusicPlaying }),

  setCurrentTrackIndex: (currentTrackIndex) => set({ currentTrackIndex }),

  setSupernovaTrackActive: (isSupernovaTrackActive) => set({ isSupernovaTrackActive }),

  setTransitionFlashing: (isTransitionFlashing) => set({ isTransitionFlashing }),
  triggerSupernovaFlash: () => set((state) => ({ supernovaFlashKey: state.supernovaFlashKey + 1 })),
}));

/** Atomic selector hooks so UI updates never trigger unnecessary WebGL Canvas re-renders. */
export const useStage = () => useAppStore((s) => s.stage);
export const useViewMode = () => useAppStore((s) => s.viewMode);
export const useActiveModal = () => useAppStore((s) => s.activeModal);
export const useSelectedMilestoneId = () => useAppStore((s) => s.selectedMilestoneId);
export const useMaxUnlockedMilestoneIndex = () => useAppStore((s) => s.maxUnlockedMilestoneIndex);
export const useConstellationFinaleActive = () => useAppStore((s) => s.constellationFinaleActive);
export const useIsMuted = () => useAppStore((s) => s.isMuted);
export const useIsMusicPlaying = () => useAppStore((s) => s.isMusicPlaying);
export const useCurrentTrackIndex = () => useAppStore((s) => s.currentTrackIndex);
export const useIsSupernovaTrackActive = () => useAppStore((s) => s.isSupernovaTrackActive);
export const useIsTransitionFlashing = () => useAppStore((s) => s.isTransitionFlashing);
export const useSupernovaFlashKey = () => useAppStore((s) => s.supernovaFlashKey);
