# AGENTS.md: Đảo Đèn Lồng

Game 3D (web) cho lab AI-SDLC. Test Contract v1.0 (headless) được chấm tự động, nên đúng contract quan trọng hơn đẹp.

## Lệnh
- `npm install` · `npm start` (http://localhost:8080) · `npm test` · `npm run evidence` · `node scripts/build-artifact.js` (gộp thành out/artifact.html)
- Headless: `node src/headless.js --seed N --night 1 --ticks N --out f.jsonl [--scenario f] [--inputs f]`

## Cấu trúc
- `src/sim.js`: mô phỏng thuần, tất định. KHÔNG dùng DOM, Three.js, `Math.random`, `Date`. Dùng `src/rng.js`.
- `src/tuning.js`: nguồn duy nhất của mọi con số. `game.contract.json` phải khớp (test kiểm tra). Đổi số thì sửa cả hai.
- `src/headless.js`, `src/validate.js`: CLI và kiểm tra file đầu vào (sai định dạng thì exit 2).
- `web/`: giao diện Three.js. Chỉ vẽ và đọc phím, mọi luật chơi nằm trong `sim.js`.

## Quy ước
- Tick cố định 60/s. Bước k đọc input tick k, sinh trạng thái k+1, sự kiện gắn tick k+1. Khoảng cách chỉ đo trên XZ, "trong bán kính" là ≤.
- Output làm tròn 3 chữ số, cùng seed/scenario/inputs phải ra byte giống hệt.
- Thêm tính năng sáng tạo thì phải tắt hoặc không đổi đầu ra headless.
- Mọi thay đổi luật phải kèm test trong `test/` và chạy `npm test`. Không sửa test cho khớp code mà không nói lý do.
- Không commit `.env`, khóa API, `node_modules/`, `out/`.
- Bằng chứng phải sinh từ lần chạy thật (`npm run evidence`), không viết tay.

## Lỗi đã gặp (đừng lặp lại)
- Heredoc dài trong shell hay hỏng: ghi file lớn bằng công cụ Write.
- `node --test test/` không chạy trên Node 22 (coi là một file). Dùng glob `"test/**/*.test.js"`.
- Chạy Chrome headless chụp ảnh WebGL có thể treo quá 2 phút: đặt timeout, chạy nền.
