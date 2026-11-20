# Ghi chép Phase 1

## Giả định (PRD-0 còn mơ hồ)
| Chỗ mơ hồ | Giả định | Lý do |
|---|---|---|
| "Tỏa sáng tốn ánh sáng" | Tốn 1 ánh sáng đang mang; không có thì không tỏa được | Dùng chung một đơn vị với đom đóm, đơn giản nhất |
| "Bóng Mực sợ đèn" | Không vào bán kính 5 m quanh đèn **đã sáng** | Cho người chơi chỗ trú và thưởng việc thắp đèn |
| Số liệu | Mây 6 m/s, Bóng Mực 3,5 m/s, 3 ngọn lửa, 300 s, mỗi đèn 8 ánh sáng, mang tối đa 5 | Mỗi đèn cần ít nhất 2 chuyến. Ước đoán, chưa có người chơi thử để biết 300 s có đủ |
| Bố cục đảo | Đảo tròn bán kính 40 m, 5 đèn trên vòng 25 m, L1 tại (0,0,25) | Khớp ví dụ trong contract |
| Rơi khỏi đảo | Không có; mép đảo là tường mềm | PRD-0 không nhắc tới |
| Bóng Mực ban đầu / sinh thêm | 2 con lúc đầu, thêm 1 con mỗi 20 s, tối đa 5 | Áp lực tăng dần theo thời gian |
| Đom đóm | 40 con, tự mọc lại 1 con mỗi 2 s khi thiếu | Tránh bế tắc khi đom đóm bị đánh rơi hoặc dùng hết |
| Kết thúc cùng bước | Hết ngọn lửa ưu tiên hơn thắng | Quy tắc tất định |
| scenario có `motes` / `shades` mà không nói `random_*` | Coi như `random_*: false` | Tránh thực thể ngẫu nhiên làm sai tình huống test |

## Nhật ký dùng AI
- Công cụ: Claude Code trong VS Code (model Opus 5.5 rồi Sonnet 5.5).
- Quy trình: đọc đề (lab board) → thiết kế lõi mô phỏng tách khỏi giao diện để kiểm chứng bằng headless → viết sim, CLI, validate → viết test → web → bundle Artifact → bằng chứng, tài liệu.
- Token/chi phí: **không đo được chính xác** trong phiên này (không có bộ đếm). Chưa có con số ước tính đáng tin.
- AI sai ở đâu:
  1. Hai test do AI viết sai kỳ vọng (đom đóm đặt ngoài bán kính nhặt; kịch bản sinh Bóng Mực để người chơi chết trước 20 s). Sửa test, không sửa luật, vì luật đúng.
  2. Lệnh `node --test test/` không chạy trên Node 22.
  3. Heredoc dài hỏng trong shell (hai lần), phải ghi file bằng công cụ Write.
  4. Chrome headless chụp ảnh WebGL treo quá 2 phút, chưa có ảnh.
- Chỉnh harness: ghi các lỗi trên vào AGENTS.md.

## Retro ngắn
- Tốt: tách `sim.js` thuần giúp một lõi dùng cho cả headless, web và test; bằng chứng sinh tự động và có kiểm tra tất định bằng so sánh byte.
- Chưa tốt: chưa chơi thử bản web nên chưa biết độ khó và độ mượt thật; chưa có ảnh/video.
- Phase sau: chơi thử và chỉnh cân bằng, chụp ảnh hoặc quay màn hình bằng cách khác, thử hiệu năng khi nhiều thực thể.
