---
name: verify-game
description: Chạy toàn bộ kiểm chứng cho game Đảo Đèn Lồng (test, bằng chứng headless, kiểm tra trình duyệt) và báo kết quả trung thực. Dùng sau khi sửa luật chơi, bản đồ, tuning hoặc giao diện web, và trước khi commit hay gắn tag phase.
---

# verify-game

Chạy theo thứ tự, dừng và báo ngay khi một bước thất bại. Không sửa test cho khớp mã mà chưa nói lý do.

1. `npm test`. Phải đạt toàn bộ. Test thất bại lạ thì in trạng thái từng tick bằng `test/helpers.js` trước khi sửa.
2. `npm run evidence`. Sinh `docs/evidence/phase4/EVIDENCE.md` (chạy `npm test > docs/evidence/phase4/test-output.txt` sau đó). Mọi dòng phải ĐẠT và "giống hệt" giữa hai lần chạy.
3. Bản web: `GPU=1 node scripts/browser-check.mjs` (tự bật máy chủ riêng). Kết quả ghi vào `docs/evidence/screens/`. Mở ít nhất ảnh `night3-play.png` để xem bằng mắt.
3b. Nếu đổi hiệu năng, cảnh hoặc HUD: `npm run bench` và so với ngưỡng (avg ≥ 60, p1 low ≥ 30, load ≤ 10 s). Nếu đổi sim: `npm run soak` (0 crash, bộ nhớ ≤ ×1,2).
4. Nếu đổi giao diện: `node scripts/build-artifact.js` rồi `node --check` phần script trong `out/artifact.html`.
5. Báo cáo: nêu rõ cái gì đã chạy, cái gì chưa (âm thanh chưa nghe, độ khó chưa chơi thử). Không viết "đạt" cho thứ chưa chạy.

Số chuẩn của ticket nằm trong `src/tuning.js`. Không đổi chúng để làm test qua.
