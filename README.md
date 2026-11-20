# Đảo Đèn Lồng (Phase 1)

Game 3D góc nhìn thứ ba chạy trên trình duyệt. **Mây**, người giữ đèn nhỏ tuổi, gom đom đóm, mang về thắp lại **5 Đèn Lồng Lớn** trên đảo Bến và tránh **Bóng Mực**.
Bài lab AI-SDLC Day 12, cá nhân (2A202603608). Đề lab gốc: [docs/LAB-README.md](docs/LAB-README.md).

- Bản chơi trực tuyến (Claude Artifact): https://claude.ai/artifact/LcX17RrMrfnZyxtPATJchU (riêng tư, cần quyền truy cập)
- Video demo: chưa có (dành cho Phase 4).

## Cài đặt và chạy (3 lệnh)

Cần Node.js 18 trở lên (macOS, Linux, Windows).

```bash
npm install        # cài three.js
npm start          # mở http://localhost:8080
npm test           # 18 test, tất cả phải đạt
```

Cổng khác: `PORT=3000 npm start`. Thêm `?seed=123` vào URL để cố định seed, `?autostart` để bỏ màn hình chào.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D (hoặc mũi tên lên/xuống) | Đi, theo hướng camera |
| Space | Nhảy |
| E | Nạp ánh sáng vào đèn gần nhất trong tầm (3 m) |
| F hoặc Shift | Tỏa sáng: xua Bóng Mực |
| ← / → hoặc kéo chuột | Xoay camera |
| R | Chơi lại |

## Luật chơi và cách tính điểm

- Đom đóm tự nhặt khi lại gần (1,5 m). Mây mang tối đa **5**. Mỗi con +10 điểm.
- Mỗi đèn cần **8** ánh sáng. Đứng gần đèn, bấm E để nạp. Đủ 8 thì đèn sáng, +100 điểm.
- Tỏa sáng tốn **1** ánh sáng đang mang, hồi chiêu 2 s. Bóng Mực trong 8 m bị choáng 3 s, bị đẩy lùi 3 m, +25 điểm mỗi con. Bóng Mực đang choáng không gây sát thương.
- Bóng Mực đuổi theo (3,5 m/s, chậm hơn Mây 6 m/s). Chạm là mất 1 ngọn lửa (có 3), đánh rơi một nửa ánh sáng đang mang, rồi bất tử 2 s.
- Quanh đèn **đã sáng** 5 m, Bóng Mực không vào được: đó là chỗ trú.
- **Thắng**: cả 5 đèn sáng, cộng thêm 1 điểm mỗi giây còn lại và 50 điểm mỗi ngọn lửa còn lại. **Thua**: hết 3 ngọn lửa, hoặc hết 300 s (trời sáng).
- Đảo sáng dần và sương mỏng đi khi thắp thêm đèn.

## Chế độ headless và Test Contract v1.0

```bash
node src/headless.js --seed 42 --night 1 [--scenario s.json] [--inputs i.json] --ticks 600 --out out/run.jsonl [--snapshot-every 10]
```

Khai báo trong [game.contract.json](game.contract.json), các số lấy từ [src/tuning.js](src/tuning.js) và có test so khớp. Lõi mô phỏng [src/sim.js](src/sim.js) dùng chung cho headless và web.
Mã thoát: 0 thành công, 2 file inputs/scenario sai định dạng, 1 lỗi khác (kèm thông báo stderr).

Khái niệm không dùng hoặc diễn giải riêng:
- `fall_enabled: false`: mép đảo là tường mềm, không rơi, không có sự kiện `player_hit` với `by: "fall"`.
- `pulse_cost` tính bằng ánh sáng đang mang. Không có ánh sáng thì không tỏa sáng được và không có sự kiện `pulse`.
- `safe_radius` chỉ áp dụng quanh đèn đã sáng.
- `hit_drop_ratio` làm tròn xuống. Ánh sáng rơi thành đom đóm mới cách Mây 2,5 đến 4 m.
- `dash` được đọc nhưng game không có cú lướt.
- Id đèn lạ trong scenario (không thuộc L1 đến L5) bị bỏ qua.
- Khi chạy hết `--ticks`, file có thêm một snapshot cuối nếu tick cuối không rơi vào bội số của `--snapshot-every`.

## Bằng chứng

[docs/evidence/EVIDENCE.md](docs/evidence/EVIDENCE.md): bảng yêu cầu, cách kiểm chứng, kết quả. Output JSONL và scenario nằm cùng thư mục. Sinh lại bằng `npm run evidence`.
Ghi chép giả định, nhật ký AI, retro: [docs/NOTES.md](docs/NOTES.md). Harness: [AGENTS.md](AGENTS.md).

## Sáng tạo của tôi

Chưa thêm tính năng ngoài PRD-0. Chỉ có hiệu ứng hiển thị nhỏ (đảo sáng dần theo số đèn, vòng sáng khi tỏa sáng, vòng an toàn quanh đèn đã sáng). Chúng chỉ nằm ở lớp web và không ảnh hưởng đầu ra headless, được kiểm chứng bởi `npm test` và `npm run evidence`.

## Giới hạn đã biết

- Chưa có ảnh chụp màn hình hay video của bản web trong repo. Tôi chưa chơi thử bản web trên trình duyệt thật trong phiên làm bài này, nên phần hiển thị và cảm giác chơi chưa được kiểm chứng. Logic game đã được kiểm chứng bằng headless.
- Cân bằng (tốc độ, số đèn, thời gian) là ước đoán, chưa có người chơi thử.
- Chưa có âm thanh.
