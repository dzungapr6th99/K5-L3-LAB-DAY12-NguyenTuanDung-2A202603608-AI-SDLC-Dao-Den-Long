# Bằng chứng Phase 4 (Ticket-04 "Bình minh", Contract v1.3, v1.0.0)

Sinh tự động bởi `npm run evidence`. Mỗi dòng: chạy CLI headless thật (`node src/headless.js --seed 42 --night N ...`) hai lần, so sánh từng byte, rồi kiểm tra kết quả với yêu cầu của ticket.
Output JSONL, scenario và inputs nằm trong thư mục này. Chạy lại ở tag `phase-2` cho cùng kết quả (sha256 giống nhau).

## Kịch bản headless

| Mã | Yêu cầu được chứng minh | Kết quả chạy | sha256 | 2 lần chạy | Đánh giá |
|---|---|---|---|---|---|
| E01-pickup | Số liệu: nhặt ≤ 1.0 m, sức chứa 10 | Đêm 1: `playing`, 3 tick, điểm 0 | 648aa53619 | giống hệt | ĐẠT |
| E02-first-light | Ticket-03: đèn đầu tiên cần 10 đom đóm, +5/đom đóm +100; KHÔNG còn thắng sớm khi đủ đèn | Đêm 1: `playing`, 600 tick, điểm 150 | 6fbd1cfafb | giống hệt | ĐẠT |
| E03-pulse | Tỏa Sáng: 3 đom đóm, 3D ≤ 5 m, choáng 120 tick, đẩy 4 m, +5/con | Đêm 1: `playing`, 125 tick, điểm 5 | 654095bb5a | giống hệt | ĐẠT |
| E04-hit | Bị đánh: −1 ngọn lửa, rơi floor(n/2) đom đóm, bất tử 90 tick, lùi 2 m | Đêm 1: `playing`, 70 tick, điểm 0 | b7a2b189a9 | giống hệt | ĐẠT |
| E05-dawn | Hết giờ: thua (dawn) | Đêm 1: `lost`, 120 tick, điểm 0 | d76b2d26e4 | giống hệt | ĐẠT |
| E06-safe-zone | Vùng an toàn 6 m chặn Bóng Mực | Đêm 1: `playing`, 300 tick, điểm 0 | 96e816f8ce | giống hệt | ĐẠT |
| E07-fall | Rơi khỏi đảo (Y < −10): 1 lần, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử 90 tick | Đêm 1: `playing`, 300 tick, điểm 0 | 19c19fcc14 | giống hệt | ĐẠT |
| E08-dash | Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s từ lúc bắt đầu | Đêm 1: `playing`, 100 tick, điểm 0 | 315d491eaf | giống hệt | ĐẠT |
| E09-night2-bridge | Đêm 2: hai đảo + cầu tre không lan can, 6 đèn, 270 s (Ticket-03) | Đêm 2: `playing`, 800 tick, điểm 0 | 2c4e899895 | giống hệt | ĐẠT |
| E10-night2-pad | Đêm 2: bục nhảy vy 14 / 24 m/s bay sang đảo kia | Đêm 2: `playing`, 120 tick, điểm 0 | 2b9398d4ed | giống hệt | ĐẠT |
| E11-night3-ramp | Đêm 3: leo dốc 30° lên tầng 1 (Y=3), 7 đèn, 300 s (Ticket-03) | Đêm 3: `playing`, 160 tick, điểm 0 | d1f66349c5 | giống hệt | ĐẠT |
| E12-night3-cliff-pad | Đêm 3: vách đứng chặn đi lên; bục nhảy (0,3,13) đáp lên tầng 2 | Đêm 3: `playing`, 90 tick, điểm 0 | ba19355ec5 | giống hệt | ĐẠT |
| E13-wind | Đêm 3: gió 5 s mỗi 30 s đẩy 2 m/s, snapshot wind | Đêm 3: `playing`, 2200 tick, điểm 0 | a8434425c0 | giống hệt | ĐẠT |
| E14-drifter-steal | Gió Lạc: đuổi khi mang ≥ 5, cướp min(3, n) một lần, bay đi 240 tick | Đêm 2: `playing`, 400 tick, điểm 0 | 7e3b89b829 | giống hệt | ĐẠT |
| E15-drifter-pulse | Tỏa Sáng trúng Gió Lạc: chase → flee không cướp; flee mang đồ → thả hết | Đêm 2: `playing`, 130 tick, điểm 0 | afca3918af | giống hệt | ĐẠT |
| E16-charm | Bùa Gió: 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | Đêm 2: `playing`, 2800 tick, điểm 0 | b42d8f6aa7 | giống hệt | ĐẠT |
| E17-pause | Tạm dừng: tick chạy, sim_tick/thời gian/spawn đứng yên, snapshot "paused" | Đêm 1: `playing`, 40 tick, điểm 0 | 86356ed5db | giống hệt | ĐẠT |
| F01-fuel-burn | Nhiên liệu: đèn sáng = 100, hao 1/s; đèn tối fuel 0; snapshot có fuel, ever_lit, relit_count | Đêm 1: `playing`, 600 tick, điểm 0 | 05aba624fa | giống hệt | ĐẠT |
| F02-refuel | Châm dầu: used = min(mang, ceil((100−fuel)/10)), +10 fuel/đom đóm, +5 điểm/đom đóm, sự kiện refuel | Đêm 1: `playing`, 3 tick, điểm 25 | 1b4cd0502d | giống hệt | ĐẠT |
| F03-out-relight | Hết dầu: lantern_out, deposited 0, ever_lit giữ; thắp lại chỉ cần 5 (+40, relight: true) | Đêm 1: `playing`, 20 tick, điểm 65 | cb505507c2 | giống hệt | ĐẠT |
| F04-capacity | Sức chứa = 10 + 2 × lần thắp thành công (tối đa 20); đèn đặt bằng scenario không tính | Đêm 1: `playing`, 3 tick, điểm 150 | 9fd3517d66 | giống hệt | ĐẠT |
| F05-drain | Bóng Mực hút dầu: tới đèn yếu (<30), đứng yên, 5/s cộng 1/s hao, fuel_drain mỗi 60 tick, đèn tắt thì thả ra | Đêm 1: `playing`, 330 tick, điểm 0 | ee24bdfe14 | giống hệt | ĐẠT |
| F06-dawn-win | Thắng khi hết giờ nếu đèn sáng ≥ ceil(0.6 × n) (Đêm 1: 3/5); lý do dawn_survived; điểm bình minh | Đêm 1: `won`, 60 tick, điểm 597 | 11eff3772f | giống hệt | ĐẠT |
| F07-dawn-lose | Hết giờ với 2/5 đèn sáng: thua (dawn), không có điểm thưởng | Đêm 1: `lost`, 60 tick, điểm 0 | 535453260d | giống hệt | ĐẠT |
| F08-low-fuel-zone | Vùng an toàn cần fuel ≥ 30: đúng 30 vẫn còn, dưới 30 mất | Đêm 1: `playing`, 100 tick, điểm 0 | 3a397e8afe | giống hệt | ĐẠT |
| F09-drain-stun | Tỏa Sáng trúng Bóng Mực đang hút dầu: tổng +15 (thường +5) | Đêm 1: `playing`, 3 tick, điểm 15 | 0148434dd3 | giống hệt | ĐẠT |
| F10-refuel-push | Châm dầu lên ≥ 30 khi bóng trong vùng 6 m: đẩy ra ≤ 30 tick, không sát thương | Đêm 1: `playing`, 40 tick, điểm 25 | 695eafc0bc | giống hệt | ĐẠT |
| E18-spawn-schedule | Lịch sinh Bóng Mực: 2 con tại tick 300, rồi mỗi 480 tick (Đêm 1), tối đa 6 | Đêm 1: `playing`, 3300 tick, điểm 0 | ccd0406222 | giống hệt | ĐẠT |

