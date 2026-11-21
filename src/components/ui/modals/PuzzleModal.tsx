import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Puzzle, RotateCcw, Sparkles } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';
import { sfxEngine } from '../../../utils/sfxEngine';

const GRID_SIZE = 3;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const SWIPE_THRESHOLD_PX = 24;

interface DragState {
  slotIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  targetSlot: number | null;
}

function countSolved(board: number[]): number {
  let correct = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === i) correct++;
  }
  return correct;
}

/** Creates an approachable shuffled 3x3 board guaranteed not to spawn already solved. */
function createInitialBoard(): number[] {
  const board = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  if (countSolved(board) >= TOTAL_TILES - 1) {
    [board[0], board[4]] = [board[4], board[0]];
    [board[2], board[8]] = [board[8], board[2]];
  }
  return board;
}

function resolveDropTarget(
  boardRect: DOMRect,
  originSlot: number,
  clientX: number,
  clientY: number,
  dx: number,
  dy: number
): number | null {
  // 1. Direct drag-and-drop onto any of the 9 cells inside the board
  if (
    clientX >= boardRect.left &&
    clientX <= boardRect.right &&
    clientY >= boardRect.top &&
    clientY <= boardRect.bottom
  ) {
    const relX = (clientX - boardRect.left) / Math.max(1, boardRect.width);
    const relY = (clientY - boardRect.top) / Math.max(1, boardRect.height);
    const col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(relX * GRID_SIZE)));
    const row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(relY * GRID_SIZE)));
    const hovered = row * GRID_SIZE + col;
    if (hovered !== originSlot) {
      return hovered;
    }
  }

  // 2. Quick directional swipe assist (flick >= 24px toward an adjacent neighbor)
  if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD_PX) {
    const originRow = Math.floor(originSlot / GRID_SIZE);
    const originCol = originSlot % GRID_SIZE;
    let nextRow = originRow;
    let nextCol = originCol;

    if (Math.abs(dx) >= Math.abs(dy)) {
      nextCol += dx > 0 ? 1 : -1;
    } else {
      nextRow += dy > 0 ? 1 : -1;
    }

    if (nextRow >= 0 && nextRow < GRID_SIZE && nextCol >= 0 && nextCol < GRID_SIZE) {
      return nextRow * GRID_SIZE + nextCol;
    }
  }

  return null;
}

function fireHeartConfetti(timerIdsRef: React.MutableRefObject<number[]>) {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const colors = ['#ff3ea5', '#d946ef', '#a855f7', '#38bdf8', '#fde047', '#fff5fb'];

  let shapes: confetti.Shape[] | undefined;
  try {
    if (typeof confetti.shapeFromPath === 'function') {
      const heartShape = confetti.shapeFromPath({
        path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
      });
      shapes = [heartShape];
    }
  } catch {
    shapes = undefined;
  }

  const burst = (originX: number, angle: number, count: number) => {
    void confetti({
      particleCount: count,
      angle,
      spread: 68,
      startVelocity: 42,
      gravity: 0.78,
      scalar: 1.55,
      ticks: 210,
      origin: { x: originX, y: 0.62 },
      colors,
      ...(shapes ? { shapes } : {}),
    });
  };

  burst(0.22, 62, 34);
  burst(0.78, 118, 34);

  const t1 = window.setTimeout(() => {
    void confetti({
      particleCount: 44,
      spread: 110,
      startVelocity: 36,
      gravity: 0.72,
      scalar: 1.7,
      origin: { x: 0.5, y: 0.45 },
      colors,
      ...(shapes ? { shapes } : {}),
    });
  }, 240);

  timerIdsRef.current.push(t1);
}

