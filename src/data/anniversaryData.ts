export interface AnniversaryMilestone {
  id: string;
  date: string;
  title: string;
  location: string;
  note: string;
}

export interface LoveCardItem {
  id: string;
  title: string;
  couponTag: string;
  message: string;
  accent: 'pink' | 'magenta' | 'violet';
}

export interface PuzzleConfig {
  headline: string;
  intro: string;
  imageUrl: string;
  completedHeadline: string;
  unlockMessage: string;
}

export interface GalleryMemory {
  id: string;
  title: string;
  date: string;
  location: string;
  caption: string;
  imageUrl: string;
  aspect: 'portrait' | 'landscape' | 'square';
}

export interface AnniversaryReward {
  id: string;
  code: string;
  title: string;
  description: string;
  expiresLabel: string;
}

export interface GalaxyNodeConfig {
  id: 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery';
  label: string;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  heightOffset: number;
  primaryColor: string;
  secondaryColor: string;
  emblem: 'heart-mail' | 'heart-clock' | 'twin-hearts' | 'star-heart' | 'keepsake-heart';
}

export interface SecretSupernovaConfig {
  headline: string;
  subtitle: string;
  imageUrl: string;
  paragraphs: string[];
  promiseLabel: string;
  signature: string;
}

export interface ConstellationMilestone {
  id: string;
  date: string;
  title: string;
  caption: string;
  image: string;
  /** 3D position in the upper sky dome forming a romantic celestial arc */
  position: [number, number, number];
}

export interface AnniversaryConfig {
  coupleNames: [string, string];
  experienceTitle: string;
  experienceSubtitle: string;
  introHeadline: string;
  introStatusLabel: string;
  galaxyPhrases: string[];
  galaxyNodes: GalaxyNodeConfig[];
  startDateISO: string;
  anniversaryDateISO: string;
  anniversaryOrdinal: string;
  letter: {
    headline: string;
    dateLabel: string;
    salutation: string;
    paragraphs: string[];
    signature: string;
  };
  milestones: AnniversaryMilestone[];
  cards: LoveCardItem[];
  puzzle: PuzzleConfig;
  gallery: GalleryMemory[];
  rewards: AnniversaryReward[];
  secretSupernova: SecretSupernovaConfig;
  constellationMilestones: ConstellationMilestone[];
  audio: {
    trackTitle: string;
    artist: string;
    src: string;
    defaultVolume: number;
  };
}

