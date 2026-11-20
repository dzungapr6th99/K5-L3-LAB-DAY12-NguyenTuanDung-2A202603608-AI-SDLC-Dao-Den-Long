# Đặc tả Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

Mã `T:` là test trong `test/`, `E:` là mục trong `docs/evidence/phase4/EVIDENCE.md`, `B:` là kiểm tra trong Chrome thật (`scripts/browser-check.mjs`, kết quả ở `docs/evidence/screens/browser-check.txt`).
Luật chơi, số liệu và đầu ra headless của Phase 1 đến 3 không đổi: `src/sim.js` chỉ thêm tùy chọn `bench` mà CLI headless không bao giờ dùng (T: "the headless CLI never builds the benchmark scene").

| Mục | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| 1. Benchmark: lệnh | `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (npm run bench), thoát mã 0, ghi `bench.json` đúng các trường của ticket | E: Benchmark; bench.json |
| 1. Cảnh chuẩn | Cửa sổ 1280×720 không toàn màn hình, tắt vsync bằng cờ Chrome; Đêm 1 đầy đủ hiệu ứng và ánh sáng; đúng 200 Bóng Mực `wander` rải đều (seed 42) và 100 đom đóm; L1–L3 sáng fuel 100; tắt sinh thêm, sát thương, nhặt, hao dầu, điều kiện kết thúc; Mây đứng yên tại (0,0,0) | T: benchmark scene (2 test) |
| 1. Camera | Bay vòng tâm (0,0,0), bán kính 30 m, cao 15 m, luôn nhìn (0,0,0), xuất phát (30,15,0), ngược chiều kim đồng hồ, 15 s một vòng | `web/main.js` `benchFrame` |
| 1. Đo | 3 s khởi động không đo; đo đúng `--duration` giây rồi thoát | `web/main.js`, `scripts/bench.mjs` |
| 1. Định nghĩa số đo | `avg_fps = 1000 N / Σdt`; `p1_low_fps = 1000 / trung bình của max(1, ceil(0,01 N)) khung chậm nhất`; `frame_ms_p95` theo thứ hạng gần nhất; `load_ms` từ lúc bắt đầu tiến trình tới khung hình đầu của cảnh bench; `peak_mem_mb` | T: benchStats |
| 1. Ngưỡng | avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000 (trên máy chấm) | E: Benchmark (trên máy làm bài) |
| 2. Soak | `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` (npm run soak): 10 Đêm liên tiếp trong một tiến trình, Đêm 1→2→3 xoay vòng, Đêm i dùng seed 7 + i, đầu vào ngẫu nhiên theo seed (đổi hướng mỗi 30 tick; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác) | T: soak |
| 2. Ngưỡng | crashes = 0 và mem_end_mb ≤ 1,2 × mem_start_mb | T: soak; E: Soak |
| 3. Bảng xếp hạng: nhập tên | Sau Bình Minh (thắng Đêm 3) hoặc sau khi thua ở bất kỳ Đêm nào; tên 3–12 ký tự `[A-Za-z0-9_]` (cho phép cả chữ có dấu tiếng Việt) | T: name rules; B: lose → name → saved |
| 3. Mục lưu | `name`, `score` (tổng điểm các Đêm đã thắng), `nights_won` (0–3), `achieved_at` (ISO 8601 có múi giờ), `seed` | T: entry fields |
| 3. Thứ tự | Top 10; điểm giảm dần; bằng điểm thì ai đạt trước đứng trên | T: order |
| 3. Lưu đĩa | Ghi vào `data/leaderboard.json` (hoặc `DDL_DATA_DIR`) bằng ghi tạm rồi đổi tên nên không hỏng khi tắt đột ngột; còn lại sau khi tắt và mở lại | T: disk (khởi động lại máy chủ) |
| 3. Màn hình | Có "Bảng xếp hạng" ở menu chính | B: leaderboard screen |
| 3. Lệnh xuất | `node server.js --export-leaderboard out.json` cho ra `{"entries": [...]}` đúng thứ tự (`run_cmd` trong contract là `node server.js`) | T: disk (export) |
| 4. Đổi phím | Di chuyển 4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng; phát hiện trùng phím và báo; nút "Khôi phục mặc định"; được lưu | T: keybinds (6 test); B: rebind, conflict, reset, reload |
| 4. Chỉ báo hình ảnh | Bóng Mực xuất hiện (chú thích hướng và mũi tên ở mép màn hình 5 s), gió sắp thổi (băng chữ), 10 s cuối (số lớn giữa màn hình), đèn fuel < 30 (dòng chú thích) | B: low-fuel, countdown; đọc `updateHud` |
| 4. Giảm chuyển động | Tắt rung camera (khi bị chạm), chớp màn hình, nhấp nháy của đồng hồ, số đếm ngược và đèn sắp hết dầu | B: option applies and persists |
| 4. Cỡ chữ UI | Tối thiểu 18 px ở 1280×720; tùy chọn chữ lớn ×1,25 | B: HUD ≥ 18 px, menu ≥ 18 px, large text scales |
| 5. Đóng gói | Làm theo README tối đa 3 lệnh; README có mô tả, ảnh chụp, yêu cầu hệ thống, cài đặt, điều khiển, test, headless, bench, soak; CHANGELOG đủ 4 phase; CREDITS; LICENSE | README.md, docs/CHANGELOG.md |
| 5. Release | Bản chạy được: thư mục web tĩnh (`npm run pack`) và Dockerfile, kèm hướng dẫn | docs/RELEASE-v1.0.0.md; B: thư mục tĩnh chạy qua máy chủ tĩnh |
| 6. Contract v1.3 | `contract_version: "1.3"`, thêm `bench_cmd`, `soak_cmd`; mọi yêu cầu v1.0–v1.2 giữ nguyên | T: Contract v1.3; toàn bộ test Phase 1 đến 3 |
| 7. Retro, video | Retro 1–2 trang; video .mp4 dưới 5 phút | docs/RETRO.md; video: chưa có (xem README) |

## Giả định (chỗ ticket chưa nêu rõ)

1. **Benchmark chạy trong Chrome** (bản web). "Bắt đầu tiến trình" tính từ lúc script `bench.mjs` khởi động, nên `load_ms` gồm cả khởi động máy chủ cục bộ và Chrome. Máy chủ chạy ở chế độ headless GPU (có thể thêm `HEADED=1` để mở cửa sổ thật).
2. **Tắt vsync** bằng cờ `--disable-gpu-vsync --disable-frame-rate-limit`; `vsync_off: true` nghĩa là các cờ này đã được dùng, không phải bảo đảm của trình duyệt. Khi bỏ cờ giới hạn, tốc độ bị giữ gần 60 FPS.
3. **`peak_mem_mb`** là tổng working set của mọi tiến trình Chrome do script khởi động, lấy mẫu hai lần ngoài khoảng đo (cuối khởi động và ngay sau khi đo xong) để không làm nhiễu thời gian khung hình. Số này thường lớn hơn bộ nhớ thật vì cộng trùng vùng nhớ chia sẻ.
4. **Rải đều 200 Bóng Mực**: xoắn ốc hoa hướng dương trên đĩa bán kính 38 m, xoay và nhiễu nhẹ theo seed (100 đom đóm: bán kính 36 m). Các bóng chạy AI `wander` bình thường (đi tới đèn tối gần nhất, đuổi Mây khi lại gần 12 m), chỉ tắt sát thương.
5. **Hướng quay camera**: cùng quy ước góc của bản đồ, vị trí = (30 cos a, 15, 30 sin a).
6. **HUD vẫn hiện trong cảnh bench** vì đó là cảnh chơi thật; độ phân giải điểm ảnh cố định 1 và khử răng cưa bật.
7. **Soak**: "Đêm thứ i" đếm từ 1 (seed 8 đến 17). Luồng ngẫu nhiên của đầu vào tách khỏi luồng của game. Trước khi đo `mem_start_mb`, tiến trình được khởi động nóng bằng một ván nháp 3000 tick (JIT và kích thước heap), và cả hai số RSS đều được đọc sau hai lần thu gom rác. Không có bước khởi động nóng thì RSS đầu (30 MB) thấp hơn RSS lúc ổn định (40 MB) nên vượt ×1,2 dù heap không tăng (heapUsed ổn định ở 4,3 MB qua 30 Đêm).
8. **Kết quả soak toàn `lost`**: đầu vào ngẫu nhiên không thể giữ 60% đèn sáng tới bình minh. Soak đo độ ổn định, không đo độ khó.
9. **Bảng xếp hạng**: `score` là tổng điểm các Đêm đã thắng tại lúc lưu (thua Đêm 2 sau khi thắng Đêm 1 thì `score` là điểm Đêm 1, `nights_won` là 1). `seed` là seed của chiến dịch. `achieved_at` là giờ máy chủ kèm độ lệch múi giờ. Tên dùng chữ Unicode (có dấu) và số và `_`. Có thể lưu nhiều mục cho cùng một tên.
10. **Nơi lưu**: bản có máy chủ (`npm start`, Docker) ghi ra đĩa; bản web tĩnh và Artifact không có máy chủ nên dùng `localStorage` (không xuất được bằng lệnh).
11. **Đổi phím**: ← → (xoay camera), R (chơi lại Đêm) và Enter (xác nhận) là phím cố định, không gán được. Phím P không còn là phím tạm dừng thứ hai. Gán phím trùng bị từ chối và báo tên hành động đang dùng nó.
12. **Rung camera** là hiệu ứng tôi thêm (0,3 s sau khi bị chạm) để tùy chọn "Giảm chuyển động" có nghĩa; tắt trong bench và trong chế độ giảm chuyển động.
13. **Cỡ chữ 18 px** áp dụng cho mọi chữ trong HUD và menu; gợi ý phím ở góc dưới trái bị bỏ (phím hiển thị trong menu, màn Cài đặt và nhãn của nút Lướt, Tỏa sáng).
14. **Docker**: Dockerfile có trong repo nhưng tôi chưa build được vì Docker Desktop không chạy trên máy làm bài.
15. **GitHub Release và video** không tạo được trong phiên làm việc này: không có `gh` và không có ffmpeg trên máy. Tài nguyên phát hành đã chuẩn bị sẵn (`npm run pack`), hướng dẫn ở docs/RELEASE-v1.0.0.md.
