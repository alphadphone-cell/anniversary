import { create } from 'zustand';
import { ANNIVERSARY_DATA, type GalaxyNodeId } from '../data/anniversaryData';
import { galaxySignals } from '../canvas/galaxySignals';

export type AppStage = 'setup' | 'intro' | 'warp' | 'galaxy';
export type ViewMode = 'galaxy' | 'constellation';
export type ModalId = 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery' | 'secret' | null;

export const JOURNEY_STEPS = [
  'letter',
  'counter',
  'cards',
  'puzzle',
  'gallery',
  'constellation',
] as const;

export type JourneyStepId = (typeof JOURNEY_STEPS)[number];

const CORE_MODAL_STEPS: ReadonlySet<string> = new Set([
  'letter',
  'counter',
  'cards',
  'puzzle',
  'gallery',
]);

// Clear any legacy sessionStorage journey key on page load so every F5 refresh starts fresh at 0/6
if (typeof window !== 'undefined') {
  try {
    window.sessionStorage.removeItem('anni_journey_completed_v1');
  } catch {
    // Ignore restricted storage contexts
  }
}

function appendCompletedStep(
  current: JourneyStepId[],
  step: JourneyStepId
): JourneyStepId[] {
  if (current.includes(step)) return current;
  return [...current, step];
}

/** Returns the first unvisited step in the guided journey, or null when all 6/6 are completed. */
export function getNextJourneyStep(completedSteps: readonly JourneyStepId[]): JourneyStepId | null {
  for (const step of JOURNEY_STEPS) {
    if (!completedSteps.includes(step)) return step;
  }
  return null;
}

export function isAllCoreJourneyCompleted(completedSteps: readonly JourneyStepId[]): boolean {
  return completedSteps.length >= JOURNEY_STEPS.length;
}

interface AppState {
  stage: AppStage;
  viewMode: ViewMode;
  activeModal: ModalId;
  focusingNodeId: GalaxyNodeId | null;
  selectedMilestoneId: string | null;
  maxUnlockedMilestoneIndex: number;
  constellationFinaleActive: boolean;
  completedSteps: JourneyStepId[];
  supernovaCompleted: boolean;
  guidePillDismissed: boolean;
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
  openFeatureWithCameraFly: (nodeId: JourneyStepId) => boolean;
  completeNodeFocus: () => void;
  cancelNodeFocus: () => void;
  closeModal: () => void;
  toggleModal: (modal: Exclude<ModalId, null>) => void;
  setSelectedMilestoneId: (id: string | null) => void;
  startConstellationFinale: () => void;
  endConstellationFinale: () => void;
  markStepCompleted: (step: JourneyStepId) => void;
  markSupernovaCompleted: () => void;
  setGuidePillDismissed: (dismissed: boolean) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setIsMusicPlaying: (playing: boolean) => void;
  setCurrentTrackIndex: (index: number) => void;
  setSupernovaTrackActive: (active: boolean) => void;
  setTransitionFlashing: (flashing: boolean) => void;
  triggerSupernovaFlash: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  stage: 'setup',
  viewMode: 'galaxy',
  activeModal: null,
  focusingNodeId: null,
  selectedMilestoneId: null,
  maxUnlockedMilestoneIndex: 0,
  constellationFinaleActive: false,
  completedSteps: [],
  supernovaCompleted: false,
  guidePillDismissed: false,
  isMuted: false,
  isMusicPlaying: false,
  currentTrackIndex: 0,
  isSupernovaTrackActive: false,
  isTransitionFlashing: false,
  supernovaFlashKey: 0,

  setStage: (stage) => {
    galaxySignals.focusingNodeId = null;
    galaxySignals.nodeFocusStartMs = 0;
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    set({ stage, focusingNodeId: null });
  },