## Hiệu năng headless: một Đêm đầy đủ (giới hạn của ticket: ≤ 30 s)

| Bản đồ | Số tick | Trạng thái cuối | Thời gian | Đánh giá |
|---|---|---|---|---|
| Đêm 1 | 14400 | `lost` | 344 ms | ĐẠT |
| Đêm 2 | 16200 | `lost` | 442 ms | ĐẠT |
| Đêm 3 | 18000 | `lost` | 577 ms | ĐẠT |

## Benchmark (bench.json, `npm run bench`)

| Chỉ số | Giá trị | Ngưỡng | Đánh giá |
|---|---|---|---|
| avg_fps | 192.4 | ≥ 60 | ĐẠT |
| p1_low_fps | 49 | ≥ 30 | ĐẠT |
| load_ms | 806 | ≤ 10000 | ĐẠT |
| frame_ms_p95 | 8.7 | (không có ngưỡng) | |
| frames | 5773 | | |
| peak_mem_mb | 830 | (không có ngưỡng) | |

Máy đo: win32 10.0.19045 x64; AMD Ryzen 5 5500U with Radeon Graphics x12; 7 GB RAM. Renderer: Chrome/157.0.8103.79; three.js r170 / WebGL: ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11). Đây là số đo trên máy làm bài, chỉ để tham khảo; máy chấm của giảng viên có thể khác.

