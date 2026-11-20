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

## Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

### Quy trình
1. **Lấy yêu cầu.** Bạn tải trang vào `references/Phase3/`; tôi trích văn bản Ticket-03 từ `a_002_*.htm` (tab Phase 3 "Đèn cạn dầu").
2. **Đây là change request thay luật cốt lõi**, nên làm khác Phase 2: đọc kỹ các mục `[THAY THẾ]` và lập mô hình trạng thái đèn mới trước khi sửa mã. **Thực tế ADR và CHANGELOG tôi viết sau khi mã và test đã đạt**, không phải trước ([ADR-0001](ADR-0001-lantern-fuel-and-dawn-win.md)). Tài liệu vẫn đúng với mã, nhưng nó chưa dẫn dắt việc sửa như nên làm.
3. **Kế hoạch kiểm chứng trước.** Với từng mục của ticket viết test headless trước khi coi là xong; mỗi biên số (đúng 30, đúng 100, ceil(0,6 × n), tick bình minh) có một test riêng.
4. **Test cũ.** Chạy bộ test cũ ngay sau khi sửa sim để thấy chính xác cái gì bị luật mới làm sai (6 test), sửa hoặc xóa từng cái có ghi lý do trong [CHANGELOG](CHANGELOG.md). Không dùng `skip`.
5. **Web, bằng chứng, tài liệu.** Cập nhật HUD, thanh dầu, mù màu; chạy lại Chrome thật; sinh lại bằng chứng.

### AI sai ở đâu (Phase 3) và cách xử lý
1. **Lỗi thật trong mã sim, test bắt được**: điểm +15 khi Tỏa Sáng trúng bóng đang hút bị tính +5 vì tôi đổi trạng thái bóng sang `stunned` trước khi kiểm tra. Sửa bằng cách ghi nhớ trạng thái trước.
2. **Test viết sai kỳ vọng**: quên rằng đèn hao 1 tick trước khi bấm tương tác (7 đom đóm thay vì 6); đặt bóng `drain` trên đèn fuel 50 (ticket thả nó về `wander` ngay); đèn fuel 0,05 chỉ sống 1 tick khi có bóng hút. Sửa test, giữ luật.
3. **Lỗi giao diện chỉ thấy khi chạy trình duyệt thật**: tôi xóa nhầm một dòng khai báo biến khi vá `world.js`; `node --check` không bắt được, nhưng `browser-check.mjs` bắt được ngay (ReferenceError mỗi khung hình).
4. **Mũi tên chỉ đèn** ban đầu trỏ tới mọi đèn đang sáng (vì đèn nào cũng nhận dầu); đã tách thành "đèn tối hoặc sắp hết dầu".
5. **Heredoc dài trong shell hỏng** thêm một lần dù đã ghi trong AGENTS.md; lần này ghi script vá vào file bằng công cụ Write rồi chạy.

### Đo đạc
- Test: 51/51 đạt (17 test core của Phase 1, 15 test Phase 2, 19 test Phase 3; một test thắng sớm bị xóa theo ticket).
- Bằng chứng: 28/28 kịch bản đạt và giống hệt giữa hai lần chạy; một Đêm đầy đủ headless khoảng 0,4 giây.
- Chrome thật: 3 Đêm, tạm dừng, dầu hao trong trang, mù màu được lưu, màn bình minh đều đạt; 60 FPS.
- Token/chi phí AI: không đo được.

### Retro
- Tốt: chạy bộ test cũ ngay sau khi sửa sim cho thấy đúng 6 test bị ảnh hưởng; số nguyên 1/60 cho dầu tránh sai số ở các biên.
- Chưa tốt: ADR và CHANGELOG viết muộn (nên viết trước khi sửa mã, đã ghi vào AGENTS.md); vẫn chưa chơi thử bằng tay nên không biết hút 5/s và ngưỡng 60% có hợp lý ở Đêm 3; một số giả định về `wander` tới đèn tắt chưa được đối chiếu với đề.
- Phase 4: chơi thử sớm, đo thật hiệu năng và độ khó, chuẩn bị video và Release.

## Phase 4 (Ticket-04 "Bình minh", Contract v1.3, v1.0.0)

