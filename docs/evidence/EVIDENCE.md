# Bằng chứng Phase 1 (sinh tự động bởi `npm run evidence`)

Mỗi dòng: chạy CLI headless thật (`node src/headless.js --seed 42 ...`) hai lần, so sánh byte, rồi kiểm tra kết quả với yêu cầu.
Output JSONL và file scenario/inputs nằm cạnh file này. Chạy lại ở tag `phase-1` cho cùng kết quả.

| Mã | Yêu cầu được chứng minh | Kết quả chạy | sha256 (12 ký tự) | 2 lần chạy | Đánh giá |
|---|---|---|---|---|---|
| E1-pickup | Nhặt đom đóm: mote_picked, carried, điểm | `playing`, 5 tick, điểm 20, 2 sự kiện | ddffa7c93285 | giống hệt | ĐẠT |
| E2-deposit-win | Nạp đèn, thắp đèn, thắng (all_lit) + điểm thưởng | `won`, 1 tick, điểm 299, 3 sự kiện | 179e78fae433 | giống hệt | ĐẠT |
| E3-pulse | Tỏa sáng xua Bóng Mực: tốn ánh sáng, stun, đẩy lùi, điểm | `playing`, 10 tick, điểm 25, 1 sự kiện | ecb876744536 | giống hệt | ĐẠT |
| E4-hit-lose | Bóng Mực đuổi và chạm: mất máu, thua (no_flames) | `lost`, 323 tick, điểm 0, 2 sự kiện | d3ec2c96a136 | giống hệt | ĐẠT |
| E5-dawn | Hết giờ: thua (dawn), time_left_s = 0 | `lost`, 120 tick, điểm 0, 1 sự kiện | 5312616c1b84 | giống hệt | ĐẠT |
| E6-safe-radius | Bóng Mực không vào bán kính an toàn quanh đèn đã sáng | `playing`, 300 tick, điểm 0, 0 sự kiện | 5f106c447ce6 | giống hệt | ĐẠT |
| E7-random-run | Màn thật (seed 42, đứng yên 30 s): shade/mote tự sinh, state hợp lệ | `playing`, 1800 tick, điểm 0, 12 sự kiện | a8e1af20cbaf | giống hệt | ĐẠT |

Test tự động (`npm test`): xem `test-output.txt`.
Chưa có ảnh chụp màn hình/video của bản web (xem mục "Giới hạn" trong README).
