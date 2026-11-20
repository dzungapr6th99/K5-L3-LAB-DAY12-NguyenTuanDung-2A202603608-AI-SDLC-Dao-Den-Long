# Đặc tả Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1)

Mỗi mục có tiêu chí nghiệm thu (AC) và cách kiểm chứng. Mã `T:` là test trong `test/`, mã `E:` là kịch bản trong `docs/evidence/phase2/`, `B:` là kiểm tra bằng Chrome thật (`scripts/browser-check.mjs`).

## Phần 1: Số liệu chuẩn và thứ tự tick

| Mục | AC | Kiểm chứng |
|---|---|---|
| Số liệu | `src/tuning.js` = bảng Phần 1; `game.contract.json` khớp từng khóa, có thêm `dash_*`, `night2/3_duration_s`, `contract_version: "1.1"` | T: "Contract v1.1" |
| Di chuyển | 6.0 m/s, dừng ngay (≤ 0.1 s), điều khiển trên không đầy đủ, camera yaw xoay hướng, vector dài > 1 được chuẩn hóa | T: movement, jump |
| Nhảy | vy 7.0, g −20, chỉ nhảy khi chạm đất | T: jump (đỉnh ≈ 1.225 m, bấm lần hai trên không bị bỏ qua) |
| Lướt | 14 m/s trong 12 tick theo hướng đang đi (đứng yên thì hướng đang quay mặt, +Z lúc đầu); hồi chiêu 90 tick từ lúc bắt đầu; bấm khi đang lướt bị bỏ qua; trên không giữ nguyên độ cao; không bất tử; sự kiện `dash {}` | T: dash; E08 |
| Đom đóm | Nhặt khi XZ ≤ 1.0 và chênh cao ≤ 1.5; sức chứa 10; 20 lúc đầu tại 20 điểm khác nhau; tick 240, 480… thêm 1 ở điểm trống nếu < 30, hết điểm trống thì bỏ lượt | T: pickup, random motes; E01 |
| Đèn | Chi phí 10, nạp nhiều lần và đèn nhớ; tầm 2.0 m; min(đang mang, còn thiếu); chỉ đèn chưa sáng; gần nhất, hòa thì id nhỏ | T: deposit; E02 |
| Vùng an toàn | Đèn sáng tạo vùng 6 m: Bóng Mực ngoài bị chặn ở mép; bóng đang ở trong lúc đèn vừa thắp bị đẩy ra trong ≤ 30 tick và không gây sát thương | T: safe zone; E06 |
| Tỏa Sáng | 3 đom đóm, hồi chiêu 180 tick, tâm = chân + 0.8, mục tiêu chốt tại tick kích hoạt (3D ≤ 5), choáng 120 tick, đẩy 4 m trong 15 tick đầu, làm mới khi trúng lại, +5 mỗi con mỗi lần, không đủ đom đóm thì không kích hoạt | T: pulse; E03 |
| Bóng Mực | 4.0 m/s (Đêm 3: 4.5), phát hiện 12 m, bỏ đuổi 18 m; hit khi XZ ≤ 1.0 và chênh cao ≤ 1.5; tối đa 1 lần mất lửa mỗi tick; recoil 2 m trong 60 tick; lịch sinh 2 con tại tick 300 rồi mỗi khoảng sinh; id S1, S2… theo thứ tự sinh; trạng thái `spawning, wander, chase, recoil, stunned` | T: shade AI, spawns, hit; E04, E18 |
| Bị đánh | −1 ngọn lửa, rơi floor(n/2) đom đóm ra vành 1.5–2.5 m (sống 480 tick, nhặt lại từ tick sau), bất tử 90 tick | T: being hit, dropped motes; E04 |
| Rơi khỏi đảo | Y < −10: đúng 1 lần, bỏ qua bất tử, −1 ngọn lửa, mất hết đom đóm (`lost`), chờ 60 tick, hồi sinh ở điểm xuất phát bất tử 90 tick; hết lửa thì thua ngay | T: falling; E07 |
| Thắng/thua | Sau mỗi tick: hết lửa → thua `no_flames`; còn sống và đủ đèn → thắng (kể cả đúng tick hết giờ); hết giờ → `dawn`. Điểm: +10/đom đóm nạp, +100/đèn, +5/Bóng Mực trúng Tỏa Sáng, thắng: floor(giây còn lại) × 2 + 50 × lửa | T: win, lose; E02, E05 |
| Thứ tự tick | Đọc input (pause trước) → giảm bộ đếm → di chuyển + rơi → nhặt → đèn → vùng an toàn → Tỏa Sáng → di chuyển bóng/Gió Lạc → chạm (Gió Lạc trước) → sinh → thắng/thua → snapshot; thực thể mới chỉ tương tác từ tick sau | `src/sim.js` (chú thích số bước 1–11) |

