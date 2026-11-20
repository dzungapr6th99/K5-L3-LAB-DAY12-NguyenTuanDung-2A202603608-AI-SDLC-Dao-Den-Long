# Ghi chép

## Phase 1

### Giả định
Phase 1 tôi tự chọn số liệu (Mây 6 m/s, 3 ngọn lửa, đèn cần 8 ánh sáng, ...). Phase 2 thay toàn bộ bằng số chuẩn của Ticket-02, nên bảng cũ không còn đúng. Xem `git show phase-1:docs/NOTES.md` nếu cần.

### Nhật ký AI và retro Phase 1
- Công cụ: Claude Code trong VS Code (Opus 5.5, sau đó Sonnet 5.5).
- Quy trình: đọc đề → tách lõi mô phỏng khỏi giao diện để kiểm chứng bằng headless → sim, CLI, validate → test → web → bằng chứng.
- AI sai: hai test sai kỳ vọng (đặt đom đóm ngoài bán kính nhặt; kịch bản để Mây chết trước 20 s), `node --test test/` không chạy trên Node 22, heredoc dài hỏng trong shell, chụp ảnh WebGL bằng `chrome --screenshot` treo.
- Tốt: một lõi mô phỏng dùng chung cho headless, web và test.

## Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1)

### Quy trình
1. **Lấy yêu cầu.** Lab board là artifact của người ngoài tổ chức. Tab Phase 2 nạp từ cơ sở dữ liệu của trang nên công cụ không đọc được (cả đọc trang lẫn đọc CSDL). Tôi nhờ bạn tải trang về `references/`, rồi trích văn bản Ticket-02 từ file `a_002_*.htm`.
2. **Đặc tả.** Tách ticket thành bảng AC (`docs/SPEC-PHASE2.md`) và liệt kê 14 giả định cho chỗ đề chưa nêu.
3. **Kế hoạch kiểm chứng trước.** Quyết định: viết lại lõi `sim.js` theo đúng thứ tự 11 bước của ticket, mọi hành vi kiểm chứng bằng CLI headless thật (`test/helpers.js` gọi CLI, không gọi hàm trực tiếp). Kiểm tra giao diện bằng Chrome thật qua DevTools Protocol.
4. **Xây theo bước nhỏ.** (a) tuning + bản đồ + sim + headless + validate; (b) 18 test hồi quy Phase 1 theo số chuẩn, rồi 15 test tính năng mới; commit mốc; (c) giao diện web: màn hình, HUD, âm thanh, thế giới 3D; (d) bằng chứng, tài liệu, harness.
5. **Hồi quy.** Mọi hành vi Phase 1 được viết lại thành test dưới số chuẩn mới (`test/core.test.js`). Những chỗ ticket đổi nghĩa so với Phase 1 và được phản ánh trong test: điểm +10 tính lúc nạp đèn (không phải lúc nhặt); Tỏa Sáng tốn 3 đom đóm; đom đóm tự nhặt cách ≤ 1 m; hit làm Mây bất tử 90 tick; rơi khỏi đảo có phạt.

### AI sai ở đâu (Phase 2) và cách xử lý
1. **Test đặt sai vị trí, không phải mã sai.** Ba lần: Mây đặt cạnh bục nhảy nên bị bắn lên; đi ngang qua bục khi muốn thử rơi khỏi đảo; Mây còn đứng trên Bùa nên nhặt lại ngay khi Bùa hồi. Xử lý: in trạng thái từng tick để xác định nguyên nhân rồi sửa test, giữ nguyên luật. Ghi vào AGENTS.md.
2. **Một test không thể thỏa.** Dự định kiểm tra "hết lửa thắng thua cùng tick" bằng cách Bóng Mực chạm đúng lúc thắp đèn cuối, nhưng đèn vừa thắp tạo vùng an toàn nên bóng không gây sát thương. Đổi sang dùng đồng hồ hết giờ cùng tick (xem AGENTS.md).
3. **Kiểm tra "làm mới choáng".** Hồi chiêu Tỏa Sáng (3 s) dài hơn thời gian choáng (2 s) nên chỉ kiểm được bằng scenario đặt sẵn choáng.
4. **Lỗi hiển thị chỉ thấy khi xem ảnh.** Cảnh quá tối với công thức ambient của ticket (0.15 + 0.55 × tiến độ) và điểm HUD bị tính đôi ở màn hình kết quả. Cả hai được sửa sau khi xem ảnh chụp từ Chrome thật (giữ nguyên công thức ambient, thêm ánh trăng và ánh bán cầu).
5. **Trùng tên toàn cục khi gộp Artifact** (`makeShade`, `r3`, `D2R` ở nhiều file). Build báo lỗi cú pháp; đổi tên và gom `r3` vào `rng.js`.

### Đo đạc
- Headless: một Đêm đầy đủ 21.600 tick chạy khoảng 0,4 giây (giới hạn 30 giây).
- Web: 60 FPS ở 1280×720 trên GPU của máy làm bài (Chrome headless). Với render phần mềm (SwiftShader) chỉ 5 đến 7 FPS, nên số này không đại diện cho máy có GPU.
- Test: 33/33 đạt. Bằng chứng: 18/18 kịch bản đạt, giống hệt giữa hai lần chạy.
- Token/chi phí AI: không đo được trong phiên này (không có bộ đếm). Phiên làm Phase 2 dài hơn Phase 1 nhiều vì phải viết lại lõi sim, bản đồ và giao diện.

### Chỉnh harness
- AGENTS.md cập nhật phạm vi mới, cấu trúc `src/`/`web/`/`test/`, các lỗi đã gặp.
- Thêm skill `.claude/skills/verify-game` (chạy test, bằng chứng, kiểm tra trình duyệt, báo cáo trung thực).
- Thêm `scripts/browser-check.mjs` thay cho chụp ảnh bằng `chrome --screenshot`.

### Retro ngắn
- Tốt: viết test trước cho từng luật của ticket giúp bắt được lỗi hồi quy sớm; bằng chứng sinh tự động và so byte giữa hai lần chạy; kiểm tra bằng Chrome thật tìm ra hai lỗi hiển thị mà test headless không thấy.
- Chưa tốt: cân bằng và độ khó của 3 Đêm chưa được chơi thử; âm thanh chưa nghe; nhiều giả định chưa được đối chiếu với test ẩn.
- Phase sau: giữ cấu trúc hiện tại, thêm test trước khi thêm tính năng; chơi thử bằng tay sớm hơn.
