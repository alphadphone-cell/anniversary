import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Puzzle, RotateCcw, Sparkles } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

const GRID_SIZE = 3;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

function countSolved(board: number[]): number {
  let correct = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === i) correct++;
  }
  return correct;
}

/** Creates an approachable shuffled 3x3 board with 2-4 solved tiles to match the reference flow. */
function createInitialBoard(): number[] {
  const board = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  // Never spawn already solved
  if (countSolved(board) >= TOTAL_TILES - 1) {
    [board[0], board[4]] = [board[4], board[0]];
    [board[2], board[8]] = [board[8], board[2]];
  }
  return board;
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const celebratedRef = useRef(false);
  const timerIdsRef = useRef<number[]>([]);

  const solvedCount = countSolved(board);
  const isSolved = solvedCount === TOTAL_TILES;

  useEffect(() => {
    if (isSolved && !celebratedRef.current) {
      celebratedRef.current = true;
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

  const handleTileClick = useCallback(
    (index: number) => {
      if (isSolved) return;

      if (selectedIndex === null) {
        setSelectedIndex(index);
        return;
      }

      if (selectedIndex === index) {
        setSelectedIndex(null);
        return;
      }

      setBoard((prev) => {
        const next = [...prev];
        [next[selectedIndex], next[index]] = [next[index], next[selectedIndex]];
        return next;
      });
      setSelectedIndex(null);
    },
    [isSolved, selectedIndex]
  );

  const handleReset = useCallback(() => {
    celebratedRef.current = false;
    setSelectedIndex(null);
    setBoard(createInitialBoard());
  }, []);

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
        Em chạm hai mảnh bất kỳ để đổi chỗ cho nhau, ghép lại tấm ảnh của hai đứa nha.
      </p>

      {/* 3x3 Clickable Tile-Swap Jigsaw Grid */}
      <div
        className={`mt-4 grid aspect-square w-full max-w-[285px] grid-cols-3 overflow-hidden rounded-2xl border p-1 transition-all duration-300 ${
          isSolved
            ? 'gap-0 border-neon-pink/70 shadow-[0_0_40px_-8px_rgba(255,62,165,0.65)]'
            : 'gap-1.5 border-neon-magenta/35 bg-void/80 shadow-[0_14px_38px_-14px_rgba(217,70,239,0.45)]'
        }`}
        role="grid"
        aria-label="Ghép lại tấm ảnh của hai đứa"
      >
        {board.map((pieceId, slotIndex) => {
          const pieceRow = Math.floor(pieceId / GRID_SIZE);
          const pieceCol = pieceId % GRID_SIZE;
          const isSelected = selectedIndex === slotIndex;
          const isCorrect = pieceId === slotIndex;

          return (
            <button
              key={slotIndex}
              type="button"
              data-puzzle-slot={slotIndex}
              data-puzzle-piece={pieceId}
              onClick={() => handleTileClick(slotIndex)}
              aria-label={`Ô số ${slotIndex + 1}, mảnh ${pieceId + 1}${isCorrect ? ', đúng chỗ rồi nè' : ''}`}
              aria-pressed={isSelected}
              className={`relative aspect-square min-h-11 min-w-11 cursor-pointer overflow-hidden transition-transform duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-neon-pink ${
                isSolved ? 'rounded-none' : 'rounded-lg'
              } ${
                isSelected
                  ? 'z-10 scale-[0.95] ring-2 ring-neon-pink shadow-[0_0_18px_rgba(255,62,165,0.75)]'
                  : !isSolved && isCorrect
                    ? 'ring-1 ring-neon-pink/45'
                    : !isSolved
                      ? 'ring-1 ring-white/15 hover:brightness-110'
                      : ''
              }`}
              style={{
                backgroundImage: `url(${ANNIVERSARY_DATA.puzzle.imageUrl})`,
                backgroundSize: '300% 300%',
                backgroundPosition: `${pieceCol * 50}% ${pieceRow * 50}%`,
                backgroundRepeat: 'no-repeat',
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
