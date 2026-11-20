import { ExperienceCanvas } from './canvas/ExperienceCanvas';
import { HudOverlay } from './components/ui/HudOverlay';

export default function App() {
  return (
    <main className="relative h-full w-full overflow-hidden bg-void">
      <ExperienceCanvas />
      <HudOverlay />
    </main>
  );
}