## Phần 2: Bản đồ chuẩn

| Mục | AC | Kiểm chứng |
|---|---|---|
| Đêm 1 | Đảo r 40, xuất phát (0,0,0) quay +Z, 5 đèn đúng tọa độ, 24 điểm đom đóm (8 × r12, 16 × r33), 12 điểm Bóng Mực r37, sinh mỗi 480 tick, tối đa 6 | T: spawns, random motes |
| Đêm 2 | Hai đảo r 28 tại (0,0,0) và (70,0,0), cầu x∈[26,44] z∈[−2,2] không lan can (bước ra mép thì rơi); 6 đèn L1–L6; 2 bục nhảy (vy 14, 24 m/s về tâm đảo kia, phím không ghi đè, vẫn lướt được); Bóng Mực mỗi 420 tick, tối đa 8; 330 s | T: Night 2 map, pad; E09, E10 |
| Đêm 3 | Đảo r 45, 3 tầng (0 / 3 vành 12–24 nửa z>0 / 6 đĩa r8), vách đứng, 2 dốc rộng 3 m ở 30° và 150° (r30→r24), bục nhảy (0,3,13) vy 12 / 8 m/s về −Z đáp lên tầng 2, tháp chuông r2 cao 8 không leo được; 7 đèn; 30 điểm đom đóm; 16 điểm Bóng Mực r43 mỗi 360 tick, tối đa 10; 360 s | T: Night 3 map, pad; E11, E12 |
| Gió mạnh (Đêm 3) | Mỗi 30 s một cơn 5 s theo hướng ngẫu nhiên đẩy 2 m/s; snapshot `wind {active, dir_deg}`; báo trước 2 s bằng lá bay (web) | T: wind; E13; B: ảnh |

## Phần 3: Tính năng mới

