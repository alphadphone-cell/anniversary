import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

interface ElapsedParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeElapsed(startIso: string): ElapsedParts {
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  return { days, hours, minutes, seconds };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function CounterModal() {
  const [elapsed, setElapsed] = useState<ElapsedParts>(() =>
    computeElapsed(ANNIVERSARY_DATA.startDateISO)
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsed(computeElapsed(ANNIVERSARY_DATA.startDateISO));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const units = [
    { label: 'Ngày', value: String(elapsed.days) },
    { label: 'Giờ', value: pad2(elapsed.hours) },
    { label: 'Phút', value: pad2(elapsed.minutes) },
    { label: 'Giây', value: pad2(elapsed.seconds) },
  ];

  const startDateDisplay = ANNIVERSARY_DATA.startDateISO
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');

  return (
    <div className="flex flex-col items-center text-center">
      {/* Floating glowing heart + cute cosmic companion emblem matching reference */}
      <div className="relative mb-3 flex flex-col items-center" aria-hidden="true">
        <motion.svg
          viewBox="0 0 32 30"
          className="mb-2 h-5 w-5"
          animate={{ y: [0, -4, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M16 27 C15 26 2 17 2 9 C2 4.6 5.4 1.5 9.6 1.5 C12.2 1.5 14.5 2.8 16 4.8 C17.5 2.8 19.8 1.5 22.4 1.5 C26.6 1.5 30 4.6 30 9 C30 17 17 26 16 27 Z"
            fill="#ff3ea5"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,62,165,0.85))' }}
          />
        </motion.svg>

        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-neon-magenta/35 bg-neon-violet/15 shadow-[0_0_34px_-6px_rgba(217,70,239,0.55)]">
          <svg viewBox="0 0 80 80" className="h-14 w-14">
            {/* Soft stylized cosmic kitty companion */}
            <ellipse cx="40" cy="60" rx="22" ry="7" fill="rgba(249, 168, 212, 0.25)" />
            <path
              d="M21 32 L25 18 L34 26 Q40 24 46 26 L55 18 L59 32 C63 40 61 55 40 56 C19 55 17 40 21 32 Z"
              fill="#d8c8f2"
              stroke="#fff4fd"
              strokeWidth="2"
            />
            <circle cx="32" cy="40" r="2.6" fill="#18082d" />
            <circle cx="48" cy="40" r="2.6" fill="#18082d" />
            <ellipse cx="27" cy="44" rx="3.4" ry="1.8" fill="#ff6ab7" opacity="0.65" />
            <ellipse cx="53" cy="44" rx="3.4" ry="1.8" fill="#ff6ab7" opacity="0.65" />
            <path
              d="M37 44 Q40 47 43 44"
              fill="none"
              stroke="#18082d"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <p className="text-xs leading-normal font-medium tracking-[0.12em] text-lavender uppercase">
        Tụi mình bên nhau từ <span className="font-mono tabular-nums">{startDateDisplay}</span>
      </p>

      {/* 4 glowing glass timer cards */}
      <div
        className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
        aria-live="off"
        aria-label="Thời gian tụi mình bên nhau"
      >
        {units.map((unit) => (
          <div
            key={unit.label}
            className="flex flex-col items-center justify-center rounded-2xl border border-neon-pink/28 bg-white/[0.04] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(217,70,239,0.4)]"
          >
            <span className="font-mono text-2xl font-semibold text-starlight tabular-nums sm:text-3xl">
              {unit.value}
            </span>
            <span className="mt-1 text-xs leading-normal font-medium text-lavender-muted">
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      <h2
        id="anni-modal-title"
        className="mt-6 font-display text-2xl leading-snug font-semibold italic text-starlight sm:text-3xl"
      >
        Thời Gian Của Tụi Mình
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-lavender">
        Mỗi giây trôi qua bên em đều là khoảnh khắc rực rỡ nhất trong vũ trụ của anh.
      </p>

      {/* Compact milestone strip */}
      <ul className="mt-5 grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2">
        {ANNIVERSARY_DATA.milestones.slice(0, 4).map((milestone) => (
          <li
            key={milestone.id}
            className="rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-starlight">{milestone.title}</span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-lavender-muted tabular-nums">
                {milestone.date}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-lavender-muted">{milestone.location}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