export const ANNIVERSARY_DATA: AnniversaryConfig = {
  coupleNames: ['Alex', 'Minh'],
  experienceTitle: 'Orbit of Us',
  experienceSubtitle: 'Every star remembers a night we shared.',
  introHeadline: 'Happy Anniversary',
  introStatusLabel: 'CHARGING LOVE...',
  galaxyPhrases: [
    'HAPPY ANNIVERSARY',
    'LOVE U THE MOST',
    'ALWAYS U',
    'ONLY U',
    'OUR LOVE',
    'MY HEART',
    'INFINITY ∞',
    'YOU & ME',
  ],
  galaxyNodes: [
    {
      id: 'letter',
      label: 'Love Letter',
      orbitRadius: 4.9,
      orbitAngle: 0.35,
      orbitSpeed: 0.14,
      heightOffset: 0.95,
      primaryColor: '#ff3ea5',
      secondaryColor: '#ffd1ec',
      emblem: 'heart-mail',
    },
    {
      id: 'counter',
      label: 'Time Together',
      orbitRadius: 6.4,
      orbitAngle: 1.62,
      orbitSpeed: 0.11,
      heightOffset: 1.25,
      primaryColor: '#d946ef',
      secondaryColor: '#f5d0fe',
      emblem: 'heart-clock',
    },
    {
      id: 'cards',
      label: 'Love Notes',
      orbitRadius: 5.5,
      orbitAngle: 2.85,
      orbitSpeed: 0.13,
      heightOffset: 0.8,
      primaryColor: '#ff4da6',
      secondaryColor: '#ffe4f2',
      emblem: 'twin-hearts',
    },
    {
      id: 'puzzle',
      label: 'Star Puzzle',
      orbitRadius: 7.4,
      orbitAngle: 4.15,
      orbitSpeed: 0.095,
      heightOffset: 1.35,
      primaryColor: '#a855f7',
      secondaryColor: '#ede9fe',
      emblem: 'star-heart',
    },
    {
      id: 'gallery',
      label: 'Our Memories',
      orbitRadius: 6.1,
      orbitAngle: 5.38,
      orbitSpeed: 0.12,
      heightOffset: 1.05,
      primaryColor: '#ec4899',
      secondaryColor: '#fce7f3',
      emblem: 'keepsake-heart',
    },
  ],
  startDateISO: '2024-11-20T19:30:00+07:00',
  anniversaryDateISO: '2026-11-20T00:00:00+07:00',
  anniversaryOrdinal: '2nd Anniversary',

  letter: {
    headline: 'A Letter Across the Quiet Sky',
    dateLabel: 'November 20, 2026',
    salutation: 'My dearest,',
    paragraphs: [
      'Two orbits around the sun, and somehow the quiet moments between us still feel like discovering a new constellation.',
      'Thank you for turning ordinary Tuesday evenings into places I never want to leave, and for meeting every storm with steady warmth.',
      'Here is to every unmapped mile ahead — may we always keep our own gravity.',
    ],
    signature: 'Always yours',
  },

  milestones: [
    {
      id: 'first-spark',
      date: '2024-11-20',
      title: 'The Evening Everything Shifted',
      location: 'Rooftop Coffee, District 1',
      note: 'Two hours felt like ten minutes while the city lights blurred below.',
    },
    {
      id: 'first-trip',
      date: '2025-04-12',
      title: 'Coastal Sunrise Drive',
      location: 'Phu Yen Coastline',
      note: 'Windows down, salty wind, and a playlist we still replay every weekend.',
    },
    {
      id: 'one-year',
      date: '2025-11-20',
      title: 'First Orbit Complete',
      location: 'Da Lat Pine Hills',
      note: 'Cold air, warm lantern light, and a promise written on a folded receipt.',
    },
    {
      id: 'two-years',
      date: '2026-11-20',
      title: 'Two Years in Deep Space',
      location: 'Right Here, Tonight',
      note: 'Still my favorite person to get lost with.',
    },
  ],

  cards: [
    {
      id: 'card-1',
      title: 'Stargazing Dinner',
      couponTag: 'COUPON 01',
      message: 'One phone-free dinner date at any restaurant you choose — dessert mandatory.',
      accent: 'pink',
    },
    {
      id: 'card-2',
      title: 'Midnight Detour',
      couponTag: 'COUPON 02',
      message: 'Redeem anytime for a spontaneous late-night drive and your favorite street food.',
      accent: 'magenta',
    },
    {
      id: 'card-3',
      title: 'Zero-Chore Sunday',
      couponTag: 'COUPON 03',
      message: 'Sleep in as late as you want while I handle coffee, breakfast, and every errand.',
      accent: 'violet',
    },
    {
      id: 'card-4',
      title: 'Movie Marathon Pass',
      couponTag: 'COUPON 04',
      message: 'Full remote control privileges for a cozy triple-feature night with unlimited snacks.',
      accent: 'pink',
    },
    {
      id: 'card-5',
      title: 'Weekend Escape',
      couponTag: 'COUPON 05',
      message: 'Two nights by the coast or in the pine hills — itinerary planned from start to finish.',
      accent: 'magenta',
    },
  ],

  puzzle: {
    headline: 'Complete the Puzzle',
    intro: 'Tap any two tiles to swap them into the right place.',
    imageUrl: '/media/puzzle-couple.svg',
    completedHeadline: 'You Completed Our Sky',
    unlockMessage: 'Every piece falls into place with you.',
  },

  gallery: [
    {
      id: 'mem-1',
      title: 'Rain After the Cinema',
      date: '2025-01-14',
      location: 'Saigon',
      caption: 'Sharing one umbrella while every neon reflection stretched across the pavement.',
      imageUrl: '/media/memory-01.svg',
      aspect: 'landscape',
    },
    {
      id: 'mem-2',
      title: 'Pine Fog Morning',
      date: '2025-11-20',
      location: 'Da Lat',
      caption: 'Lantern light drifting above the valley before sunrise warmed our hands.',
      imageUrl: '/media/memory-02.svg',
      aspect: 'landscape',
    },
    {
      id: 'mem-3',
      title: 'Late Ferry Horizon',
      date: '2026-06-03',
      location: 'Cat Ba Bay',
      caption: 'Violet dusk turning straight into starlight over calm water.',
      imageUrl: '/media/memory-03.svg',
      aspect: 'landscape',
    },
  ],

  rewards: [
    {
      id: 'rew-dinner',
      code: 'STARLIGHT-01',
      title: 'Stargazing Dinner Date',
      description: 'Any restaurant you pick, phone-free evening, dessert mandatory.',
      expiresLabel: 'No expiration',
    },
    {
      id: 'rew-escape',
      code: 'ORBIT-02',
      title: 'Spontaneous Weekend Escape',
      description: 'Two nights by the sea or in the hills — itinerary planned end to end.',
      expiresLabel: 'Redeem anytime',
    },
  ],

  secretSupernova: {
    headline: 'You Found the Hidden Supernova',
    subtitle: 'Secret Starlight Transmission · Unlocked at the Core of Our Heart',
    imageUrl: '/media/secret-supernova.svg',
    paragraphs: [
      'You held onto our heart long enough to wake the brightest star in this entire galaxy.',
      'If I could choose every lifetime over again, I would still find my way back to the exact minute our orbits crossed — no map needed.',
    ],
    promiseLabel: 'Secret Keepsake · Redeemable for one wish, no questions asked',
    signature: 'Forever in your gravity',
  },

  constellationMilestones: [
    {
      id: 'star-first-hello',
      date: '2024-11-20',
      title: 'First Spark Under City Lights',
      caption: 'One rooftop coffee turned into hours of effortless laughter while the skyline glowed below.',
      image: '/media/memory-01.svg',
      position: [-6.8, 15.2, -7.2],
    },
    {
      id: 'star-rain-cinema',
      date: '2025-01-14',
      title: 'Rain After the Cinema',
      caption: 'Sharing one neon-lit umbrella along wet streets, hoping the walk home would never end.',
      image: '/media/memory-01.svg',
      position: [-4.4, 17.8, -8.4],
    },
    {
      id: 'star-coastal-dawn',
      date: '2025-04-12',
      title: 'Coastal Sunrise Drive',
      caption: 'Salty morning wind, open windows, and watching the first pink horizon break over Phu Yen.',
      image: '/media/memory-03.svg',
      position: [-1.7, 16.4, -7.6],
    },
    {
      id: 'star-heart-zenith',
      date: '2025-08-09',
      title: 'Midnight Stargazing Promise',
      caption: 'Lying beneath a clear summer sky, naming our own private constellation for every wish ahead.',
      image: '/media/puzzle-couple.svg',
      position: [0.0, 14.3, -6.5],
    },
    {
      id: 'star-one-year',
      date: '2025-11-20',
      title: 'First Orbit in Da Lat',
      caption: 'Lantern light drifting through pine fog as we celebrated our first full year together.',
      image: '/media/memory-02.svg',
      position: [2.1, 16.6, -7.8],
    },
    {
      id: 'star-cat-ba',
      date: '2026-06-03',
      title: 'Violet Dusk Over the Bay',
      caption: 'A quiet ferry ride where twilight melted straight into reflections of starlight on calm water.',
      image: '/media/memory-03.svg',
      position: [4.8, 17.7, -8.5],
    },
    {
      id: 'star-two-years',
      date: '2026-11-20',
      title: 'Two Years in Deep Space',
      caption: 'Still my favorite co-pilot across every orbit — and our brightest stars are still ahead.',
      image: '/media/secret-supernova.svg',
      position: [7.0, 15.1, -7.1],
    },
  ],

  audio: {
    trackTitle: 'Nocturne in Violet',
    artist: 'Ambient Score',
    src: '/audio/ambient-theme.wav',
    defaultVolume: 0.45,
  },
};
