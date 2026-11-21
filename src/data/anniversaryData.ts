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
  /** Tọa độ 3D trên vòm trời phía trên tạo thành cung chòm sao ký ức */
  position: [number, number, number];
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  /** Đường dẫn tương đối tới file .mp3 đặt trong thư mục public/music/ */
  src: string;
}

export interface SupernovaFinaleTrack {
  title: string;
  artist: string;
  /** Đường dẫn file .mp3 đặt trong thư mục public/music/ (ví dụ: /music/supernova-finale.mp3) */
  src: string;
  /** Thời điểm chính xác (tính bằng giây) đoạn điệp khúc bùng nổ bắt đầu drop */
  chorusStartTime: number;
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
  /** Danh sách phát nhạc nền liên tục (đặt file .mp3 vào public/music/) */
  playlist: PlaylistTrack[];
  /** Bản nhạc điệp khúc cao trào riêng cho màn nổ Secret Supernova (Deck B) */
  supernovaFinaleTrack: SupernovaFinaleTrack;
  audio: {
    trackTitle: string;
    artist: string;
    src: string;
    defaultVolume: number;
  };
}

export const ANNIVERSARY_DATA: AnniversaryConfig = {
  coupleNames: ['Anh', 'Em'],
  experienceTitle: 'Quỹ Đạo Của Tụi Mình',
  experienceSubtitle: 'Mỗi vì sao đều lưu giữ một đêm chúng mình bên nhau.',
  introHeadline: 'Chúc Mừng Kỷ Niệm',
  introStatusLabel: 'ĐANG NẠP YÊU THƯƠNG...',
  galaxyPhrases: [
    'MÃI BÊN NHAU',
    'YÊU EM NHẤT',
    'KỶ NIỆM CỦA TỤI MÌNH',
    'CHỈ CÓ EM THÔI',
    'MÃI MÃI YÊU THƯƠNG',
    'ĐIỀU ƯỚC CỦA CHÚNG MÌNH',
    'VÔ CỰC ∞',
    'CẢM ƠN VÌ ĐÃ ĐẾN',
  ],
  galaxyNodes: [
    {
      id: 'letter',
      label: 'Thư Tình',
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
      label: 'Đếm Ngày',
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
      label: 'Lật Thẻ',
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
      label: 'Ghép Hình',
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
      label: 'Kỷ Niệm',
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
  anniversaryOrdinal: 'Kỷ niệm 2 năm',

  letter: {
    headline: 'Bức Thư Gửi Giữa Bầu Trời Đêm',
    dateLabel: '20 tháng 11, 2026',
    salutation: 'Gửi người thương của anh,',
    paragraphs: [
      'Hai vòng quay trọn vẹn quanh mặt trời, vậy mà mỗi khoảnh khắc bình yên bên em vẫn khiến anh rung động như lần đầu khám phá một chòm sao mới.',
      'Cảm ơn em đã biến những buổi tối bình thường nhất thành nơi anh chỉ muốn trở về, và luôn dịu dàng nắm tay anh đi qua mọi giông gió.',
      'Chúc cho mọi chặng đường phía trước của tụi mình luôn lấp lánh yêu thương — dù thế giới ngoài kia có xoay vần ra sao, mình vẫn mãi chung một quỹ đạo nhé.',
    ],
    signature: 'Mãi yêu em',
  },

  milestones: [
    {
      id: 'first-spark',
      date: '20/11/2024',
      title: 'Buổi Tối Mọi Thứ Bắt Đầu',
      location: 'Quán Cà Phê Sân Thượng, Quận 1',
      note: 'Hai tiếng trôi qua nhanh như mười phút giữa ánh đèn thành phố lung linh.',
    },
    {
      id: 'first-trip',
      date: '12/04/2025',
      title: 'Chuyến Đi Đón Bình Minh Biển',
      location: 'Bờ Biển Phú Yên',
      note: 'Gió biển mặn mà, danh sách nhạc quen thuộc và nụ cười rạng rỡ của em.',
    },
    {
      id: 'one-year',
      date: '20/11/2025',
      title: 'Trọn Vẹn Vòng Quỹ Đạo Đầu Tiên',
      location: 'Đồi Thông Đà Lạt',
      note: 'Sương lạnh, ánh đèn vàng ấm áp và lời hứa nhỏ tụi mình viết cho nhau.',
    },
    {
      id: 'two-years',
      date: '20/11/2026',
      title: 'Hai Năm Giữa Ngân Hà Yêu Thương',
      location: 'Ngay Lúc Này, Đêm Nay',
      note: 'Vẫn là người khiến trái tim anh bình yên nhất mỗi khi ở cạnh.',
    },
  ],

  cards: [
    {
      id: 'card-1',
      title: 'Bữa Tối Dưới Ánh Sao',
      couponTag: 'PHIẾU 01',
      message: 'Một buổi tối hẹn hò không điện thoại ở bất kỳ nhà hàng nào em thích — tráng miệng thả ga.',
      accent: 'pink',
    },
    {
      id: 'card-2',
      title: 'Dạo Phố Nửa Đêm',
      couponTag: 'PHIẾU 02',
      message: 'Dùng bất cứ lúc nào cho một vòng xe lượn phố muộn và ăn trọn món khuya em thèm.',
      accent: 'magenta',
    },
    {
      id: 'card-3',
      title: 'Chủ Nhật Nuông Chiều',
      couponTag: 'PHIẾU 03',
      message: 'Em cứ ngủ nướng thật đã, còn cà phê sáng, bữa trưa và mọi việc vặt cứ để anh lo.',
      accent: 'violet',
    },
    {
      id: 'card-4',
      title: 'Đêm Xem Phim Trọn Gói',
      couponTag: 'PHIẾU 04',
      message: 'Toàn quyền chọn phim cho cả buổi tối ấm cúng cùng bắp rang và đồ ăn vặt không giới hạn.',
      accent: 'pink',
    },
    {
      id: 'card-5',
      title: 'Chuyến Trốn Phố Cuối Tuần',
      couponTag: 'PHIẾU 05',
      message: 'Hai đêm đi biển hoặc lên đồi thông — lịch trình từ A đến Z để anh chuẩn bị hết cho tụi mình.',
      accent: 'magenta',
    },
  ],

  puzzle: {
    headline: 'Ghép Hình Kỷ Niệm',
    intro: 'Chạm lần lượt hai mảnh ghép để hoán đổi về đúng vị trí nhé.',
    imageUrl: '/media/puzzle-couple.svg',
    completedHeadline: 'Hoàn Thành Rồi, Giỏi Quá Đi!',
    unlockMessage: 'Mọi mảnh ghép đều trở nên trọn vẹn khi tụi mình ở bên nhau.',
  },

  gallery: [
    {
      id: 'mem-1',
      title: 'Cơn Mưa Sau Rạp Chiếu Phim',
      date: '14/01/2025',
      location: 'Sài Gòn',
      caption: 'Che chung một chiếc ô nhỏ giữa những vệt đèn neon phản chiếu lấp lánh trên mặt đường.',
      imageUrl: '/media/memory-01.svg',
      aspect: 'landscape',
    },
    {
      id: 'mem-2',
      title: 'Sáng Sương Mù Đồi Thông',
      date: '20/11/2025',
      location: 'Đà Lạt',
      caption: 'Ánh đèn lồng ấm áp lơ lửng trên thung lũng trước khi nắng sớm sưởi ấm đôi bàn tay.',
      imageUrl: '/media/memory-02.svg',
      aspect: 'landscape',
    },
    {
      id: 'mem-3',
      title: 'Hoàng Hôn Tím Trên Chuyến Phà Muộn',
      date: '03/06/2026',
      location: 'Vịnh Cát Bà',
      caption: 'Ráng chiều tím dần tan vào ánh sao phản chiếu trên mặt biển êm ả.',
      imageUrl: '/media/memory-03.svg',
      aspect: 'landscape',
    },
  ],

  rewards: [
    {
      id: 'rew-dinner',
      code: 'SAO-BANG-01',
      title: 'Bữa Tối Ngắm Sao Lãng Mạn',
      description: 'Bất kỳ nhà hàng nào em chọn, không điện thoại, trọn vẹn thời gian cho nhau.',
      expiresLabel: 'Không thời hạn',
    },
    {
      id: 'rew-escape',
      code: 'QUY-DAO-02',
      title: 'Chuyến Nghỉ Dưỡng Cuối Tuần',
      description: 'Hai đêm bên biển hoặc trên núi — lịch trình chuẩn bị trọn gói cho hai đứa.',
      expiresLabel: 'Dùng bất cứ lúc nào',
    },
  ],

  secretSupernova: {
    headline: 'Em Đã Đánh Thức Siêu Tân Tinh Bí Mật',
    subtitle: 'Tín hiệu ánh sao ẩn · Mở khóa tại lõi trái tim ngân hà',
    imageUrl: '/media/secret-supernova.svg',
    paragraphs: [
      'Em đã kiên nhẫn giữ lấy trái tim của tụi mình đủ lâu để đánh thức vì sao rực rỡ nhất trong cả dải ngân hà này.',
      'Nếu được chọn lại thêm bao nhiêu lần nữa, anh vẫn sẽ tìm về đúng khoảnh khắc quỹ đạo của hai đứa giao nhau — chẳng cần bản đồ, chỉ cần có em.',
    ],
    promiseLabel: 'Điều ước bí mật · Đổi một điều ước bất kỳ, anh luôn đồng ý',
    signature: 'Mãi ở trong lực hút của em',
  },

  constellationMilestones: [
    {
      id: 'star-first-hello',
      date: '20/11/2024',
      title: 'Tia Sáng Đầu Tiên Giữa Phố Đêm',
      caption: 'Buổi cà phê sân thượng hóa thành hàng giờ cười nói quên lối về dưới ánh đèn thành phố.',
      image: '/media/memory-01.svg',
      position: [-6.8, 15.2, -7.2],
    },
    {
      id: 'star-rain-cinema',
      date: '14/01/2025',
      title: 'Cơn Mưa Sau Rạp Chiếu Phim',
      caption: 'Chung một chiếc ô nhỏ dưới ánh đèn neon, chỉ mong con đường về nhà dài thêm chút nữa.',
      image: '/media/memory-01.svg',
      position: [-4.4, 17.8, -8.4],
    },
    {
      id: 'star-coastal-dawn',
      date: '12/04/2025',
      title: 'Đón Bình Minh Biển Phú Yên',
      caption: 'Gió biển dịu mát, cửa kính hạ xuống và vệt chân trời hồng đầu tiên tụi mình ngắm cùng nhau.',
      image: '/media/memory-03.svg',
      position: [-1.7, 16.4, -7.6],
    },
    {
      id: 'star-heart-zenith',
      date: '09/08/2025',
      title: 'Điều Ước Dưới Trời Sao Đêm',
      caption: 'Ngước nhìn bầu trời trong vắt và tự đặt tên cho chòm sao của riêng chúng mình.',
      image: '/media/puzzle-couple.svg',
      position: [0.0, 14.3, -6.5],
    },
    {
      id: 'star-one-year',
      date: '20/11/2025',
      title: 'Kỷ Niệm Một Năm Ở Đà Lạt',
      caption: 'Ánh đèn lồng bay nhẹ trong sương thông, đánh dấu trọn vẹn vòng quỹ đạo đầu tiên bên nhau.',
      image: '/media/memory-02.svg',
      position: [2.1, 16.6, -7.8],
    },
    {
      id: 'star-cat-ba',
      date: '03/06/2026',
      title: 'Hoàng Hôn Tím Trên Vịnh Biển',
      caption: 'Chuyến phà chiều muộn nơi sắc tím hoàng hôn hòa tan vào ngàn sao trên mặt nước lặng.',
      image: '/media/memory-03.svg',
      position: [4.8, 17.7, -8.5],
    },
    {
      id: 'star-two-years',
      date: '20/11/2026',
      title: 'Hai Năm Mãi Mãi Yêu Thương',
      caption: 'Cảm ơn em đã luôn là bạn đồng hành tuyệt vời nhất — những vì sao rực rỡ nhất vẫn đang chờ tụi mình phía trước.',
      image: '/media/secret-supernova.svg',
      position: [7.0, 15.1, -7.1],
    },
  ],

  // ---------------------------------------------------------------------------
  // DANH SÁCH NHẠC NỀN K-DRAMA / ROMANTIC OST (Phát liên tục & tự động chuyển bài)
  // Các file .mp3 đã được tích hợp sẵn trong `public/music/` (chuẩn hóa loudnorm 128kbps):
  //   - public/music/track-1.mp3 — Crush - Beautiful (Goblin OST)
  //   - public/music/track-2.mp3 — Paul Kim - Every Day, Every Moment (Should We Kiss First? OST)
  //   - public/music/track-3.mp3 — 10CM - Spring Snow (Lovely Runner OST)
  // ---------------------------------------------------------------------------
  playlist: [
    {
      id: 'ost-1',
      title: 'Beautiful',
      artist: 'Crush · Goblin OST',
      src: '/music/track-1.mp3',
    },
    {
      id: 'ost-2',
      title: 'Every Day, Every Moment',
      artist: 'Paul Kim · K-Drama OST',
      src: '/music/track-2.mp3',
    },
    {
      id: 'ost-3',
      title: 'Spring Snow (봄눈)',
      artist: '10CM · Lovely Runner OST',
      src: '/music/track-3.mp3',
    },
  ],

  // ---------------------------------------------------------------------------
  // NHẠC ĐIỆP KHÚC CAO TRÀO SECRET SUPERNOVA (Deck B — Dual-Deck Chorus Drop)
  // Đã tích hợp sẵn: `public/music/supernova-finale.mp3` — ALWAYS (Hậu Duệ Mặt Trời OST)
  //   - `chorusStartTime: 147.0` (2:27.0): Khoảnh khắc cao trào cuối "I love you~" + dàn dây
  //     bùng nổ khớp ngay lúc lóe trắng vụ nổ Supernova & mở Thư Bí Mật.
  //   - Bạn có thể thay bằng file `.mp3` khác vào `public/music/supernova-finale.mp3` và chỉnh
  //     lại `chorusStartTime` theo đúng giây điệp khúc mong muốn.
  // ---------------------------------------------------------------------------
  supernovaFinaleTrack: {
    title: 'ALWAYS',
    artist: 't Yoonmirae · Descendants of the Sun OST',
    src: '/music/supernova-finale.mp3',
    chorusStartTime: 147.0,
  },

  audio: {
    trackTitle: 'Beautiful',
    artist: 'Crush · Goblin OST',
    src: '/music/track-1.mp3',
    defaultVolume: 0.72,
  },
};
