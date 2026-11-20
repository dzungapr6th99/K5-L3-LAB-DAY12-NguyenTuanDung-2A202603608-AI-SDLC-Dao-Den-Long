# AGENTS.md: Đảo Đèn Lồng

Game 3D (web) cho lab AI-SDLC. Test Contract (headless) được chấm tự động, nên đúng contract quan trọng hơn đẹp. Phạm vi hiện tại: Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2). Đặc tả và giả định: `docs/SPEC-PHASE2.md`, `docs/SPEC-PHASE3.md`. Quyết định thiết kế: `docs/ADR-0001-*.md`. Thay đổi phá vỡ: `docs/CHANGELOG.md`.

## Lệnh
- `npm install` · `npm start` (http://localhost:8080) · `npm test` · `npm run evidence` · `node scripts/build-artifact.js` (gộp thành out/artifact.html)
- Headless: `node src/headless.js --seed N --night 1|2|3 --ticks N --out f.jsonl [--scenario f] [--inputs f]`
- Kiểm tra bản web bằng Chrome thật: bật `npm start`, rồi `GPU=1 node scripts/browser-check.mjs` (bỏ `GPU=1` để dùng render phần mềm, chậm hơn).

## Cấu trúc
- `src/sim.js`: mô phỏng thuần, tất định, một hàm `stepGame` = một tick theo đúng 11 bước của ticket. KHÔNG dùng DOM, Three.js, `Math.random`, `Date`. Dùng `src/rng.js`.
- `src/tuning.js`: số chuẩn của ticket (Ticket-03 đã đổi thời gian Đêm và thêm khóa nhiên liệu) (`TUNING` vào contract, `RULES` là hằng còn lại). `game.contract.json` phải khớp `TUNING` (test kiểm tra). Số chuẩn do ticket quy định, không tự đổi.
- `src/maps.js`: 3 bản đồ, địa hình (`groundAt`, `blockedAt`, `walkFloor`).
- `src/headless.js`, `src/validate.js`: CLI và kiểm tra file đầu vào (sai định dạng thì exit 2).
- `web/`: `main.js` (màn hình, input, HUD), `world.js` (Three.js), `audio.js` (Web Audio tổng hợp). Chỉ vẽ và đọc phím, mọi luật chơi nằm trong `sim.js`.
- `test/core.test.js` (hồi quy Phase 1), `test/phase2.test.js` (Phase 2), `test/phase3.test.js` (nhiên liệu, hút dầu, thắng bình minh). Test chạy CLI thật qua `test/helpers.js`.

## Quy ước
- Tick cố định 60/s. `tick` đếm cả tick tạm dừng, `sim_tick` chỉ đếm tick chơi. Sự kiện ghi `tick` = bước hiện tại.
- Đếm bộ đếm ở bước 2 của tick: một bộ đếm đặt bằng N tại tick T có hiệu lực ở các tick T..T+N−1. Khi sửa thời lượng, kiểm tra lại bằng test chứ không đoán.
- Output làm tròn 3 chữ số, cùng seed/scenario/inputs phải ra byte giống hệt.
- Mỗi tính năng mới cần ít nhất 1 test headless và 1 dòng trong `scripts/evidence.js`.
- Nhiên liệu đèn lưu bằng số nguyên 1/60 (`FUEL_UNIT`); đừng dùng số thực cho fuel. Vùng an toàn = `lit && fuel >= 30`.
- Khi một ticket thay luật cũ: ghi ADR và CHANGELOG trước, chạy test cũ để liệt kê cái bị sai, sửa hoặc xóa từng test kèm lý do. Không `skip`.
- Thêm tính năng sáng tạo thì phải tắt hoặc không đổi đầu ra headless.
- Không sửa test cho khớp code mà không nói lý do trong commit.
- Không commit `.env`, khóa API, `node_modules/`, `out/`.
- Bằng chứng phải sinh từ lần chạy thật (`npm run evidence`, `browser-check.mjs`), không viết tay.
- Mã bản Artifact là bản gộp: tên toàn cục không được trùng giữa các file trong `src/` và `web/` (build sẽ lỗi cú pháp nếu trùng).

## Lỗi đã gặp (đừng lặp lại)
- Heredoc dài trong shell hay hỏng: ghi file lớn bằng công cụ Write.
- `node --test test/` không chạy trên Node 22 (coi là một file). Dùng glob `"test/**/*.test.js"`.
- Chụp ảnh WebGL bằng `chrome --screenshot` treo quá 2 phút: dùng `scripts/browser-check.mjs` (DevTools Protocol, có timeout cứng).
- Lab board là artifact của người ngoài tổ chức: ArtifactData không đọc được, phase mới nằm trong CSDL của trang. Cách lấy yêu cầu: người dùng tải trang về thư mục `references/`, đọc file `*_002_*.htm` (Phase 2) bằng script trích văn bản.
- Sau khi vá file bằng script, `node --check` không bắt được biến chưa khai báo: luôn chạy `scripts/browser-check.mjs` khi đổi `web/`.
- Khi thay đổi trạng thái của một thực thể, đọc trạng thái cũ TRƯỚC (bug điểm Tỏa Sáng trúng bóng đang `drain`).
- Test viết sai vị trí đặt thực thể (ví dụ đặt Mây cạnh bục nhảy nên bị bắn lên). Khi một test lạ thất bại, in trạng thái từng tick trước khi sửa mã.
- Bóng Mực chạm Mây lúc Mây còn ở trong vùng an toàn của đèn vừa thắp không gây sát thương: không thể có "thắng + hết lửa cùng một tick" qua đường chạm, nên kiểm thử ưu tiên `no_flames` bằng cách dùng đồng hồ hết giờ.
