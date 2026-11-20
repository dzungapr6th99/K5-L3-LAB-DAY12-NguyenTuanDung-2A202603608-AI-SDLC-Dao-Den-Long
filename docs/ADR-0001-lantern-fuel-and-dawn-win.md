# ADR-0001: Đèn có nhiên liệu, thắng khi sống sót tới bình minh

Trạng thái: chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2).

## Bối cảnh

Đến Phase 2, một đèn chỉ có hai trạng thái (`lit` true/false), thắp xong là vĩnh viễn, và Đêm kết thúc ngay khi mọi đèn sáng. Playtest cho thấy người chơi giỏi xong trong 2 phút và cuối Đêm hết căng thẳng. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn

Mỗi đèn có: `lit`, `fuel`, `ever_lit`, `relit_count`, `deposited`.

- `lit` không còn là cờ vĩnh viễn: đèn sáng hao 1 fuel/giây và tắt khi `fuel <= 0`.
- `ever_lit` là cờ một chiều (false → true khi thắp thành công lần đầu). Nó quyết định chi phí thắp: 10 đom đóm lần đầu, 5 đom đóm khi thắp lại. Hết dầu giữ `ever_lit`, đặt `deposited = 0`.
- `fuel` được lưu bằng số nguyên theo đơn vị 1/60 (`FUEL_UNIT`). Hao 1 đơn vị mỗi tick, bị hút 5 đơn vị mỗi tick mỗi Bóng Mực, mỗi đom đóm châm vào là +600. Chỉ làm tròn (1 chữ số) khi xuất snapshot và sự kiện. Lý do: cộng dồn 1/60 bằng số thực sẽ trôi và làm sai các biên "đúng 30" và "đúng 100".
- Vùng an toàn là hàm của trạng thái: `lit && fuel >= 30`. Đúng 30 vẫn có vùng an toàn.

Hệ quả cần biết: vì đèn hao ở bước 2 của mỗi tick, một đèn chỉ "đầy dầu" đúng tick nó vừa được thắp hoặc vừa châm đầy. Ở tick kế tiếp nó đã là 99,98 nên vẫn nhận 1 đom đóm. Ticket nói đèn đầy dầu (used = 0) không được chọn, và điều đó đúng ở tick đó.

### 2. Bóng Mực và đèn yếu

Thêm trạng thái `drain` (đứng yên, hút 5/giây, cộng dồn nhiều con). `wander` không còn là đi lang thang thuần túy: đi tới đèn sáng có fuel < 30 gần nhất, nếu không có thì tới đèn tắt gần nhất, nếu không có đèn nào cần thì mới đi ngẫu nhiên. Tốc độ đi là tốc độ Bóng Mực (4,0 hoặc 4,5 m/s). Mỗi tick chọn lại mục tiêu. Bóng đang `chase` không đổi mục tiêu.

Thoát `drain`: Mây vào trong 6 m → `chase`; trúng Tỏa Sáng → `stunned`; đèn tắt, fuel ≥ 30 hoặc cách đèn > 2 m → `wander`. Khi đèn lấy lại vùng an toàn (vừa thắp, hoặc châm lên ≥ 30), mọi bóng trong 6 m bị đẩy ra trong ≤ 30 tick và không gây sát thương, dùng lại cơ chế đẩy của Phase 2.

### 3. Luật thắng

Bỏ "thắng khi mọi đèn sáng" và thưởng thời gian. Đêm luôn chạy đến hết giờ (240 / 270 / 300 s). Ở tick bình minh, sau mọi cập nhật của tick (kể cả đèn vừa hết dầu ở bước 2): hết Ngọn Lửa → thua `no_flames`; còn sống và đèn sáng ≥ ceil(0,6 × n) → thắng `dawn_survived`; còn lại → thua `dawn`. Ngưỡng tính bằng `ceil(win_ratio * n - 1e-9)` để tránh sai số số thực (0,6 × 5).

### 4. Sức chứa và điểm

Sức chứa = min(20, 10 + 2 × lần thắp thành công trong Đêm), tính cả thắp lại, không tính đèn đặt bằng scenario. Điểm theo bảng của ticket; `tuning.score` có thêm các khóa `per_relight`, `per_stun_drain`, `per_lit_lantern_dawn`, và `per_second_left` bằng 0 (giữ khóa cũ để các bài test tự sinh không gặp khóa thiếu).

## Các phương án đã cân nhắc

- **Lưu fuel bằng số thực.** Đơn giản hơn nhưng trôi ở biên 30 và 100. Bị loại.
- **Để `wander` giữ nguyên đi ngẫu nhiên, chỉ thêm `drain` khi tình cờ gần đèn.** Không khớp câu "đi tới đèn sáng có fuel < 30 gần nhất" của ticket. Bị loại.
- **Giữ thắng sớm song song với thắng bình minh.** Ticket nói rõ không còn thắng sớm. Bị loại.

## Hệ quả

- Nhiều test Phase 1 và 2 phải sửa: xem [CHANGELOG.md](CHANGELOG.md).
- Contract v1.2: snapshot thêm `fuel`, `ever_lit`, `relit_count`, `player.capacity`, `shades[].target_lantern_id`; sự kiện `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`.
- Rủi ro chưa kiểm chứng: độ khó. Số liệu (hao 1/s, hút 5/s, ngưỡng 60%) do ticket cho, nhưng chưa ai chơi thử để biết có thắng nổi Đêm 3.