## Soak test (soak.json, `npm run soak`)

| Chỉ số | Giá trị | Ngưỡng | Đánh giá |
|---|---|---|---|
| nights | 10 | 10 | ĐẠT |
| crashes | 0 | = 0 | ĐẠT |
| mem_start_mb → mem_end_mb | 37.4 → 40.8 (×1.09) | ≤ ×1.2 | ĐẠT |
| duration_s | 1.4 | | |

Kết quả từng Đêm: lost, lost, lost, lost, lost, lost, lost, lost, lost, lost. Đầu vào ngẫu nhiên theo seed gần như không bao giờ thắng, nên kết quả toàn lost là bình thường: soak kiểm tra độ ổn định, không kiểm tra độ khó.

## Test tự động

`npm test`: xem `test-output.txt` (hồi quy Phase 1 trong `test/core.test.js`, Phase 2 trong `test/phase2.test.js`, Phase 3 trong `test/phase3.test.js`, bảng xếp hạng `test/leaderboard.test.js`, đổi phím `test/keybinds.test.js`, benchmark và soak `test/bench.test.js`).

## Bản web trong trình duyệt thật

Sinh bởi `scripts/browser-check.mjs` (Chrome điều khiển qua DevTools Protocol). Ảnh chụp trong `../screens/`.

```
ĐẠT  menu loads
ĐẠT  night 1: starts, simulates, W moves Mây (9.3 m), fps 60.0
ĐẠT  night 1: Esc pauses (sim_tick frozen at 277)
ĐẠT  night 1: Esc resumes
ĐẠT  night 2: starts, simulates, W moves Mây (8.8 m), fps 60.0
ĐẠT  night 2: Esc pauses (sim_tick frozen at 253)
ĐẠT  night 2: Esc resumes
ĐẠT  night 3: starts, simulates, W moves Mây (7.0 m), fps 60.0
ĐẠT  night 3: Esc pauses (sim_tick frozen at 254)
ĐẠT  night 3: Esc resumes
ĐẠT  lit lantern burns fuel in the page (2400 -> 2309 units, about 1 per tick)
ĐẠT  HUD text is at least 18 px at 1280x720 (smallest 18 px)
ĐẠT  menu text is at least 18 px (smallest 18 px)
ĐẠT  large text option scales the UI (36 px)
ĐẠT  reduce-motion, colour-blind and large-text options apply and are saved
ĐẠT  rebind Nhảy to Z (saved)
ĐẠT  a clashing key is refused and reported
ĐẠT  a fixed key (camera arrow) is refused
ĐẠT  bindings and options survive a reload
ĐẠT  the rebound jump key works in the game
ĐẠT  "Khôi phục mặc định" restores the default keys
ĐẠT  a nearly-empty lantern shows a text indicator
ĐẠT  the last 10 s show a big countdown
ĐẠT  dawn with 3/5 lanterns lit -> "Bình minh" overlay (no early win)
ĐẠT  after losing, a name can be entered
ĐẠT  a too-short name is refused with a message
ĐẠT  a valid name is saved and the rank is shown
ĐẠT  the entry is on disk with name, score, nights_won, achieved_at, seed
ĐẠT  the leaderboard screen from the main menu lists it

Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe
GPU: real GPU (default ANGLE backend).
```

## Chưa kiểm chứng

- Chưa có bộ test ẩn của giảng viên để đối chiếu; các chỗ đề mơ hồ nằm trong `docs/SPEC-PHASE4.md` (mục Giả định).
- Chưa đo FPS trên máy khác ngoài máy làm bài; chưa chơi hết một Đêm bằng tay để đánh giá độ khó.
- Âm thanh được tổng hợp bằng Web Audio, chưa nghe thử trong phiên làm bài này (headless không có loa).