export function PuzzleModal() {
  const [board, setBoard] = useState<number[]>(() => createInitialBoard());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const celebratedRef = useRef(false);
  const timerIdsRef = useRef<number[]>([]);

  const solvedCount = countSolved(board);
  const isSolved = solvedCount === TOTAL_TILES;

  const swapTiles = useCallback((fromSlot: number, toSlot: number) => {
    if (fromSlot === toSlot) return;
    setBoard((prev) => {
      const next = [...prev];
      [next[fromSlot], next[toSlot]] = [next[toSlot], next[fromSlot]];
      return next;
    });
    sfxEngine.playStarSelect();
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  }, []);

  useEffect(() => {
    if (isSolved && !celebratedRef.current) {
      celebratedRef.current = true;
      dragRef.current = null;
      setDragState(null);
      sfxEngine.playFinaleUnlockChime();
      fireHeartConfetti(timerIdsRef);
    }
  }, [isSolved]);

  useEffect(() => {
    return () => {
      timerIdsRef.current.forEach((id) => window.clearTimeout(id));
      timerIdsRef.current = [];
      confetti.reset();
    };
  }, []);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setDragState(null);
  }, []);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const active = dragRef.current;
      if (!active) return;

      const rect = boardRef.current?.getBoundingClientRect();
      const dx = clientX - active.startX;
      const dy = clientY - active.startY;
      const finalTarget = rect
        ? resolveDropTarget(rect, active.slotIndex, clientX, clientY, dx, dy)
        : active.targetSlot;

      clearDrag();

      if (!isSolved && finalTarget !== null && finalTarget !== active.slotIndex) {
        swapTiles(active.slotIndex, finalTarget);
      }
    },
    [clearDrag, isSolved, swapTiles]
  );

  // Global window pointer listeners during active drag ensure zero dropped events on fast drags / mobile Safari
  useEffect(() => {
    if (!dragState) return;
    const activePointerId = dragState.pointerId;

    const onWindowMove = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== activePointerId) return;
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      const targetSlot = resolveDropTarget(rect, active.slotIndex, event.clientX, event.clientY, dx, dy);

      const updated: DragState = {
        ...active,
        dx,
        dy,
        targetSlot,
      };
      dragRef.current = updated;
      setDragState(updated);
    };

    const onWindowUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      finishDrag(event.clientX, event.clientY);
    };

    const onWindowCancel = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      clearDrag();
    };

    window.addEventListener('pointermove', onWindowMove, { passive: true });
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowCancel);
    window.addEventListener('blur', clearDrag);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowCancel);
      window.removeEventListener('blur', clearDrag);
    };
  }, [clearDrag, dragState?.pointerId, finishDrag]);

  const handleTilePointerDown = useCallback(
    (slotIndex: number, event: React.PointerEvent<HTMLButtonElement>) => {
      if (isSolved) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (dragRef.current !== null) return;

      event.preventDefault();
      const next: DragState = {
        slotIndex,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dx: 0,
        dy: 0,
        targetSlot: null,
      };
      dragRef.current = next;
      setDragState(next);
    },
    [isSolved]
  );

  // Keyboard arrow-key swap preserves full accessibility alongside pointer drag/swipe
  const handleTileKeyDown = useCallback(
    (slotIndex: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isSolved) return;
      const row = Math.floor(slotIndex / GRID_SIZE);
      const col = slotIndex % GRID_SIZE;
      let targetRow = row;
      let targetCol = col;

      if (event.key === 'ArrowLeft') targetCol -= 1;
      else if (event.key === 'ArrowRight') targetCol += 1;
      else if (event.key === 'ArrowUp') targetRow -= 1;
      else if (event.key === 'ArrowDown') targetRow += 1;
      else return;

      event.preventDefault();
      if (targetRow >= 0 && targetRow < GRID_SIZE && targetCol >= 0 && targetCol < GRID_SIZE) {
        swapTiles(slotIndex, targetRow * GRID_SIZE + targetCol);
      }
    },
    [isSolved, swapTiles]
  );

  const handleReset = useCallback(() => {
    celebratedRef.current = false;
    clearDrag();
    setBoard(createInitialBoard());
  }, [clearDrag]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon-pink/35 bg-neon-pink/15 text-neon-pink">
          <Puzzle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2
          id="anni-modal-title"
          className="font-display text-2xl leading-snug font-semibold text-starlight sm:text-3xl"
        >
          {ANNIVERSARY_DATA.puzzle.headline}
        </h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-lavender">
        Em giữ rồi kéo thả hoặc vuốt từng mảnh ảnh để đổi chỗ, ghép lại tấm hình của hai đứa nha.
      </p>

      {/* 3x3 Drag & Swipe Photo-Swap Grid */}
      <div
        ref={boardRef}
        className={`relative mt-4 grid aspect-square w-full max-w-[292px] touch-none select-none grid-cols-3 rounded-2xl border p-1.5 transition-all duration-300 ${
          isSolved
            ? 'gap-0 overflow-hidden border-neon-pink/70 shadow-[0_0_40px_-8px_rgba(255,62,165,0.65)]'
            : 'gap-2 overflow-visible border-neon-magenta/35 bg-void/80 shadow-[0_14px_38px_-14px_rgba(217,70,239,0.45)]'
        }`}
        role="grid"
        aria-label="Kéo thả hoặc vuốt mảnh ảnh để ghép lại tấm hình của hai đứa"
      >
        {board.map((pieceId, slotIndex) => {
          const pieceRow = Math.floor(pieceId / GRID_SIZE);
          const pieceCol = pieceId % GRID_SIZE;
          const isDragging = dragState?.slotIndex === slotIndex;
          const isDropTarget = dragState !== null && dragState.targetSlot === slotIndex;
          const isCorrect = pieceId === slotIndex;

          return (
            <button
              key={slotIndex}
              type="button"
              data-puzzle-slot={slotIndex}
              data-puzzle-piece={pieceId}
              data-puzzle-dragging={isDragging ? 'true' : 'false'}
              onPointerDown={(e) => handleTilePointerDown(slotIndex, e)}
              onKeyDown={(e) => handleTileKeyDown(slotIndex, e)}
              aria-label={`Ô số ${slotIndex + 1}, mảnh ${pieceId + 1}${isCorrect ? ', đúng chỗ rồi nè' : ''}. Kéo hoặc dùng phím mũi tên để đổi chỗ`}
              className={`relative aspect-square min-h-11 min-w-11 touch-none select-none overflow-hidden focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-neon-pink ${
                isSolved
                  ? 'cursor-default rounded-none'
                  : isDragging
                    ? 'z-30 cursor-grabbing rounded-lg ring-2 ring-neon-pink shadow-[0_16px_34px_-6px_rgba(255,62,165,0.85)]'
                    : isDropTarget
                      ? 'z-10 scale-[0.94] cursor-grab rounded-lg ring-2 ring-neon-pink/90 brightness-115 shadow-[0_0_20px_rgba(255,62,165,0.65)]'
                      : isCorrect
                        ? 'cursor-grab rounded-lg ring-1 ring-neon-pink/45 transition-[filter,box-shadow] duration-150 hover:brightness-110'
                        : 'cursor-grab rounded-lg ring-1 ring-white/15 transition-[filter,box-shadow] duration-150 hover:brightness-110'
              }`}
              style={{
                backgroundImage: `url(${ANNIVERSARY_DATA.puzzle.imageUrl})`,
                backgroundSize: '300% 300%',
                backgroundPosition: `${pieceCol * 50}% ${pieceRow * 50}%`,
                backgroundRepeat: 'no-repeat',
                transform: isDragging
                  ? `translate3d(${dragState.dx}px, ${dragState.dy}px, 0) scale(1.06)`
                  : undefined,
                willChange: isDragging ? 'transform' : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Live Progress & Completion Banner */}
      <div className="mt-4 flex flex-col items-center gap-2">
        {isSolved ? (
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 font-sans text-xs leading-normal font-semibold tracking-[0.12em] text-neon-pink uppercase">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>9/9 Chuẩn Rồi Nè</span>
            </p>
            <p className="font-display text-2xl leading-snug font-semibold text-starlight">
              Giỏi quá trời luôn! Em ghép xong rồi nè ♥
            </p>
            <p className="text-xs leading-relaxed text-lavender">
              {ANNIVERSARY_DATA.puzzle.unlockMessage}
            </p>
          </div>
        ) : (
          <p className="font-mono text-xs font-medium tracking-[0.08em] text-lavender tabular-nums">
            Em ghép đúng <span className="text-starlight">{solvedCount}</span>/{TOTAL_TILES} mảnh rồi nè
          </p>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="glass-interactive mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs leading-normal font-medium text-lavender hover:text-starlight"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>{isSolved ? 'Ghép lại lần nữa nha' : 'Xáo lại mảnh ghép'}</span>
        </button>
      </div>
    </div>
  );
}
