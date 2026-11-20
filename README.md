# Đảo Đèn Lồng (Phase 3: Đèn cạn dầu)

Game 3D góc nhìn thứ ba chạy trên trình duyệt. **Mây**, người giữ đèn nhỏ tuổi, gom đom đóm, thắp các **Đèn Lồng Lớn** trên ba hòn đảo (Đảo Bến, Đảo Cau, Đảo Chuông) và **giữ cho đảo sáng tới bình minh**, trong khi **Bóng Mực** hút dầu đèn và **Gió Lạc** cướp đom đóm.
Bài lab AI-SDLC Day 12, cá nhân (2A202603608). Đề lab gốc: [docs/LAB-README.md](docs/LAB-README.md).

- Bản chơi trực tuyến (Claude Artifact): https://claude.ai/artifact/LcX17RrMrfnZyxtPATJchU (riêng tư, cần quyền truy cập)
- Video demo: chưa có (dành cho Phase 4).

## Cài đặt và chạy (3 lệnh)

Cần Node.js 18 trở lên (macOS, Linux, Windows).

```bash
npm install        # cài three.js
npm start          # mở http://localhost:8080
npm test           # 51 test, tất cả phải đạt
```

Cổng khác: `PORT=3000 npm start`. Thêm `?seed=123` để cố định seed, `?night=2` để vào thẳng Đêm 2 (không qua menu).

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D (hoặc mũi tên lên/xuống) | Đi, theo hướng camera |
| Space | Nhảy (chỉ khi đang chạm đất) |
| Shift | Lướt (14 m/s trong 0,2 s, hồi chiêu 1,5 s) |
| E | Nạp ánh sáng vào đèn tối, hoặc châm dầu cho đèn đang sáng, trong tầm 2 m |
| F | Tỏa Sáng: xua Bóng Mực (tốn 3 đom đóm) |
| ← / → hoặc kéo chuột | Xoay camera (độ nhạy chuột chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng. R: chơi lại Đêm |

## Luật chơi và cách tính điểm

Số liệu chuẩn của Ticket-02 và Ticket-03 (nguồn duy nhất: [src/tuning.js](src/tuning.js), khớp [game.contract.json](game.contract.json)).

- **Mục tiêu**: còn sống lúc bình minh và có ít nhất **60% số đèn còn sáng** (3/5, 4/6, 5/7). Đêm dài 240 / 270 / 300 s và **không còn thắng sớm**: thắp đủ đèn không kết thúc đêm.
- **Nhiên liệu**: đèn mới thắp có 100 dầu và hao 1 dầu mỗi giây. Hết dầu thì đèn tắt. Bấm E ở đèn đang sáng để **châm dầu**: mỗi đom đóm cho 10 dầu. Đèn nào dầu dưới 30 thì nhấp nháy và **mất vùng an toàn**.
- **Thắp**: đèn chưa từng sáng cần **10** đom đóm, đèn đã từng sáng chỉ cần **5** để thắp lại.
- **Sức chứa** bắt đầu 10, tăng 2 sau mỗi lần thắp thành công (tính cả thắp lại), tối đa 20, về 10 mỗi đêm.
- **Bóng Mực** (4 m/s, Đêm 3: 4,5 m/s) đuổi Mây trong 12 m. Khi rảnh, nó đi tới đèn yếu nhất, đứng cạnh và **hút 5 dầu mỗi giây** (nhiều con cộng dồn). Mây lại gần (6 m) thì nó quay sang đuổi. Chạm Mây là mất 1 Ngọn Lửa (có 3), đánh rơi một nửa đom đóm đang mang, rồi bất tử 1,5 s.
- **Tỏa Sáng** (3 đom đóm, bán kính 5 m, hồi chiêu 3 s): Bóng Mực trong tầm bị choáng 2 s và bị đẩy lùi 4 m. Choáng không gây sát thương.
- **Vùng an toàn**: quanh đèn sáng có từ 30 dầu trở lên, bán kính 6 m, Bóng Mực không vào được. Châm dầu lên tới 30 khi bóng đang đứng trong vùng thì nó bị đẩy ra và không gây sát thương trong lúc đó.
- **Rơi khỏi đảo**: mất 1 Ngọn Lửa và toàn bộ đom đóm, chờ 1 s rồi hồi sinh ở điểm xuất phát, bất tử 1,5 s.
- **Gió Lạc** (Đêm 2, 3), **Bùa Gió**, **bục nhảy** (Đêm 2, 3), **gió mạnh** (Đêm 3): xem [docs/SPEC-PHASE2.md](docs/SPEC-PHASE2.md).
- **Điểm**: +5 mỗi đom đóm nạp vào đèn hoặc châm dầu; +100 khi thắp lần đầu một đèn; +40 khi thắp lại; +5 mỗi Bóng Mực trúng Tỏa Sáng (+15 nếu nó đang hút dầu). Khi thắng ở bình minh: mỗi đèn còn sáng +50 cộng phần nguyên của dầu còn lại, mỗi Ngọn Lửa còn lại +50. Không còn thưởng thời gian. Tổng điểm game là tổng điểm các Đêm đã thắng.
- **Thua**: hết Ngọn Lửa (ngay lập tức), hoặc hết giờ mà số đèn sáng dưới ngưỡng. Thua thì chơi lại Đêm đó. Thắng Đêm 3 thì tới màn Bình Minh.
- **Bảng màu dễ phân biệt** (Cài đặt, được lưu): viền và mắt Bóng Mực thành xanh lam #00B3FF, cảnh báo UI thành màu trắng kèm ⚠. Đèn tắt luôn bị xẹp 20% và có vết rách, đèn sắp hết dầu nhấp nháy, nên không cần dựa vào màu.

## Chế độ headless và Test Contract v1.2

```bash
node src/headless.js --seed 42 --night 1 [--scenario s.json] [--inputs i.json] --ticks 600 --out out/run.jsonl [--snapshot-every 10]
```

`--night` nhận 1, 2, 3. Mã thoát: 0 thành công, 2 file inputs/scenario sai định dạng, 1 lỗi khác (kèm thông báo stderr). Một Đêm đầy đủ chạy trong khoảng 0,4 giây.
Lõi mô phỏng [src/sim.js](src/sim.js) dùng chung cho headless và web. Các chỗ đề chưa nêu rõ và cách tôi chọn: [docs/SPEC-PHASE2.md](docs/SPEC-PHASE2.md), [docs/SPEC-PHASE3.md](docs/SPEC-PHASE3.md) (mục Giả định). Một số điểm cần biết khi chấm:
- `fall_enabled: true`. `score` có cả trong `tuning` và ở cấp ngoài của contract; `per_second_left` là 0 vì thưởng thời gian đã bỏ.
- `player.invuln` trong snapshot tính bằng giây còn lại. Fuel của đèn trong snapshot là số thực 1 chữ số thập phân.
- Dầu được tính bằng số nguyên 1/60 bên trong, nên các biên "đúng 30" và "đúng 100" không bị sai số.
- Vì đèn hao ở bước 2 của mỗi tick, đèn chỉ "đầy dầu" đúng tick vừa thắp hoặc vừa châm đầy; ở tick sau nó đã là 99,98 và vẫn nhận 1 đom đóm.
- Sự kiện `night_start` phát ở tick 1. Dựng scenario không phát sự kiện. Đèn đặt bằng scenario không tính vào "lần thắp thành công".
- Điểm xuất phát Đêm 3 là (0, 0, −15) vì (0, 0, 0) nằm trong đĩa tầng 2.
- Khi chạy hết `--ticks`, file có thêm một snapshot cuối nếu tick cuối không rơi vào bội số của `--snapshot-every`.
- Id đèn lạ trong scenario bị bỏ qua. Có mảng `motes`/`shades`/`drifters` mà không nói `random_*` thì coi như `random_*: false`.

## Kiểm chứng và tài liệu

- [docs/evidence/phase3/EVIDENCE.md](docs/evidence/phase3/EVIDENCE.md): 28 kịch bản headless (chạy hai lần, so từng byte), hiệu năng, kết quả trong Chrome thật. Sinh lại bằng `npm run evidence`. Ảnh chụp: [docs/evidence/screens/](docs/evidence/screens/). Bằng chứng Phase 1, 2: [phase1](docs/evidence/phase1/), [phase2](docs/evidence/phase2/).
- Quyết định thiết kế: [docs/ADR-0001-lantern-fuel-and-dawn-win.md](docs/ADR-0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích và test cũ đã sửa hoặc xóa: [docs/CHANGELOG.md](docs/CHANGELOG.md).
- Tiêu chí nghiệm thu: [docs/SPEC-PHASE3.md](docs/SPEC-PHASE3.md), [docs/SPEC-PHASE2.md](docs/SPEC-PHASE2.md).
- Nhật ký dùng AI, retro: [docs/NOTES.md](docs/NOTES.md). Harness AI: [AGENTS.md](AGENTS.md), [.claude/skills/verify-game/SKILL.md](.claude/skills/verify-game/SKILL.md).
- Hồi quy: `test/core.test.js` (Phase 1), `test/phase2.test.js`, `test/phase3.test.js`.

## Sáng tạo của tôi

Ngoài ticket, tôi chỉ thêm các chi tiết trình bày, nằm hoàn toàn ở lớp web và không ảnh hưởng đầu ra headless:
- Lời dẫn của Ông Đăng trước mỗi Đêm; thông báo ngắn khi có sự kiện.
- Đom đóm rơi nhấp nháy trước khi biến mất; vòng sáng Tỏa Sáng; vòng ranh giới vùng an toàn (chỉ hiện khi đèn còn từ 30 dầu); Bóng Mực cúi người khi đang hút dầu.
- Nhạc nền và hiệu ứng âm thanh được tổng hợp bằng mã (Web Audio), không dùng file âm thanh.

Bằng chứng phần cũ vẫn đúng: `npm test` (51 test), `npm run evidence` (28 kịch bản), `scripts/browser-check.mjs`.

## Giới hạn đã biết

- Âm thanh chưa được nghe thử (môi trường làm bài không có loa). Cài đặt âm lượng và độ nhạy chuột chưa có test tự động.
- Chưa chơi hết một Đêm bằng tay, nên độ khó chưa được đánh giá, nhất là Đêm 3 với luật hút dầu mới.
- 60 FPS ở 1280×720 đo trong Chrome headless trên GPU của máy làm bài. Chưa đo trên máy khác.
- Chưa có bộ test ẩn của giảng viên để đối chiếu; các chỗ đề mơ hồ là giả định của tôi.
- Ở Đêm 3, Bóng Mực không biết leo dốc nên có thể bị kẹt dưới vách khi Mây ở tầng cao.
- Chưa có video demo (Phase 4).
