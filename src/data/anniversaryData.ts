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

export type GalaxyNodeId = 'letter' | 'counter' | 'cards' | 'puzzle' | 'gallery';

export interface GalaxyNodeConfig {
  id: GalaxyNodeId;
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
  aspect?: 'portrait' | 'landscape';
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
  aspect?: 'portrait' | 'landscape';
  /** Tọa độ 3D trên vòm trời phía trên tạo thành cung chòm sao ký ức */
  position: [number, number, number];
}

export interface ConstellationEmblemConfig {
  /** Tên tiếng Việt hiển thị dưới biểu tượng chòm sao khi kết thúc hành trình */
  name: string;
  /** Dòng phụ đề ngắn lãng mạn bên dưới tên chòm sao */
  subtitle: string;
  /** Đường nét SVG chính (viewBox="0 0 160 160") — dễ thay sang cung hoàng đạo hoặc logo cặp đôi khác */
  svgPath: string;
  /** Các điểm sao nhấn nhỏ trên biểu tượng (hệ tọa độ 160x160) */
  starDots?: Array<[number, number]>;
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
  /** Ảnh chân dung nền trong suốt / tối để hóa hình tượng hạt 3D hai đứa sau màn nổ Siêu Tân Tinh */
  coupleFinaleImage: string;
  constellationMilestones: ConstellationMilestone[];
  /** Biểu tượng / logo phát sáng của chòm sao hiện lên khi hoàn thành cả 7 mốc */
  constellationEmblem: ConstellationEmblemConfig;
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
  coupleNames: ['AD', 'Tlinh'],
  experienceTitle: 'Quỹ Đạo Của Tụi Mình',
  experienceSubtitle: 'Mỗi vì sao đều lưu giữ một kỷ niệm của AD & Tlinh từ lớp 11 đến nay.',
  introHeadline: 'Chúc Mừng Kỷ Niệm',
  introStatusLabel: 'ĐANG NẠP YÊU THƯƠNG...',
  galaxyPhrases: [
    'AD ♥ Tlinh',
    'Thương bé nhất',
    '20/11 · 3 Năm',
    'Chỉ có bé thôi',
    'Cùng nhau trưởng thành',
    'Ma Kết 30/12',
    'Vô cực ∞',
    'Cảm ơn bé đã ở lại',
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
  startDateISO: '2023-11-20T10:30:00+07:00',
  anniversaryDateISO: '2026-11-20T10:30:00+07:00',
  anniversaryOrdinal: 'Kỷ niệm 3 năm',

  letter: {
    headline: 'Bức Thư AD Gửi Bé Tlinh',
    dateLabel: '20 tháng 11, 2026 · Tròn 3 Năm',
    salutation: 'Gửi bé thương nhất của anh,',
    paragraphs: [
      'Vậy là tụi mình đã đi cùng nhau tròn 3 năm kể từ ngày 20/11 năm lớp 11 rồi đó bé. Nhìn lại quãng đường từ hai đứa học trò 2k7 mặc áo trắng dưới một mái trường cho tới lúc khoác áo cử nhân tốt nghiệp, ngồi bên ánh lửa trại tuổi 18 rồi cùng nhau trưởng thành, anh vẫn thấy tim mình mềm lại mỗi khi nhớ về bé.',
      'Ba năm không phải lúc nào cũng toàn nắng đẹp — từng có đêm trăng tròn bé chán anh tưởng chừng hai đứa lạc nhịp, nhưng sau cùng tụi mình vẫn chọn quay lại, ôm chặt lấy nhau và thương nhau còn tha thiết hơn trước rất nhiều. Cảm ơn bé vì đã bao dung, đã ở lại và làm thanh xuân của anh đẹp đến thế.',
      'Từ chuyến đi Đà Lạt đón sinh nhật của bé, những lần nhận giải cuối năm, cho đến lần trở lại với nhau gần đây — chỗ nào có bé cũng là nơi anh thấy bình yên nhất. Chúc mừng kỷ niệm 3 năm của anh và bé, chặng đường phía trước còn dài lắm, mình vẫn cứ nắm tay đi tiếp thật lâu cùng nhau bé nhé.',
    ],
    signature: 'Mãi thương bé — Aiu của Bé',
  },

  milestones: [
    {
      id: 'first-spark',
      date: '20/11/2023',
      title: 'Nơi Mọi Thứ Bắt Đầu',
      location: '10h30 · THPT THĐ',
      note: 'Đúng 10h30 ngày 20/11 năm lớp 11, quỹ đạo của AD và Tlinh chính thức giao nhau.',
    },
    {
      id: 'first-kiss',
      date: '29/12/2023',
      title: 'Nụ Hôn Đầu Tiên',
      location: 'Khoảnh Khắc Ngọt Ngào Khó Quên',
      note: 'Khoảnh khắc tim đập nhanh nhất và dịu dàng nhất của hai đứa trong những ngày đầu bên nhau.',
    },
    {
      id: 'grow-up-18',
      date: '22/05/2025',
      title: 'Tốt Nghiệp & Tuổi 18 Trưởng Thành',
      location: 'Dưới Một Mái Trường',
      note: 'Khoác chung màu áo cử nhân, ngồi bên ánh lửa trại năm 18 tuổi và lớn lên cùng nhau.',
    },
    {
      id: 'three-years',
      date: '20/11/2026',
      title: 'Tròn 3 Năm Quỹ Đạo AD & Tlinh',
      location: 'Ngay Lúc Này, Bên Nhau',
      note: 'Ba năm đi qua thanh xuân cấp 3 đến hiện tại — bé vẫn là điều bình yên nhất của anh.',
    },
  ],

  cards: [
    {
      id: 'card-1',
      title: 'Một Bữa Ăn Bé Thích Nhất',
      couponTag: 'QUÀ 01',
      message: 'Bé chỉ cần chọn quán hay món bé đang thèm nhất, AD chở đi ăn thả ga không cần nhìn giá nha.',
      accent: 'pink',
    },
    {
      id: 'card-2',
      title: 'Hẹn Một Chuyến Đà Lạt Nữa',
      couponTag: 'QUÀ 02',
      message: 'Hẹn bé một chuyến đi Đà Lạt thật chill nữa — chụp thêm thật nhiều ảnh đẹp, nắm tay dạo phố đêm và ăn thật nhiều món bé thích.',
      accent: 'magenta',
    },
    {
      id: 'card-3',
      title: 'Thẻ Miễn Giận & Anh Nghe Lời',
      couponTag: 'QUÀ 03',
      message: 'Dùng bất cứ lúc nào bé dỗi nha — anh nhận sai trước, dỗ bé bằng món bé thích và một cái ôm thật chặt.',
      accent: 'violet',
    },
    {
      id: 'card-4',
      title: 'Xem Phim & Chụp Photobooth',
      couponTag: 'QUÀ 04',
      message: 'Một buổi hẹn hò trọn gói: bé toàn quyền chọn phim, nước ngon đầy tay và thêm một bộ ảnh kỷ niệm mới.',
      accent: 'pink',
    },
    {
      id: 'card-5',
      title: 'Điều Ước Bí Mật Của Bé Tlinh',
      couponTag: 'QUÀ 05',
      message: 'Lá thẻ đặc biệt nhất nè — bé muốn điều gì cứ nói với anh, AD nhất định sẽ thực hiện cùng bé.',
      accent: 'magenta',
    },
  ],

  puzzle: {
    headline: 'Ghép Ảnh Đôi Tốt Nghiệp',
    intro: 'Em giữ rồi kéo thả hoặc vuốt từng mảnh ảnh để ghép lại tấm hình tốt nghiệp của hai đứa nha.',
    imageUrl: '/media/memories/puzzle-ad-tlinh.webp',
    completedHeadline: 'Hoàn Thành Rồi, Giỏi Quá Đi!',
    unlockMessage: 'Mọi mảnh ghép của tuổi 18 đều trở nên trọn vẹn nhất khi có AD và Tlinh bên nhau.',
  },

  gallery: [
    {
      id: 'mem-moon',
      title: 'Đêm Trăng Tròn Mình Chọn Ở Lại',
      date: '22/05/2024',
      location: 'Nhà Truyền Thống',
      caption: 'Tấm ảnh đặc biệt nhất sau lần bé chán anh — cảm ơn vì tụi mình đã hàn gắn và thương nhau tha thiết hơn.',
      imageUrl: '/media/memories/02-full-moon.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-clock',
      title: 'Buổi Đi Chơi Đêm Đẹp Lắm',
      date: '22/05/2024',
      location: 'CityLand',
      caption: 'Một góc tòa nhà đồng hồ cổ trong buổi tối đi chơi ở CityLand thật đáng nhớ của hai đứa mình.',
      imageUrl: '/media/memories/03-clock-building.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-dalat-mongco',
      title: 'Vùng Đất Mông Cổ',
      date: '30/12/2024',
      location: 'Đà Lạt',
      caption: 'Sáng sinh nhật bé giữa Vùng Đất Mông Cổ nắng xanh ngắt — cô gái váy trắng đứng cạnh anh, chỉ cần một tấm ảnh gương là gói trọn cả buổi sáng Đà Lạt rồi.',
      imageUrl: '/media/memories/11-dalat-mongco.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-dalat-cave',
      title: 'Ánh Sáng Xanh Tím Sinh Nhật Bé',
      date: '30/12/2024',
      location: 'Đà Lạt',
      caption: 'Chuyến đi Đà Lạt cùng lớp đúng ngày sinh nhật 30/12 của Tlinh — góc nào đứng cạnh bé cũng sáng bừng.',
      imageUrl: '/media/memories/04-dalat-ice-cave.webp',
      aspect: 'landscape',
    },
    {
      id: 'mem-dalat-lake',
      title: 'Sinh Nhật Bé Bên Hồ Đà Lạt',
      date: '30/12/2024',
      location: 'Đà Lạt',
      caption: 'Trời Đà Lạt se lạnh đúng ngày sinh nhật cô gái Ma Kết của anh, nhưng nụ cười của bé làm ấm cả chuyến đi.',
      imageUrl: '/media/memories/05-dalat-birthday-lake.webp',
      aspect: 'landscape',
    },
    {
      id: 'mem-uniform',
      title: 'Thanh Xuân Áo Trắng Cấp 3',
      date: '28/04/2025',
      location: 'THPT THĐ',
      caption: 'Kỷ niệm chụp ảnh trong bộ đồng phục học sinh và tà áo dài trắng — những ngày đẹp nhất tuổi học trò.',
      imageUrl: '/media/memories/06-school-uniform.webp',
      aspect: 'landscape',
    },
    {
      id: 'mem-graduation',
      title: 'Tốt Nghiệp Dưới Một Mái Trường',
      date: '22/05/2025',
      location: 'Sân Trường Cấp 3',
      caption: 'Khoác áo cử nhân, cầm chung tấm Bằng Tốt Nghiệp và mỉm cười vì đã đi hết cấp 3 cùng nhau.',
      imageUrl: '/media/memories/07-graduation-gowns.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-hoitrai-bunba',
      title: 'Bé Iu Bùn Bã',
      date: '14/06/2025',
      location: 'Hội Trại Tuổi 18',
      caption: 'Lúcccc dỗ bé sắp thành công.',
      imageUrl: '/media/memories/12-hoitrai-bunba.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-campfire',
      title: 'Đêm Lửa Trại Tuổi 18',
      date: '14/06/2025',
      location: 'Hội Trại Tuổi 18',
      caption: 'Ánh lửa trại rực ấm đánh dấu cột mốc hai đứa cùng bước qua tuổi 18 và trưởng thành bên nhau.',
      imageUrl: '/media/memories/08-campfire-18.webp',
      aspect: 'landscape',
    },
    {
      id: 'mem-award',
      title: 'Cùng Nhau Nhận Giải Cuối Năm',
      date: '21/06/2025',
      location: 'Sân Trường Cấp 3',
      caption: 'Buổi sáng cuối năm cấp 3 cùng nhau lên nhận giải — tự hào về bé và tự hào về tụi mình.',
      imageUrl: '/media/memories/09-year-end-award.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-dainam-4d',
      title: 'Rạp Phim 4D',
      date: '01/07/2025',
      location: 'Đại Nam',
      caption: 'Hehehehe trò zô tri của 2 đứa nè, đợt này a cũng làm bé dỗi nhưng mà gòiii lại vui lại hihi.',
      imageUrl: '/media/memories/13-dainam-4d.webp',
      aspect: 'landscape',
    },
    {
      id: 'mem-dainam-slide',
      title: 'Vượt Qua Nỗi Sợ',
      date: '01/07/2025',
      location: 'Đại Nam',
      caption: 'Kéoooo đồ trượt cho bé iu tập vượt qua nỗi sợ nèee.',
      imageUrl: '/media/memories/14-dainam-slide.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-dalat-2026',
      title: 'Giữa Trời Đà Lạt · Vẫn Là Bé',
      date: '26/01/2026',
      location: 'Đà Lạt',
      caption: 'Đi qua bao nhiêu mùa vẫn là AD dịu dàng thơm má bé, vẫn là Tlinh đáng yêu nhất thế gian.',
      imageUrl: '/media/memories/10-dalat-2026.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-phuthe',
      title: 'Nét Phu Thê',
      date: '10/04/2026',
      location: 'Trên Đường Đi',
      caption: 'Tấm này chụp chung thấy 2 đứa y chang xong cười quá trờiii.',
      imageUrl: '/media/memories/15-net-phu-the.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-mixue',
      title: 'Mi Xuệ',
      date: '21/04/2026',
      location: 'Mixue',
      caption: '"Ăn 2 câyyyy luônnnn nha anhhhh" — giọng nóiii cute mà anhhh muốn nghe mỗi chiều đi học về.',
      imageUrl: '/media/memories/16-mixue.webp',
      aspect: 'portrait',
    },
    {
      id: 'mem-covid-park',
      title: 'Đánh Dấu Người Yêu',
      date: '16/08/2026',
      location: 'Công Viên Covid',
      caption: 'Ngày mà a làmmm cho bé có 1 dấu vết, có khiii mai mốt nó lại là cái để a tìm về bé 🥺',
      imageUrl: '/media/memories/17-cong-vien-covid.webp',
      aspect: 'landscape',
    },
  ],

  rewards: [
    {
      id: 'rew-dinner',
      code: 'AD-TLINH-01',
      title: 'Bữa Ăn Bé Thích Nhất',
      description: 'Bất kỳ quán nào bé chọn, trọn vẹn thời gian riêng cho hai đứa.',
      expiresLabel: 'Không thời hạn',
    },
    {
      id: 'rew-escape',
      code: 'DALAT-02',
      title: 'Chuyến Đà Lạt Tiếp Theo',
      description: 'Lịch trình chill từ A đến Z để AD và Tlinh viết tiếp kỷ niệm.',
      expiresLabel: 'Dùng bất cứ lúc nào',
    },
  ],

  secretSupernova: {
    headline: 'Tấm Ảnh Đặc Biệt Nhất Anh Giữ Cho Bé',
    subtitle: '31/12/2023 · Cái nắm tay giao thừa',
    imageUrl: '/media/memories/01-nova-hands.webp',
    aspect: 'portrait',
    paragraphs: [
      'Bé còn nhớ tấm ảnh này không? Đây chính là biểu hiện tình yêu của mình trong 3 năm nay, anh vẫn luôn giữ nó trong app chưa thay đổi lần nào, cũng là một cột mốc đánh dấu tình yêu của tụi mình.',
      'Anh giấu tấm ảnh hai bàn tay đan chặt nhau đêm ấy ở tận sâu trong lõi trái tim này — vì với anh, đây luôn là khoảnh khắc đặc biệt và quý giá nhất trong suốt 3 năm qua.',
      'Từ những ngày đầu lớp 11 bỡ ngỡ, qua cả đêm trăng tròn từng suýt lạc nhau rồi thương lại sâu đậm hơn, đến tuổi 18 trưởng thành hôm nay — chỉ cần còn được nắm chặt bàn tay của bé, anh chẳng sợ bất kỳ khoảng cách hay giông gió nào nữa.',
    ],
    promiseLabel: 'Lời hứa 3 năm của AD · Đổi một điều ước bất kỳ, anh luôn đồng ý với bé',
    signature: 'Mãi nắm chặt tay bé — AD',
  },

  coupleFinaleImage: '/images/couple-finale.png',

  // Chòm sao Ma Kết (Capricornus — 30/12/2007 · Sinh nhật Thuỳ Linh):
  // 7 ngôi sao chính nối trọn dòng thời gian 3 năm của AD & Tlinh:
  // α Cap (Algedi) -> β Cap (Dabih) -> ψ Cap -> ζ Cap (Marakk) -> γ Cap (Nashira) -> δ Cap (Deneb Algedi) -> θ Cap (khép vòng về Dabih)
  constellationMilestones: [
    {
      id: 'star-noel-2023',
      date: '25/12/2023',
      title: 'Nụ Cười Giáng Sinh Đầu Tiên',
      caption: 'Chiều Noel 2023 trong chiếc áo khoác trùm mũ — ánh mắt trong veo và nụ cười hiền khiến anh nhớ mãi những ngày đầu lớp 11.',
      image: '/media/constellation/star-01-noel-2023.webp',
      aspect: 'portrait',
      // α Cap (Algedi) — Đỉnh sừng trên bên trái của chòm Ma Kết
      position: [-7.4, 18.8, -7.2],
    },
    {
      id: 'star-nye-2023',
      date: '31/12/2023',
      title: 'Ánh Đèn Vàng Đêm Giao Thừa',
      caption: 'Tối cuối năm 2023 dịu dàng dưới ánh đèn vàng — khoảnh khắc bé cười thật ấm ngay bên cạnh anh trước thềm năm mới đầu tiên.',
      image: '/media/constellation/star-02-nye-2023.webp',
      aspect: 'portrait',
      // β Cap (Dabih) — Điểm nối sừng vào thân cung Ma Kết
      position: [-6.1, 17.5, -7.5],
    },
    {
      id: 'star-aodai-2024',
      date: '27/05/2024',
      title: 'Sáng Hè Trong Tà Áo Dài Trắng',
      caption: 'Buổi sáng tháng Năm dịu mát trong tà áo dài học trò — cô bé lớp 11 của anh lúc nào cũng xinh xắn và tỏa nắng nhất sân trường.',
      image: '/media/constellation/star-03-aodai-2024.webp',
      aspect: 'portrait',
      // ψ Cap (Psi Capricorni) — Đỉnh nhọn phía dưới bên trái
      position: [-3.0, 13.9, -7.1],
    },
    {
      id: 'star-dalat-eve',
      date: '29/12/2024',
      title: 'Đêm Đà Lạt Trước Thềm Sinh Nhật',
      caption: 'Tối 29/12 giữa trời Đà Lạt trong chiếc váy trắng dịu dàng — chỉ vài tiếng nữa thôi là đón sinh nhật cô gái Ma Kết của anh rồi.',
      image: '/media/constellation/star-04-dalat-eve.webp',
      aspect: 'portrait',
      // ζ Cap (Marakk) — Đường cong đáy phía nam của chòm Ma Kết
      position: [1.3, 14.3, -7.4],
    },
    {
      id: 'star-dalat-coat',
      date: '29/12/2024',
      title: 'Áo Lông Trắng & Ánh Mắt Long Lanh',
      caption: 'Trong chiếc áo khoác lông trắng ấm áp và mặt dây chuyền trăng khuyết — nhìn bé cười mà gió lạnh Đà Lạt cũng hóa dịu dàng.',
      image: '/media/constellation/star-05-dalat-coat.webp',
      aspect: 'portrait',
      // γ Cap (Nashira) — Cánh phải vươn lên phía đuôi sao
      position: [5.0, 16.2, -7.8],
    },
    {
      id: 'star-grad-18',
      date: '31/05/2025',
      title: 'Ánh Nhìn Rạng Rỡ Tuổi 18',
      caption: 'Khoác áo cử nhân ngước nhìn về phía bầu trời rộng mở — cô gái của anh đã trưởng thành thật xinh đẹp và đầy tự tin.',
      image: '/media/constellation/star-06-grad-18.webp',
      aspect: 'portrait',
      // δ Cap (Deneb Algedi) — Mũi đuôi sáng nhất chòm Ma Kết
      position: [7.6, 17.6, -7.3],
    },
    {
      id: 'star-spring-2026',
      date: '03/02/2026',
      title: 'Nàng Thơ Dịu Dàng Của Anh',
      caption: 'Qua 3 năm bên nhau, bé vẫn luôn là ngôi sao dịu dàng, trong trẻo và sáng nhất trên bầu trời của anh.',
      image: '/media/constellation/star-07-spring-2026.webp',
      aspect: 'landscape',
      // θ Cap (Theta Capricorni) — Sống lưng cong trên, khép trọn vòng cung Ma Kết về β Cap (Dabih)
      position: [0.5, 17.0, -8.0],
    },
  ],

  // Biểu tượng chòm sao Ma Kết (Capricornus ♑ — 30/12 · Sinh nhật Thuỳ Linh) hiển thị phát sáng khi kết thúc 7/7 mốc.
  constellationEmblem: {
    name: 'Chòm Sao Ma Kết',
    subtitle: '30/12 · AD & Tlinh · 3 Năm 1 Bầu Trời',
    // Nét line-art tối giản biểu trưng cung Ma Kết (sừng chữ V uyển chuyển nối vòng đuôi sao thiên hà)
    svgPath:
      'M 34 48 C 40 36, 48 40, 52 54 L 68 104 C 71 112, 77 112, 80 104 L 94 60 C 98 46, 114 48, 114 63 C 114 82, 92 94, 96 112 C 99 124, 116 126, 124 114 C 131 103, 122 90, 110 92 C 98 94, 90 108, 76 126',
    starDots: [
      [34, 48],
      [52, 54],
      [74, 108],
      [108, 56],
      [124, 114],
    ],
  },

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