| Mục | AC | Kiểm chứng |
|---|---|---|
| Gió Lạc | Đêm 2, 3; tối đa 2, sinh tại tick 1200, 2400…, id D1, D2…; `idle` (2 m/s) → `chase` khi mang ≥ 5 và ≤ 15 m (kiểm tra mỗi tick, mất điều kiện về idle); chạm XZ ≤ 1.2 cướp min(3, n) một lần rồi `flee` 7 m/s trong 240 tick và biến mất cùng đồ; Tỏa Sáng trúng lúc `chase` thì `flee` không cướp, trúng lúc `flee` có đồ thì thả hết (đom đóm rơi) và biến mất sau 120 tick; không mất lửa; vùng an toàn và bất tử không ngăn cướp; sự kiện `drifter_steal`, `drifter_drop` | T: drifter (2 test); E14, E15 |
| Bùa Gió | Đêm 2: (35,0,0); Đêm 3: (30,0,25), (−30,0,25); id C1, C2; nhặt như đom đóm; 600 tick (nhặt lại làm mới); chạy 7.2 m/s; lướt không hồi chiêu (vẫn phải bấm lại, bấm khi đang lướt bị bỏ qua); xuất hiện lại sau 2700 tick; sự kiện `charm_picked` | T: charm; E16 |
| Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 hiện Bình Minh với tổng điểm; thua thì chơi lại Đêm đó; tổng điểm = tổng điểm các Đêm đã thắng | B: menu, win overlay |
| Tạm dừng | Esc/P: logic dừng hoàn toàn (tick tăng, `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `paused`; sự kiện `paused`/`resumed`); menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | T: pause; E17; B: Esc dừng/tiếp tục ở cả 3 Đêm |
| Cài đặt | Âm lượng, độ nhạy chuột, lưu giữa các lần mở (`localStorage`) | Xem tay (chưa có test tự động) |
| Âm thanh | Nhạc nền đêm; hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối. Tổng hợp bằng Web Audio, không dùng file âm thanh | Chưa nghe thử (xem README) |
| HUD | Ngọn Lửa (trên trái), đồng hồ mm:ss (trên giữa, đỏ + nhấp nháy khi ≤ 30 s), đèn k/n và điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt/Tỏa Sáng (dưới phải), nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn chưa sáng gần nhất khi ở ngoài màn hình | B: ảnh chụp 3 Đêm |
| Bảng màu | Màu chuẩn của các thành phần liệt kê (`web/world.js`, `PAL`); ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng) | Đọc mã (`PAL`, `ambient.intensity`); ảnh chụp |

## Phần 4: Test Contract v1.1

| Mục | AC | Kiểm chứng |
|---|---|---|
| CLI | `--night` 1/2/3 (khác thì exit 1); file sai định dạng exit 2 | T: malformed |
| Snapshot | Thêm `night`, `wind`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`, mảng `motes` (id, pos, kind, ttl_s), `drifters` (id, pos, state, stolen), `charms` (id, available, respawn_s) | T: v1.1 snapshot fields |
| Scenario | Thêm `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `drifters`, `charms`, `random_drifters`, `wind_enabled` | T: các test dùng scenario; malformed |
| Input | Thêm `dash`, `pause` (kích hoạt khi false → true) | T: dash, pause |
| Sự kiện mới | `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` do rơi có thêm `lost` | T tương ứng |
| Hiệu năng | Một Đêm đầy đủ (≤ 21.600 tick) headless ≤ 30 s; bản web ≥ 30 FPS ở 1280×720 | T: performance (≈ 0.4 s); B: 60 FPS trên GPU thật |

## Giả định (chỗ đề chưa nêu rõ)

1. **Góc**: vị trí = (r·cos a, y, r·sin a) trên XZ (a đo từ +X về phía +Z). Khớp yêu cầu "tầng 1 ở nửa z > 0 có điểm 20°–160°".
2. **Điểm xuất phát Đêm 3**: (0,0,−15) trên tầng 0, vì (0,0,0) nằm trong đĩa tầng 2.
3. **Đo khoảng cách**: đèn, đom đóm, Bùa và Gió Lạc dùng XZ (kèm chênh cao ≤ 1.5 cho đom đóm, Bùa, Bóng Mực); Tỏa Sáng dùng 3D.
4. **Bóng Mực**: `spawning` kéo dài 60 tick (đứng yên, không gây sát thương); `wander` đi 1.5 m/s đổi hướng mỗi 120 tick; bóng đang bị đẩy ra khỏi vùng an toàn giữ nguyên tên trạng thái (cờ riêng); bóng giữ nguyên tầng của nó (không rơi, không leo vách), nên ở Đêm 3 bóng có thể bị kẹt dưới vách khi người chơi ở tầng cao.
5. **Điểm sinh hợp lệ của Bóng Mực**: cách Mây ≥ 15 m (mọi Đêm), không nằm trong vùng an toàn của đèn đã sáng, không trùng bóng khác.
6. **Gió**: cơn gió bắt đầu tại sim_tick 1800k, kéo dài 300 tick, hướng nguyên độ chọn ngẫu nhiên sau cơn trước; `wind.dir_deg` là hướng của cơn hiện tại hoặc sắp tới; gió cộng 2 m/s vào vận tốc ngang kể cả khi lướt.
7. **Gió Lạc**: sinh tại các điểm sinh Bóng Mực của bản đồ ("điểm sương"), cao 1.5 m, bay không chịu trọng lực.
8. **`player.invuln`** trong snapshot tính bằng giây còn lại (giống `dash_cd_s`).
9. **Sự kiện `night_start`** phát ở tick 1 (dựng scenario không phát sự kiện). Khi tạm dừng, sự kiện ghi theo `tick` tổng; mọi input khác bị bỏ qua nhưng vẫn cập nhật trạng thái nút để không kích hoạt lại khi tiếp tục.
10. **Rơi khỏi đảo**: trong 60 tick chờ, Mây đứng yên tại chỗ (không nhặt, không bị chạm, không nạp đèn, không tỏa sáng).
11. **Scenario**: nếu có mảng `motes`/`shades`/`drifters` mà không nói `random_*` thì coi như `random_*: false`. Id đèn lạ bị bỏ qua. `shades[]` không nêu `state` thì ở `wander` (hoạt động ngay).
12. **Điểm**: tính theo tick nguyên (giây còn lại = floor(tick còn lại / 60)). Điểm headless là điểm của Đêm đó; "tổng điểm" chỉ có ở bản web.
13. **Địa hình**: bước lên tối đa 0.35 m; vách cao hơn thì chặn đi ngang, bước ra mép thì rơi xuống tầng dưới; tháp chuông chặn như vách.
14. **Lời Ông Đăng** và các đoạn thoại là văn bản tự viết.
