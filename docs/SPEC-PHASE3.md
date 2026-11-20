# Đặc tả Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Phần thay thế và quyết định thiết kế: [ADR-0001](ADR-0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md). Đặc tả Phase 2 vẫn đúng cho phần không bị ticket này thay thế: [SPEC-PHASE2.md](SPEC-PHASE2.md).
Mã `T:` là test trong `test/phase3.test.js`, `E:`/`F:` là kịch bản trong `docs/evidence/phase3/`, `B:` là kiểm tra Chrome thật.

| Mục | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| 1. Nhiên liệu | Tối đa 100; vừa thắp = 100; hao 1/s theo tick (1/60); đèn đặt `lit: true` không nêu fuel thì 100; tính bằng số nguyên 1/60, chỉ làm tròn khi xuất (1 chữ số) | T: fuel; F01 |
| 1. Châm dầu | Bấm tương tác ở đèn sáng chưa đầy: `used = min(đang mang, ceil((100 − fuel) / 10))`, `fuel = min(100, fuel + 10 × used)`; sự kiện `refuel {lantern_id, amount, fuel}`; +5 điểm mỗi đom đóm; không mang gì thì không có sự kiện | T: refuel; F02 |
| 1. Chọn đèn | Chỉ xét đèn nhận được (chưa sáng, hoặc sáng chưa đầy); gần nhất, hòa thì id nhỏ | T: interaction picks |
| 1. Hết dầu | `fuel ≤ 0` ngay sau bước 2: đèn tắt, `deposited = 0`, sự kiện `lantern_out`, giữ `ever_lit` | T: lantern_out; F03 |
| 1. Thắp lại | Đèn `ever_lit` cần 5, đèn chưa từng sáng cần 10; `lantern_lit.relight`; `relit_count` tăng; +100 lần đầu, +40 thắp lại | T: first light / relight; F03 |
| 1. Hiển thị | Thanh dầu trên đèn sáng; fuel < 30 thì đèn và thanh dầu nhấp nháy 1 Hz | B: ảnh `night1-fuel.png`; đọc `web/world.js` |
| 2. Vùng an toàn | Đèn fuel < 30 mất vùng; đúng 30 vẫn còn | T: safe zone; F08 |
| 2. Chọn đèn yếu | Chỉ `wander` chọn: đèn sáng fuel < 30 gần nhất (hòa: id nhỏ), không có thì đèn tắt gần nhất; `chase` không đổi mục tiêu; `target_lantern_id` trong snapshot | T: shades go for weak lanterns |
| 2. Hút dầu | Cách đèn ≤ 2 m (XZ): `drain`, đứng yên, 5 fuel/s cộng dồn, đèn vẫn hao 1/s; `fuel_drain {lantern_id, shade_id, fuel}` mỗi 60 tick | T: drain, drain stacks; F05 |
| 2. Thoát drain | → `chase` nếu Mây trong 6 m; → `stunned` nếu trúng Tỏa Sáng (+15 tổng); → `wander` nếu đèn tắt, fuel ≥ 30 hoặc cách đèn > 2 m; hết choáng về `wander` | T: leaving drain; F09 |
| 2. Đẩy ra | Châm lên ≥ 30 khi có bóng trong 6 m: đẩy ra mép trong ≤ 30 tick, không sát thương | T: refuelling…pushes; F10 |
| 3. Luật thắng | 240 / 270 / 300 s; thắng khi còn sống lúc hết giờ và đèn sáng ≥ ceil(0,6 × n) (3/5, 4/6, 5/7), `dawn_survived`; không còn thắng sớm; thua khi hết lửa (kể cả tick cuối, `no_flames` ưu tiên) hoặc đèn dưới ngưỡng (`dawn`); đèn hết dầu đúng tick bình minh đã tắt khi đếm | T: dawn (2 test); F06, F07 |
| 4. Sức chứa | 10 + 2 × lần thắp thành công (kể cả thắp lại, không tính đèn đặt bằng scenario), tối đa 20, về 0 mỗi Đêm; HUD "mang / sức chứa" | T: capacity; B: ảnh |
| 5. Điểm | +5 mỗi đom đóm nạp hoặc châm; +100 / +40; Tỏa Sáng +5 (+15 tổng nếu đang hút); bình minh khi thắng: mỗi đèn sáng +50 + floor(fuel), mỗi ngọn lửa +50; bỏ thưởng thời gian | T: dawn score, score; F02, F06, F09 |
| 6. Mù màu | Cài đặt "Bảng màu dễ phân biệt" được lưu: viền và mắt Bóng Mực #00B3FF; cảnh báo UI #FFFFFF kèm ⚠; đèn tắt xẹp 20% và có vết rách; đèn sắp hết dầu nhấp nháy | B: tùy chọn áp dụng và được lưu; ảnh `settings-colorblind.png` |
| 7. Contract v1.2 | `contract_version: "1.2"`; `tuning` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` và thời gian Đêm mới; snapshot đèn có `fuel`, `ever_lit`, `relit_count`, `player.capacity`; scenario đèn có `lit`, `fuel`, `ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`; sự kiện mới; `all_lit` không còn dùng | T: Contract v1.2, malformed; `test/phase2.test.js` |
| Hồi quy | Test Phase 1 và 2 không bị thay thế vẫn đạt | `npm test` (51 test) |

## Giả định

1. **Wander tới đèn tắt**: "như trước" trong ticket hiểu là đi tới đèn tắt gần nhất và dừng cách đó 2 m. Tôi dùng tốc độ Bóng Mực (4,0 / 4,5 m/s), không phải 1,5 m/s như đi ngẫu nhiên. Nếu không có đèn tắt hay yếu thì đi ngẫu nhiên như Phase 2.
2. **Chọn lại mục tiêu mỗi tick**: bóng `wander` đổi mục tiêu ngay khi có đèn yếu hơn gần hơn. `target_lantern_id` trong scenario chỉ là giá trị khởi đầu (dùng cho `drain`).
3. **Bóng `drain` trong scenario**: nếu đèn mục tiêu có fuel ≥ 30 thì bóng được thả về `wander` ngay (theo quy tắc thoát drain).
4. **`fuel_drain`**: phát mỗi 60 tick kể từ lúc bóng bắt đầu hút (tick thứ 60, 120, … của riêng nó), mỗi bóng một sự kiện, `fuel` là giá trị sau khi trừ ở tick đó.
5. **Đèn "đầy dầu"**: vì đèn hao ở bước 2 mỗi tick, đèn chỉ đầy đúng tick vừa thắp hoặc vừa châm đầy.
6. **`deposited` của đèn đang sáng**: giữ nguyên giá trị lúc thắp (10 hoặc 5), về 0 khi đèn tắt. Châm dầu không đổi `deposited`.
7. **Đèn tắt có thể thắp lại ngay**: `deposited` về 0 nên cần đủ 5 đom đóm mới.
8. **`tuning.score`**: có thêm khóa phụ ngoài 5 khóa của Contract; `per_second_left` là 0 (không dùng `null`).
9. **Lantern đặt bằng scenario** (`lit` hay `fuel > 0`) không tính vào `successful_lights`, không sự kiện, không điểm. Đặt `fuel` mà không nêu `lit` thì coi `lit = fuel > 0`.
10. **Bóng spawn** vẫn tránh vùng an toàn, nay chỉ tính các đèn còn vùng (fuel ≥ 30).
