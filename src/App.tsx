import { useEffect } from 'react';
import { ExperienceCanvas } from './canvas/ExperienceCanvas';
import { HudOverlay } from './components/ui/HudOverlay';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export default function App() {
  // Guard the immersive 3D experience against accidental right-click menus, drag-ghosting, text selection,
  // browser pinch/Ctrl-zoom, pull-to-refresh, and disruptive shortcuts while preserving legitimate inputs & modal controls.
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    const preventSelect = (e: Event) => {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    };

    const preventAuxMiddleScroll = (e: MouseEvent) => {
      // Prevent browser middle-click auto-scroll icon from hijacking the 3D scene
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
      }
    };

    const preventBrowserZoomWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventSafariGesture = (e: Event) => {
      e.preventDefault();
    };

    const preventDisruptiveKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const editable = isEditableTarget(e.target);

      // Block DevTools / View Source / Save / Print / Browser Page Zoom shortcuts that disrupt the 3D viewport
      if (
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrlOrMeta && (key === 'u' || key === 's' || key === 'p' || key === '+' || key === '-' || key === '=' || key === '0')) ||
        (ctrlOrMeta && !editable && key === 'a')
      ) {
        e.preventDefault();
        return;
      }

      // Prevent stray PageUp / PageDown from shifting scroll outside modal scroll containers
      if (!editable && (e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', preventContextMenu, { capture: true });
    window.addEventListener('dragstart', preventDrag, { capture: true });
    document.addEventListener('selectstart', preventSelect, { capture: true });
    window.addEventListener('mousedown', preventAuxMiddleScroll, { capture: true });
    window.addEventListener('wheel', preventBrowserZoomWheel, { passive: false });
    window.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    window.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    window.addEventListener('keydown', preventDisruptiveKeys, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', preventContextMenu, { capture: true });
      window.removeEventListener('dragstart', preventDrag, { capture: true });
      document.removeEventListener('selectstart', preventSelect, { capture: true });
      window.removeEventListener('mousedown', preventAuxMiddleScroll, { capture: true });
      window.removeEventListener('wheel', preventBrowserZoomWheel);
      window.removeEventListener('gesturestart', preventSafariGesture);
      window.removeEventListener('gesturechange', preventSafariGesture);
      window.removeEventListener('keydown', preventDisruptiveKeys, { capture: true });
    };
  }, []);

  return (
    <main className="relative h-full w-full overflow-hidden bg-void">
      <ExperienceCanvas />
      <HudOverlay />
    </main>
  );
}
