# Changelog

## Phase 4: Ticket-04 "Bình minh" (Contract v1.3), phát hành v1.0.0

Không có thay đổi phá vỡ tương thích với luật chơi, số liệu hay đầu ra headless của Phase 1 đến 3. Contract v1.3 chỉ thêm `bench_cmd` và `soak_cmd`, và `run_cmd` đổi thành `node server.js` (để `--export-leaderboard` chạy trực tiếp).

### Thêm mới
- **Benchmark** (`npm run bench`, `scripts/bench.mjs`, `bench.json`): cảnh chuẩn 200 Bóng Mực + 100 đom đóm, số đo theo định nghĩa của ticket (`src/benchstats.js`).
- **Soak test** (`npm run soak`, `scripts/soak.js`, `soak.json`): 10 Đêm liên tiếp, đầu vào ngẫu nhiên theo seed.
- **Bảng xếp hạng cục bộ** (`src/leaderboard.js`, `server.js`): nhập tên sau Bình Minh hoặc khi thua, top 10, ghi ra đĩa, lệnh `--export-leaderboard`, màn hình ở menu chính.
- **Dễ tiếp cận**: đổi phím có phát hiện trùng và khôi phục mặc định (`src/keybinds.js`); chỉ báo hình ảnh cho Bóng Mực xuất hiện, gió, 10 giây cuối và đèn sắp hết dầu; giảm chuyển động; cỡ chữ tối thiểu 18 px và tùy chọn chữ lớn ×1,25.
- **Đóng gói**: thư mục web tĩnh (`npm run pack`), `Dockerfile`, `docs/RELEASE-v1.0.0.md`, README đầy đủ, `docs/RETRO.md`.
- 17 test mới (68 test tổng): 6 bảng xếp hạng, 6 đổi phím, 5 benchmark và soak.

### Thay đổi bên trong
- Hiệu năng (tìm ra nhờ benchmark): Bóng Mực và đom đóm vẽ bằng `InstancedMesh`; mây gộp một draw call; HUD bỏ `backdrop-filter` và chỉ ghi DOM khi giá trị đổi. Benchmark từ `p1_low_fps` 5 lên 49.
- `sim.js` có thêm tùy chọn `bench` (chỉ web dùng, CLI headless không bao giờ dùng).
- `scripts/make-contract.mjs` sinh `game.contract.json` từ `src/tuning.js`.
- Phím P không còn là phím tạm dừng thứ hai (đổi phím thay thế); phím tạm dừng mặc định là Esc.
- Gợi ý phím cố định ở góc dưới trái bị bỏ để chữ HUD đạt 18 px.

## Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### Thay đổi phá vỡ tương thích (breaking changes)

| # | Trước (Phase 2) | Sau (Phase 3) | Ảnh hưởng |
|---|---|---|---|
| 1 | Thắng ngay khi mọi đèn sáng (`game_over.reason: "all_lit"`) | Không còn thắng sớm. Thắng khi hết giờ nếu còn sống và đèn sáng ≥ ceil(0,6 × n); `reason: "dawn_survived"`. `all_lit` không còn dùng | Mọi test "thắng sớm" bị xóa |
| 2 | Đèn đã sáng không nhận thêm đom đóm; sáng vĩnh viễn | Đèn hao 1 fuel/s, tắt khi hết dầu, châm dầu được (+10 fuel/đom đóm) | Snapshot đèn có `fuel`, `ever_lit`, `relit_count`; sự kiện `refuel`, `lantern_out` |
| 3 | Thắp đèn luôn cần 10 đom đóm | Đèn từng sáng (`ever_lit`) chỉ cần 5; `lantern_lit` có `relight` | Dữ liệu sự kiện đổi |
| 4 | Vùng an toàn: mọi đèn đang sáng | Chỉ đèn sáng có fuel ≥ 30 | Test vùng an toàn dùng fuel mặc định 100 nên không đổi |
| 5 | `wander` đi ngẫu nhiên | `wander` đi tới đèn yếu (fuel < 30), rồi tới đèn tắt gần nhất; thêm trạng thái `drain` | Snapshot bóng có `target_lantern_id` và trạng thái `drain`; sự kiện `fuel_drain` |
| 6 | Sức chứa cố định 10 | 10 + 2 × lần thắp thành công, tối đa 20 | `player.capacity` trong snapshot |
| 7 | Thời gian Đêm 300 / 330 / 360 s | 240 / 270 / 300 s | `tuning.night*_duration_s` |
| 8 | Điểm: +10/đom đóm nạp, +100/đèn, +5/stun, thưởng giờ ×2, thưởng ngọn lửa 50 | +5/đom đóm nạp hoặc châm, +100 thắp lần đầu, +40 thắp lại, +5/stun (+15 nếu đang hút), bình minh: +50 + floor(fuel) mỗi đèn sáng, +50 mỗi ngọn lửa; bỏ thưởng giờ | `tuning.score` (`per_mote` 5, `per_second_left` 0, thêm `per_relight`, `per_stun_drain`, `per_lit_lantern_dawn`) |
| 9 | Contract 1.1 | Contract 1.2: thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` | `game.contract.json` |

### Test cũ bị luật mới làm sai (xử lý, không bỏ qua)

| Test | Xử lý | Lý do |
|---|---|---|
| `core`: "exit 0, tick-0 snapshot…" | Sửa 300 → 240 | Thời gian Đêm 1 đổi (mục 7) |
| `core`: "deposit: … +10 per mote" | Sửa điểm 40 → 20 và 130 → 115, đổi tên | Điểm +5 mỗi đom đóm (mục 8) |
| `core`: "win: all lit, bonus floor(seconds)*2 + 50*flames…" | **Xóa** | Thắng sớm và thưởng thời gian không còn (mục 1, 8). Thay bằng các test dawn trong `phase3.test.js` |
| `phase2`: "Night 2 map … 330 s" | Sửa 330 → 270 | Mục 7 |
| `phase2`: "Night 3 map … 360 s" | Sửa 360 → 300 | Mục 7 |
| `phase2`: "Contract v1.1 …" | Viết lại thành "Contract v1.2" | Mục 9 |
| `scripts/evidence.js` E02 (thắng khi đủ đèn) | Thay bằng "đèn đầu tiên" khẳng định không còn thắng sớm | Mục 1 |

Không có test nào bị `skip`. Các test còn lại của Phase 1 và 2 không đổi và vẫn đạt.

### Thêm mới

- Nhiên liệu đèn, châm dầu, thắp lại, Bóng Mực hút dầu, sức chứa tăng dần (`test/phase3.test.js`, 19 test).
- Web: thanh dầu trên đèn, đèn nhấp nháy (1 Hz) khi fuel < 30, đèn tắt bị xẹp 20% và có vết rách, HUD "đang mang / sức chứa" và "đèn sáng / cần", nhắc "E — Châm dầu", cài đặt "Bảng màu dễ phân biệt" (viền và mắt Bóng Mực #00B3FF, cảnh báo trắng kèm ⚠), được lưu.

## Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Số liệu chuẩn, 3 bản đồ, lướt, bục nhảy, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng, cài đặt, âm thanh, HUD đầy đủ. Xem [SPEC-PHASE2.md](SPEC-PHASE2.md).

## Phase 1: PRD-0 (Contract v1.0)

Game Đêm 1 và chế độ headless. Xem `git show phase-1:README.md`.
