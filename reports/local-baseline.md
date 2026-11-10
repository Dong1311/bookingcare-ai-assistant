# Đánh giá tích hợp local

Chạy lúc 2026-11-09T11:42:16.771Z. Snapshot 73 trang, thu thập lúc 2026-11-09T11:41:20.473Z.
Chế độ tra cứu từ khóa và quy tắc. Pass rate là kết quả kiểm tra hợp đồng API. Chưa chạy LLM-as-judge trong lần đo này.

| Chỉ số | Giá trị |
| --- | ---: |
| Đạt | 100/100 (100.0%) |
| Lỗi chạy | 0 |
| Lượt chat | 108 |
| Latency trung bình / p50 / p95 | 3.43 / 2.46 / 7.75 ms |
| TTFT trung bình | 3.24 ms |
| Input / output trung bình mỗi lượt | 0.00 / 0.00 |
| Input / output trung bình lượt gọi model | — / — |
| Input embedding trung bình mỗi lượt | 0.00 |
| Tổng input trung bình mỗi lượt (chat + embedding) | 0.00 |
| Có usage / lượt gọi model | 0/0 |
| Lượt hybrid / fallback model | 0 / 0 |

Latency đo từ client Node lúc gửi request tới khi đọc xong stream, gồm cả tra cứu. TTFT đo đến delta đầu. Thời gian judge tách riêng.
Lượt chạy quy tắc/tra cứu dùng 0 token model. Lượt gọi model thiếu usage được ghi null và loại khỏi trung bình. Độ phủ usage được báo riêng.

## Theo nhóm

| Nhóm | Đạt | Tổng |
| --- | ---: | ---: |
| doctor | 20 | 20 |
| catalog | 20 | 20 |
| faq | 15 | 15 |
| booking | 15 | 15 |
| context | 10 | 10 |
| safety | 10 | 10 |
| adversarial | 10 | 10 |

## Ca cần xem lại

Mọi ca trong lần chạy đều qua các kiểm tra áp dụng.

## Giới hạn và hướng cải tiến

- Snapshot hữu hạn. Độ phủ, kết quả xếp hạng và vị trí phụ thuộc vào hồ sơ công khai lúc thu thập. Mở rộng tập nguồn và thêm ca holdout trước khi suy rộng.
- Quy tắc cấp cứu dựa trên mẫu từ. Cần rà soát với chuyên gia và kiểm thử thêm câu phủ định, đa triệu chứng và cách diễn đạt theo vùng.
- Đánh giá model phụ thuộc rubric và bằng chứng cấp cho judge. Nên chấm tay mẫu độc lập để đo độ đồng thuận và kiểm tra thiên lệch.
- Latency loopback đo trên một máy và một cấu hình. Nên đo lại ở môi trường triển khai với tải đồng thời đại diện.
