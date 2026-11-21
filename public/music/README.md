# Thư mục Nhạc Nền Kỷ Niệm (K-Drama / Romantic OST)

## Deck A — Playlist nhạc nền liên tục (tự phát & chuyển bài)
3 bản K-Drama OST lãng mạn đã được tích hợp sẵn (chuẩn hóa `loudnorm`, stereo 44.1kHz MP3 128kbps):

- `track-1.mp3` — **Beautiful** — Crush (*Goblin OST*)
- `track-2.mp3` — **Every Day, Every Moment** — Paul Kim (*Should We Kiss First? OST*)
- `track-3.mp3` — **Spring Snow (봄눈)** — 10CM (*Lovely Runner OST*)

## Deck B — Nhạc điệp khúc cao trào Secret Supernova (tùy chọn)
- Thả file nhạc điệp khúc riêng của bạn vào: `public/music/supernova-finale.mp3`
- Chỉnh `supernovaFinaleTrack.chorusStartTime` (tính bằng giây) trong `src/data/anniversaryData.ts` khớp đúng nhịp điệp khúc bùng nổ.
- Nếu chưa thả `supernova-finale.mp3`, hệ thống sẽ tự động phát đoạn hòa âm cao trào dự phòng (không lỗi 404).
