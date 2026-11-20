# Retro: Đảo Đèn Lồng, bốn phase làm cùng AI

## Tóm tắt Evaluation của 4 phase

| Phase | Kết quả | AI sai ở đâu | Cách phát hiện |
|---|---|---|---|
| 1 PRD-0 | Lõi mô phỏng tách khỏi giao diện, CLI headless theo contract, 18 test, bằng chứng sinh tự động | 2 test sai kỳ vọng; heredoc dài hỏng; `chrome --screenshot` treo | Chạy test; chạy lệnh |
| 2 Ba hòn đảo | Viết lại sim theo 11 bước của ticket, 3 bản đồ, tính năng mới, giao diện web đầy đủ | Test đặt thực thể sai chỗ (bị bục nhảy bắn lên); cảnh quá tối; điểm HUD tính đôi | In trạng thái từng tick; **xem ảnh chụp từ Chrome thật** |
| 3 Đèn cạn dầu | Đổi luật cốt lõi (nhiên liệu, hút dầu, thắng ở bình minh), 6 test cũ bị ảnh hưởng, ADR và changelog | Lỗi thật trong sim (điểm +15 bị tính +5 vì đổi trạng thái trước khi đọc); xóa nhầm một dòng khai báo biến | Test mới; `browser-check.mjs` báo ReferenceError ngay |
| 4 Bình minh | Benchmark, soak, bảng xếp hạng trên đĩa, đổi phím, accessibility, gói phát hành | HUD làm trang khựng định kỳ 200 ms (không ai đoán ra); số RSS của soak tưởng là rò rỉ | **Chính benchmark** lộ ra HUD; đo heapUsed cho thấy không rò rỉ |

## Điều gì hiệu quả

- **Một lõi mô phỏng thuần, dùng chung** cho headless, web, test và benchmark. Mọi luật chỉ viết một lần và kiểm chứng bằng CLI thật (`test/helpers.js` gọi `node src/headless.js`), nên bằng chứng chính là thứ được chấm.
- **Bằng chứng tự sinh và so từng byte** giữa hai lần chạy (`npm run evidence`). Không có dòng nào do tôi viết tay.
- **Chạy trình duyệt thật** (`scripts/browser-check.mjs`, Chrome qua DevTools Protocol). Test headless không thấy cảnh tối, điểm tính đôi, biến chưa khai báo hay HUD gây khựng. Trình duyệt thấy.
- **Đo trước khi tối ưu.** Benchmark cho `p1_low_fps` 5, nhưng thử từng giả thuyết (tắt khử răng cưa, tắt HUD, bỏ polling) mới tìm ra thủ phạm là `backdrop-filter` và ghi DOM mỗi khung hình. Sau sửa: 188 FPS, `p1_low_fps` 50.
- **Quyết định thiết kế bằng số nguyên** (dầu tính theo 1/60) tránh sai số ở các biên "đúng 30", "đúng 100".

## Điều gì không hiệu quả

- **Heredoc dài trong shell hỏng lặp lại** (5 lần trong 4 phase) dù đã ghi vào AGENTS.md ở Phase 1. Mỗi lần mất một lượt viết lại. Quy tắc "ghi file lớn bằng công cụ Write" đúng nhưng tôi vẫn quên khi vội.
- **Viết ADR và changelog sau khi code** (Phase 3). Tài liệu đúng nhưng không dẫn dắt việc sửa.
- **Viết lại cả `web/main.js` hai lần** thay vì chia nhỏ. Tốn token và dễ làm hỏng chỗ khác.
- **Phiên làm Phase 2 mất lấy yêu cầu hai lần** vì lab board là artifact của người ngoài tổ chức: công cụ không đọc được phase mới. Chỉ khi bạn tải trang về mới đọc được.
- **Không bao giờ chơi tay hết một Đêm.** Độ khó của Đêm 3 với luật hút dầu, và âm thanh, chưa được người nào thử. Đây là khoảng trống lớn nhất.

## Harness nào giúp nhiều nhất

1. **AGENTS.md, mục "Lỗi đã gặp"**: mỗi lỗi lặp lại được ghi một dòng. Có tác dụng với lỗi về cấu trúc (glob test, đổi trạng thái đọc trước) nhưng không với lỗi thói quen (heredoc).
2. **Skill `verify-game`**: thứ tự test → evidence → trình duyệt → báo cáo trung thực. Ép tôi chạy trình duyệt trước khi nói "xong".
3. **Các script**: `evidence.js`, `browser-check.mjs`, `bench.mjs`, `soak.js`, `make-contract.mjs`. Một lệnh chạy lại toàn bộ bằng chứng nên không có bằng chứng "cũ".
Không dùng hook hay MCP riêng.

## Token và chi phí AI

**Tổng token/chi phí: không đo được từ bên trong phiên làm việc** (công cụ không có bộ đếm). Bạn lấy con số thật từ `/cost` (hoặc trang usage của tài khoản) rồi ghi vào đây trước khi nộp: `______`.
Cách tôi tiết kiệm: AGENTS.md ngắn; trích văn bản ticket bằng script rồi chỉ đọc phần cần; dùng `node --check` và test thay vì đọc lại file; viết test trước để không chạy agent lặp; một lệnh sinh toàn bộ bằng chứng. Cách tôi lãng phí: viết lại file lớn, heredoc hỏng phải làm lại, ba lần thử chụp ảnh bằng cách không chạy được.

## Nếu làm lại

1. Viết ADR và đặc tả acceptance criteria **trước** khi sửa mã ở mọi phase.
2. Dựng `browser-check.mjs` và `bench.mjs` ngay Phase 1, không đợi Phase 2 và 4. Hai lỗi hiển thị và lỗi hiệu năng đều tìm ra muộn.
3. Chơi tay một Đêm hoàn chỉnh sau mỗi phase, và quay video demo ngay từ Phase 2 thay vì để dồn cuối.
4. Đo token từ đầu (ghi `/cost` cuối mỗi phase).
5. Ghi quy tắc "ghi file lớn bằng công cụ Write" vào đầu AGENTS.md chứ không để ở cuối.
6. Hỏi trợ giảng sớm về các chỗ đề mơ hồ (góc quy ước, điểm xuất phát Đêm 3, chọn đèn mục tiêu) thay vì tự giả định rồi không có ai đối chiếu.
