# Phát hành v1.0.0

Tài nguyên đã chuẩn bị trong thư mục `release/` (không commit, sinh lại bằng `npm run pack`):

| Tệp | Nội dung |
|---|---|
| `release/dao-den-long-v1.0.0-web.zip` | Thư mục web tĩnh: `index.html`, `vendor/three.module.js`, `RUN.txt`. Không cần Node. |
| Docker (từ `Dockerfile`) | Bản có máy chủ: bảng xếp hạng ghi ra đĩa và có lệnh xuất. |

## Chạy bản web tĩnh

Giải nén rồi mở qua một máy chủ web tĩnh bất kỳ (Chrome và Edge không chạy module khi mở thẳng bằng `file://`):

```bash
python -m http.server 8080      # trong thư mục đã giải nén, rồi mở http://localhost:8080
```

Bản này lưu bảng xếp hạng và cài đặt trong trình duyệt. Đã kiểm tra bằng `scripts/browser-check.mjs` chạy trên thư mục này qua `python -m http.server`: mọi kiểm tra chức năng đạt (chỉ khác là bảng xếp hạng nằm trong trình duyệt).

## Chạy bằng Docker

```bash
docker build -t dao-den-long:1.0.0 .
docker run --rm -p 8080:8080 -v ddl-data:/data dao-den-long:1.0.0     # http://localhost:8080
docker run --rm -v ddl-data:/data dao-den-long:1.0.0 node server.js --export-leaderboard /data/out.json
```

**Chưa được kiểm chứng**: tôi viết Dockerfile nhưng chưa build được vì Docker Desktop không chạy trên máy làm bài. Cần chạy `docker build` một lần trước khi công bố.

## Tạo GitHub Release

Tôi không tạo Release từ phiên làm việc này (không có công cụ `gh`, và đây là hành động công khai nên do bạn quyết định). Sau khi đã `git push origin main --tags`:

```bash
gh release create v1.0.0 release/dao-den-long-v1.0.0-web.zip --title "Đảo Đèn Lồng v1.0.0" --notes-file docs/RELEASE-v1.0.0.md
```

Hoặc trên GitHub: Releases → Draft a new release → chọn tag `phase-4` (hoặc tạo tag `v1.0.0` trên cùng commit) → đính kèm file zip và file video `.mp4` → Publish.

## Ghi chú phát hành

Phiên bản đầu tiên hoàn chỉnh. Ba Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), nhiên liệu đèn và thắng ở bình minh, bảng xếp hạng cục bộ, đổi phím, chế độ dễ tiếp cận, benchmark và soak test. Số đo của tác giả: benchmark 192 FPS trung bình (p1 low 49 FPS) trên AMD Ryzen 5 5500U; soak 10 Đêm, 0 crash, bộ nhớ ×1,09. Xem [CHANGELOG](CHANGELOG.md) cho thay đổi từng phase.
