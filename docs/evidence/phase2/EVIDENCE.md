# Bằng chứng Phase 2 (Ticket-02, Contract v1.1)

Sinh tự động bởi `npm run evidence`. Mỗi dòng: chạy CLI headless thật (`node src/headless.js --seed 42 --night N ...`) hai lần, so sánh từng byte, rồi kiểm tra kết quả với yêu cầu của ticket.
Output JSONL, scenario và inputs nằm trong thư mục này. Chạy lại ở tag `phase-2` cho cùng kết quả (sha256 giống nhau).

## Kịch bản headless

| Mã | Yêu cầu được chứng minh | Kết quả chạy | sha256 | 2 lần chạy | Đánh giá |
|---|---|---|---|---|---|
| E01-pickup | Số liệu: nhặt ≤ 1.0 m, sức chứa 10 | Đêm 1: `playing`, 3 tick, điểm 0 | 663638a554 | giống hệt | ĐẠT |
| E02-deposit-win | Đèn: nạp nhiều lần, +10/đom đóm, +100/đèn, thắng + thưởng giờ/ngọn lửa | Đêm 1: `won`, 1 tick, điểm 498 | b99a2f5bca | giống hệt | ĐẠT |
| E03-pulse | Tỏa Sáng: 3 đom đóm, 3D ≤ 5 m, choáng 120 tick, đẩy 4 m, +5/con | Đêm 1: `playing`, 125 tick, điểm 5 | 38faf107cf | giống hệt | ĐẠT |
| E04-hit | Bị đánh: −1 ngọn lửa, rơi floor(n/2) đom đóm, bất tử 90 tick, lùi 2 m | Đêm 1: `playing`, 70 tick, điểm 0 | e4f482a196 | giống hệt | ĐẠT |
| E05-dawn | Hết giờ: thua (dawn) | Đêm 1: `lost`, 120 tick, điểm 0 | a840c3eb96 | giống hệt | ĐẠT |
| E06-safe-zone | Vùng an toàn 6 m chặn Bóng Mực | Đêm 1: `playing`, 300 tick, điểm 0 | 1108ef21dd | giống hệt | ĐẠT |
| E07-fall | Rơi khỏi đảo (Y < −10): 1 lần, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử 90 tick | Đêm 1: `playing`, 300 tick, điểm 0 | ecd67a6ede | giống hệt | ĐẠT |
| E08-dash | Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s từ lúc bắt đầu | Đêm 1: `playing`, 100 tick, điểm 0 | 9e664f8c43 | giống hệt | ĐẠT |
| E09-night2-bridge | Đêm 2: hai đảo + cầu tre không lan can, 6 đèn, 330 s | Đêm 2: `playing`, 800 tick, điểm 0 | 149682d89c | giống hệt | ĐẠT |
| E10-night2-pad | Đêm 2: bục nhảy vy 14 / 24 m/s bay sang đảo kia | Đêm 2: `playing`, 120 tick, điểm 0 | 5d6e7429c6 | giống hệt | ĐẠT |
| E11-night3-ramp | Đêm 3: leo dốc 30° lên tầng 1 (Y=3), 7 đèn, 360 s | Đêm 3: `playing`, 160 tick, điểm 0 | 3832d2a4fb | giống hệt | ĐẠT |
| E12-night3-cliff-pad | Đêm 3: vách đứng chặn đi lên; bục nhảy (0,3,13) đáp lên tầng 2 | Đêm 3: `playing`, 90 tick, điểm 0 | 5e7bcede88 | giống hệt | ĐẠT |
| E13-wind | Đêm 3: gió 5 s mỗi 30 s đẩy 2 m/s, snapshot wind | Đêm 3: `playing`, 2200 tick, điểm 0 | 364c9f52f4 | giống hệt | ĐẠT |
| E14-drifter-steal | Gió Lạc: đuổi khi mang ≥ 5, cướp min(3, n) một lần, bay đi 240 tick | Đêm 2: `playing`, 400 tick, điểm 0 | d9341c1b84 | giống hệt | ĐẠT |
| E15-drifter-pulse | Tỏa Sáng trúng Gió Lạc: chase → flee không cướp; flee mang đồ → thả hết | Đêm 2: `playing`, 130 tick, điểm 0 | c9541d5a8d | giống hệt | ĐẠT |
| E16-charm | Bùa Gió: 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | Đêm 2: `playing`, 2800 tick, điểm 0 | 0439a9be47 | giống hệt | ĐẠT |
| E17-pause | Tạm dừng: tick chạy, sim_tick/thời gian/spawn đứng yên, snapshot "paused" | Đêm 1: `playing`, 40 tick, điểm 0 | 9cdd02641d | giống hệt | ĐẠT |
| E18-spawn-schedule | Lịch sinh Bóng Mực: 2 con tại tick 300, rồi mỗi 480 tick (Đêm 1), tối đa 6 | Đêm 1: `playing`, 3300 tick, điểm 0 | a783e74bb1 | giống hệt | ĐẠT |

## Hiệu năng headless: một Đêm đầy đủ (giới hạn của ticket: ≤ 30 s)

| Bản đồ | Số tick | Trạng thái cuối | Thời gian | Đánh giá |
|---|---|---|---|---|
| Đêm 1 | 18000 | `lost` | 358 ms | ĐẠT |
| Đêm 2 | 18528 | `lost` | 520 ms | ĐẠT |
| Đêm 3 | 13269 | `lost` | 428 ms | ĐẠT |

## Test tự động

`npm test`: xem `test-output.txt` (hồi quy Phase 1 theo số chuẩn trong `test/core.test.js`, tính năng mới trong `test/phase2.test.js`).

## Bản web trong trình duyệt thật

Sinh bởi `scripts/browser-check.mjs` (Chrome điều khiển qua DevTools Protocol). Ảnh chụp trong `../screens/`.

```
ĐẠT  menu loads
ĐẠT  night 1: starts, simulates, W moves Mây (9.3 m), fps 60.0
ĐẠT  night 1: Esc pauses (sim_tick frozen at 275)
ĐẠT  night 1: Esc resumes
ĐẠT  night 2: starts, simulates, W moves Mây (8.8 m), fps 60.0
ĐẠT  night 2: Esc pauses (sim_tick frozen at 260)
ĐẠT  night 2: Esc resumes
ĐẠT  night 3: starts, simulates, W moves Mây (7.0 m), fps 60.0
ĐẠT  night 3: Esc pauses (sim_tick frozen at 262)
ĐẠT  night 3: Esc resumes
ĐẠT  all lanterns lit -> win overlay (Đêm kế tiếp)

Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe
GPU: real GPU (default ANGLE backend).
```

## Chưa kiểm chứng

- Chưa có bộ test ẩn của giảng viên để đối chiếu; các chỗ đề mơ hồ nằm trong `docs/SPEC-PHASE2.md` (mục Giả định).
- Chưa đo FPS trên máy khác ngoài máy làm bài; chưa chơi hết một Đêm bằng tay để đánh giá độ khó.
- Âm thanh được tổng hợp bằng Web Audio, chưa nghe thử trong phiên làm bài này (headless không có loa).
