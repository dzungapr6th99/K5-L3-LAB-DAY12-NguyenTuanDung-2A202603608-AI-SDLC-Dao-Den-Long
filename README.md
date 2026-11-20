# Đảo Đèn Lồng (Phase 2: Ba hòn đảo)

Game 3D góc nhìn thứ ba chạy trên trình duyệt. **Mây**, người giữ đèn nhỏ tuổi, gom đom đóm, mang về thắp lại các **Đèn Lồng Lớn** trên ba hòn đảo (Đảo Bến, Đảo Cau, Đảo Chuông) và tránh **Bóng Mực** cùng **Gió Lạc**.
Bài lab AI-SDLC Day 12, cá nhân (2A202603608). Đề lab gốc: [docs/LAB-README.md](docs/LAB-README.md).

- Bản chơi trực tuyến (Claude Artifact): https://claude.ai/artifact/LcX17RrMrfnZyxtPATJchU (riêng tư, cần quyền truy cập)
- Video demo: chưa có (dành cho Phase 4).

## Cài đặt và chạy (3 lệnh)

Cần Node.js 18 trở lên (macOS, Linux, Windows).

```bash
npm install        # cài three.js
npm start          # mở http://localhost:8080
npm test           # 33 test, tất cả phải đạt
```

Cổng khác: `PORT=3000 npm start`. Thêm `?seed=123` để cố định seed, `?night=2` để vào thẳng Đêm 2 (không qua menu).

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D (hoặc mũi tên lên/xuống) | Đi, theo hướng camera |
| Space | Nhảy (chỉ khi đang chạm đất) |
| Shift | Lướt (14 m/s trong 0,2 s, hồi chiêu 1,5 s) |
| E | Nạp ánh sáng vào đèn chưa sáng gần nhất trong tầm 2 m |
| F | Tỏa Sáng: xua Bóng Mực (tốn 3 đom đóm) |
| ← / → hoặc kéo chuột | Xoay camera (độ nhạy chuột chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng. R: chơi lại Đêm |

## Luật chơi và cách tính điểm

Số liệu chuẩn của Ticket-02 (nguồn duy nhất: [src/tuning.js](src/tuning.js), khớp [game.contract.json](game.contract.json)).

- Mây chạy 6 m/s, nhảy 7 m/s (trọng lực −20), mang tối đa **10** đom đóm. Đom đóm tự nhặt khi cách ≤ 1 m.
- Mỗi đèn cần **10** đom đóm, nạp nhiều lần được, đèn nhớ tiến độ. Đủ 10 thì đèn sáng và tạo **vùng an toàn 6 m**, Bóng Mực không vào được.
- **Tỏa Sáng** (3 đom đóm, bán kính 5 m, hồi chiêu 3 s): Bóng Mực trong tầm bị choáng 2 s và bị đẩy lùi 4 m. Choáng không gây sát thương.
- **Bóng Mực** (4 m/s, Đêm 3: 4,5 m/s) thấy Mây trong 12 m, bỏ đuổi sau 18 m. Chạm là mất 1 Ngọn Lửa (có 3), đánh rơi một nửa đom đóm đang mang, rồi bất tử 1,5 s.
- **Rơi khỏi đảo**: mất 1 Ngọn Lửa và toàn bộ đom đóm, chờ 1 s rồi hồi sinh ở điểm xuất phát, bất tử 1,5 s.
- **Gió Lạc** (Đêm 2, 3): bám theo Mây khi Mây mang từ 5 đom đóm, cướp tối đa 3 rồi bay đi. Tỏa Sáng trúng nó khi đang đuổi thì nó bỏ chạy không cướp được; trúng khi nó đang mang đồ thì nó làm rơi lại hết.
- **Bùa Gió**: lá bùa đỏ viền vàng, 10 s chạy 7,2 m/s và lướt không cần chờ. Xuất hiện lại sau 45 s.
- **Bục nhảy** (Đêm 2, 3) bắn Mây qua đảo kia hoặc lên tầng cao. **Gió mạnh** (Đêm 3) đẩy Mây 2 m/s trong 5 s, mỗi 30 s, có lá bay báo trước 2 s.
- **Điểm**: +10 mỗi đom đóm nạp vào đèn, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng. Thắng đêm: thêm 2 điểm mỗi giây còn lại và 50 điểm mỗi Ngọn Lửa còn lại. Tổng điểm game là tổng điểm các Đêm đã thắng.
- **Thắng đêm**: thắp hết đèn (5 / 6 / 7 đèn, trong 300 / 330 / 360 s). **Thua**: hết Ngọn Lửa, hoặc hết giờ. Thua thì chơi lại Đêm đó. Thắng Đêm 3 thì tới màn Bình Minh.
- Cài đặt (âm lượng, độ nhạy chuột) được lưu trong trình duyệt.

## Chế độ headless và Test Contract v1.1

```bash
node src/headless.js --seed 42 --night 1 [--scenario s.json] [--inputs i.json] --ticks 600 --out out/run.jsonl [--snapshot-every 10]
```

`--night` nhận 1, 2, 3. Mã thoát: 0 thành công, 2 file inputs/scenario sai định dạng, 1 lỗi khác (kèm thông báo stderr). Một Đêm đầy đủ (21.600 tick) chạy trong khoảng 0,4 giây.
Lõi mô phỏng [src/sim.js](src/sim.js) dùng chung cho headless và web. Các chỗ đề chưa nêu rõ và cách tôi chọn: [docs/SPEC-PHASE2.md](docs/SPEC-PHASE2.md) (mục Giả định). Một số điểm cần biết khi chấm:
- `fall_enabled: true`. `dash` có thật. `score` có cả trong `tuning` và ở cấp ngoài của contract.
- `player.invuln` trong snapshot tính bằng giây còn lại.
- Sự kiện `night_start` phát ở tick 1. Dựng scenario không phát sự kiện.
- Điểm xuất phát Đêm 3 là (0, 0, −15) vì (0, 0, 0) nằm trong đĩa tầng 2.
- Khi chạy hết `--ticks`, file có thêm một snapshot cuối nếu tick cuối không rơi vào bội số của `--snapshot-every`.
- Id đèn lạ trong scenario bị bỏ qua. Có mảng `motes`/`shades`/`drifters` mà không nói `random_*` thì coi như `random_*: false`.

## Kiểm chứng và tài liệu

- [docs/evidence/phase2/EVIDENCE.md](docs/evidence/phase2/EVIDENCE.md): 18 kịch bản headless (chạy hai lần, so từng byte), hiệu năng, kết quả trong Chrome thật. Sinh lại bằng `npm run evidence`. Ảnh chụp: [docs/evidence/screens/](docs/evidence/screens/). Bằng chứng Phase 1: [docs/evidence/phase1/](docs/evidence/phase1/).
- [docs/SPEC-PHASE2.md](docs/SPEC-PHASE2.md): tiêu chí nghiệm thu cho từng mục của ticket và danh sách giả định.
- [docs/NOTES.md](docs/NOTES.md): nhật ký dùng AI, retro. Harness AI: [AGENTS.md](AGENTS.md), [.claude/skills/verify-game/SKILL.md](.claude/skills/verify-game/SKILL.md).
- Hồi quy Phase 1: [test/core.test.js](test/core.test.js) chạy lại mọi hành vi của Phase 1 với số chuẩn mới.

## Sáng tạo của tôi

Ngoài ticket, tôi chỉ thêm các chi tiết trình bày, nằm hoàn toàn ở lớp web và không ảnh hưởng đầu ra headless:
- Lời dẫn của Ông Đăng trước mỗi Đêm; thông báo ngắn khi có sự kiện.
- Đom đóm rơi nhấp nháy trước khi biến mất; vòng sáng Tỏa Sáng; vòng ranh giới vùng an toàn quanh đèn đã sáng.
- Nhạc nền và hiệu ứng được tổng hợp bằng mã (Web Audio), không dùng file âm thanh.

Bằng chứng phần cũ vẫn đúng: `npm test` (33 test), `npm run evidence` (18 kịch bản), `browser-check.mjs`.

## Giới hạn đã biết

- Âm thanh chưa được nghe thử (môi trường làm bài không có loa). Cài đặt âm lượng và độ nhạy chuột chưa có test tự động.
- Chưa chơi hết một Đêm bằng tay, nên độ khó của 3 Đêm chưa được đánh giá.
- 60 FPS ở 1280×720 đo trong Chrome headless trên GPU của máy làm bài. Chưa đo trên máy khác.
- Chưa có bộ test ẩn của giảng viên để đối chiếu; các chỗ đề mơ hồ là giả định của tôi.
- Ở Đêm 3, Bóng Mực không biết leo dốc nên có thể bị kẹt dưới vách khi Mây ở tầng cao.
- Chưa có video demo (Phase 4).