  setViewMode: (viewMode) => {
    galaxySignals.focusingNodeId = null;
    galaxySignals.nodeFocusStartMs = 0;
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    set((state) => ({
      viewMode,
      focusingNodeId: null,
      activeModal: viewMode === 'constellation' ? null : state.activeModal,
      selectedMilestoneId: null,
      constellationFinaleActive: false,
      maxUnlockedMilestoneIndex: viewMode === 'constellation' ? 0 : state.maxUnlockedMilestoneIndex,
    }));
  },

  toggleViewMode: () => {
    galaxySignals.focusingNodeId = null;
    galaxySignals.nodeFocusStartMs = 0;
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    set((state) => {
      const next: ViewMode = state.viewMode === 'galaxy' ? 'constellation' : 'galaxy';
      return {
        viewMode: next,
        focusingNodeId: null,
        activeModal: next === 'constellation' ? null : state.activeModal,
        selectedMilestoneId: null,
        constellationFinaleActive: false,
        maxUnlockedMilestoneIndex: next === 'constellation' ? 0 : state.maxUnlockedMilestoneIndex,
      };
    });
  },

  setActiveModal: (activeModal) =>
    set((state) => {
      let nextCompleted = state.completedSteps;
      let nextSupernovaDone = state.supernovaCompleted;
      let nextDismissed = state.guidePillDismissed;

      if (activeModal === null && state.activeModal) {
        if (CORE_MODAL_STEPS.has(state.activeModal)) {
          const prevLen = nextCompleted.length;
          nextCompleted = appendCompletedStep(nextCompleted, state.activeModal as JourneyStepId);
          if (prevLen < JOURNEY_STEPS.length && nextCompleted.length >= JOURNEY_STEPS.length) {
            nextDismissed = false;
          }
        } else if (state.activeModal === 'secret') {
          nextSupernovaDone = true;
          nextDismissed = false;
        }
      }

      return {
        activeModal,
        completedSteps: nextCompleted,
        supernovaCompleted: nextSupernovaDone,
        guidePillDismissed: nextDismissed,
        ...(activeModal ? { selectedMilestoneId: null } : {}),
      };
    }),

  openModal: (modal) => set({ activeModal: modal, focusingNodeId: null, selectedMilestoneId: null }),

  openFeatureWithCameraFly: (nodeId) => {
    const state = get();
    if (
      state.stage !== 'galaxy' ||
      state.focusingNodeId !== null ||
      state.activeModal !== null ||
      galaxySignals.isHoldingHeart
    ) {
      return false;
    }

    if (nodeId === 'constellation') {
      if (state.viewMode === 'constellation') return false;
      set({
        viewMode: 'constellation',
        focusingNodeId: null,
        activeModal: null,
        selectedMilestoneId: null,
        constellationFinaleActive: false,
        maxUnlockedMilestoneIndex: 0,
      });
      return true;
    }

    if (state.viewMode !== 'galaxy') return false;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      set({ activeModal: nodeId, focusingNodeId: null, selectedMilestoneId: null });
      return true;
    }