### Quy trình
1. **Lấy yêu cầu**: bạn tải trang vào `references/Phase4/`; tôi trích văn bản Ticket-04 từ `a_002_*.htm`.
2. **Chia việc theo mức độ kiểm chứng được**: (a) bảng xếp hạng + export + test, (b) benchmark + soak + test, (c) giao diện (đổi phím, chỉ báo, cỡ chữ, bảng xếp hạng) + kiểm tra Chrome thật, (d) đóng gói, tài liệu, bằng chứng. Mỗi phần có lệnh chạy lại.
3. **Commit theo mốc**: lõi (bảng xếp hạng, bench, soak, contract) trước, rồi giao diện, rồi tài liệu.

### AI sai ở đâu (Phase 4) và cách xử lý
1. **Hiệu năng thật khác hình dung**. Lần đo benchmark đầu: `p1_low_fps` 27, rồi 5 sau khi dùng InstancedMesh (avg tăng nhưng có khung hình khựng 200 ms mỗi giây). Giả thuyết thử lần lượt: khử răng cưa (không phải), lấy mẫu bộ nhớ của script (không phải), polling của script (không phải), **HUD** (đúng: tắt HUD thì p1 low 99). Nguyên nhân là `backdrop-filter: blur` và ghi `innerHTML` mỗi khung hình. Sửa cả hai, p1 low lên 49.
2. **Soak "thất bại" vì cách đo, không phải rò rỉ**: RSS lúc khởi động (30 MB) thấp hơn lúc ổn định (40 MB) nên vượt ×1,2. Đo heapUsed qua 30 Đêm cho thấy ổn định 4,3 MB. Sửa bằng cách khởi động nóng và thu gom rác trước khi đọc, và ghi rõ trong README.
3. **Đo bộ nhớ trả về null**: `spawnSync('powershell')` không có trong PATH của Node ở Git Bash. Dùng đường dẫn đầy đủ. Một lần thử khác làm nhiễu số đo vì mỗi mẫu bộ nhớ sinh một tiến trình; chuyển việc lấy mẫu ra ngoài khoảng đo.
4. **Lệnh `sed` làm hỏng tài liệu**: `s/\`/`/g` bị GNU sed hiểu `\`` là "đầu buffer", chèn dấu backtick vào đầu mọi dòng của một file. Phát hiện khi đọc byte của file; sửa bằng Python và không dùng sed cho nội dung có backtick nữa.
5. **Heredoc dài hỏng** và **lỗi thoát ký tự trong script vá** (hai lần): chuyển sang ghi script vá bằng công cụ Write.
6. **Vá nhầm làm mất file dùng chung**: chạy `npm run evidence` khi script chưa được vá xong đã ghi đè bằng chứng Phase 3 trong working tree. Phát hiện nhờ `git status`, khôi phục bằng `git checkout`.

### Đo đạc
- Test: 68/68 đạt (51 của Phase 1 đến 3, thêm 6 bảng xếp hạng, 5 benchmark và soak, 6 đổi phím).
- Bằng chứng: 37 dòng đều ĐẠT (28 kịch bản headless × 2 lần chạy giống hệt, 3 đo hiệu năng, benchmark, soak, test).
- Chrome thật: 29 kiểm tra đạt (3 Đêm, tạm dừng, dầu hao, cỡ chữ, đổi phím, giảm chuyển động, chỉ báo, bình minh, bảng xếp hạng ghi ra đĩa). Thư mục web tĩnh cũng đạt các kiểm tra chức năng.
- Benchmark: avg 192 FPS, p1 low 49 FPS, load 0,8 s (ngưỡng 60 / 30 / 10 s). Soak: 10 Đêm, 0 crash, ×1,09 bộ nhớ.
- Token/chi phí AI: không đo được.

### Chưa làm được
- **Video demo** và **GitHub Release**: không có ffmpeg, không có `gh`. Tài nguyên phát hành đã sẵn sàng; việc còn lại cần bạn.
- **Docker image**: viết Dockerfile nhưng chưa build (Docker Desktop không chạy).
- Benchmark trên macOS, Linux; chơi tay hết một Đêm; nghe âm thanh.