    galaxySignals.focusingNodeId = nodeId;
    galaxySignals.nodeFocusStartMs = performance.now();
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    set({ focusingNodeId: nodeId, selectedMilestoneId: null });
    return true;
  },

  completeNodeFocus: () =>
    set((state) => {
      if (!state.focusingNodeId) return state;
      return {
        activeModal: state.focusingNodeId,
        focusingNodeId: null,
        selectedMilestoneId: null,
      };
    }),

  cancelNodeFocus: () => {
    galaxySignals.focusingNodeId = null;
    galaxySignals.nodeFocusStartMs = 0;
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    set({ focusingNodeId: null });
  },

  closeModal: () =>
    set((state) => {
      let nextCompleted = state.completedSteps;
      let nextSupernovaDone = state.supernovaCompleted;
      let nextDismissed = state.guidePillDismissed;

      if (state.activeModal && CORE_MODAL_STEPS.has(state.activeModal)) {
        const prevLen = nextCompleted.length;
        nextCompleted = appendCompletedStep(nextCompleted, state.activeModal as JourneyStepId);
        if (prevLen < JOURNEY_STEPS.length && nextCompleted.length >= JOURNEY_STEPS.length) {
          nextDismissed = false;
        }
      } else if (state.activeModal === 'secret') {
        nextSupernovaDone = true;
        nextDismissed = false;
      }

      return {
        activeModal: null,
        focusingNodeId: null,
        completedSteps: nextCompleted,
        supernovaCompleted: nextSupernovaDone,
        guidePillDismissed: nextDismissed,
      };
    }),

  toggleModal: (modal) =>
    set((state) => {
      const closing = state.activeModal === modal;
      let nextCompleted = state.completedSteps;
      let nextSupernovaDone = state.supernovaCompleted;
      let nextDismissed = state.guidePillDismissed;

      if (closing) {
        if (CORE_MODAL_STEPS.has(modal)) {
          const prevLen = nextCompleted.length;
          nextCompleted = appendCompletedStep(nextCompleted, modal as JourneyStepId);
          if (prevLen < JOURNEY_STEPS.length && nextCompleted.length >= JOURNEY_STEPS.length) {
            nextDismissed = false;
          }
        } else if (modal === 'secret') {
          nextSupernovaDone = true;
          nextDismissed = false;
        }
      }

      return {
        activeModal: closing ? null : modal,
        selectedMilestoneId: null,
        completedSteps: nextCompleted,
        supernovaCompleted: nextSupernovaDone,
        guidePillDismissed: nextDismissed,
      };
    }),

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
    set((state) => {
      const prevLen = state.completedSteps.length;
      const nextCompleted = appendCompletedStep(state.completedSteps, 'constellation');
      const justUnlockedAll =
        prevLen < JOURNEY_STEPS.length && nextCompleted.length >= JOURNEY_STEPS.length;
      return {
        viewMode: 'galaxy',
        selectedMilestoneId: null,
        constellationFinaleActive: false,
        activeModal: state.activeModal,
        completedSteps: nextCompleted,
        guidePillDismissed: justUnlockedAll ? false : state.guidePillDismissed,
      };
    }),

  markStepCompleted: (step) =>
    set((state) => {
      const prevLen = state.completedSteps.length;
      const nextCompleted = appendCompletedStep(state.completedSteps, step);
      const justUnlockedAll =
        prevLen < JOURNEY_STEPS.length && nextCompleted.length >= JOURNEY_STEPS.length;
      return {
        completedSteps: nextCompleted,
        guidePillDismissed: justUnlockedAll ? false : state.guidePillDismissed,
      };
    }),

  markSupernovaCompleted: () => set({ supernovaCompleted: true, guidePillDismissed: false }),

  setGuidePillDismissed: (guidePillDismissed) => set({ guidePillDismissed }),

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
export const useFocusingNodeId = () => useAppStore((s) => s.focusingNodeId);
export const useSelectedMilestoneId = () => useAppStore((s) => s.selectedMilestoneId);
export const useMaxUnlockedMilestoneIndex = () => useAppStore((s) => s.maxUnlockedMilestoneIndex);
export const useConstellationFinaleActive = () => useAppStore((s) => s.constellationFinaleActive);
export const useCompletedSteps = () => useAppStore((s) => s.completedSteps);
export const useSupernovaCompleted = () => useAppStore((s) => s.supernovaCompleted);
export const useGuidePillDismissed = () => useAppStore((s) => s.guidePillDismissed);
export const useIsMuted = () => useAppStore((s) => s.isMuted);
export const useIsMusicPlaying = () => useAppStore((s) => s.isMusicPlaying);
export const useCurrentTrackIndex = () => useAppStore((s) => s.currentTrackIndex);
export const useIsSupernovaTrackActive = () => useAppStore((s) => s.isSupernovaTrackActive);
export const useIsTransitionFlashing = () => useAppStore((s) => s.isTransitionFlashing);
export const useSupernovaFlashKey = () => useAppStore((s) => s.supernovaFlashKey);
