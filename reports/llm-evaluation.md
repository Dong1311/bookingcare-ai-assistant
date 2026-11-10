# Đánh giá bằng LLM-as-judge

Chạy lúc 2026-11-10T02:57:31.462Z. Snapshot 73 trang, thu thập lúc 2026-11-09T11:41:20.473Z.
Assistant gpt-5.4-mini. Judge gpt-5.4, temperature 0, reasoning none.

| Chỉ số | Giá trị |
| --- | ---: |
| Đạt | 57/100 (57.0%) |
| Lỗi chạy | 0 |
| Lượt chat | 108 |
| Latency trung bình / p50 / p95 | 876.92 / 1215.98 / 1885.75 ms |
| TTFT trung bình | 747.43 ms |
| Input / output trung bình mỗi lượt | 465.35 / 51.43 |
| Input / output trung bình lượt gọi model | 810.61 / 89.58 |
| Input embedding trung bình mỗi lượt | 11.78 |
| Tổng input trung bình mỗi lượt (chat + embedding) | 478.34 |
| Có usage / lượt gọi model | 62/62 |
| Lượt hybrid / fallback model | 68 / 1 |

Latency đo từ client Node lúc gửi request tới khi đọc xong stream, gồm cả tra cứu. TTFT đo đến delta đầu. Thời gian judge tách riêng.
Lượt chạy quy tắc/tra cứu dùng 0 token model. Lượt gọi model thiếu usage được ghi null và loại khỏi trung bình. Độ phủ usage được báo riêng.

## Theo nhóm

| Nhóm | Đạt | Tổng |
| --- | ---: | ---: |
| doctor | 8 | 20 |
| catalog | 12 | 20 |
| faq | 8 | 15 |
| booking | 13 | 15 |
| context | 8 | 10 |
| safety | 2 | 10 |
| adversarial | 6 | 10 |

## Điểm judge (0–4)

- correctness 3.34
- groundedness 3.15
- relevance 3.68
- completeness 2.93
- citationQuality 3.09
- medicalSafety 3.91
- bookingTaskSuccess 3.32
- noHallucination 3.51

## Ca cần xem lại

- doctor-03 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-05 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-06 — judge:correctness, judge:groundedness, judge:relevance, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-07 — judge:completeness, judge:bookingTaskSuccess
- doctor-08 — judge:noHallucination
- doctor-10 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-12 — judge:groundedness, judge:citationQuality, judge:noHallucination
- doctor-14 — judge:completeness
- doctor-16 — judge:correctness, judge:completeness, judge:citationQuality, judge:bookingTaskSuccess
- doctor-17 — judge:completeness, judge:citationQuality
- doctor-18 — judge:correctness, judge:relevance, judge:completeness
- doctor-20 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- catalog-01 — judge:completeness
- catalog-02 — judge:completeness, judge:bookingTaskSuccess
- catalog-03 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:bookingTaskSuccess

## Giới hạn và hướng cải tiến

- Snapshot hữu hạn. Độ phủ, kết quả xếp hạng và vị trí phụ thuộc vào hồ sơ công khai lúc thu thập. Mở rộng tập nguồn và thêm ca holdout trước khi suy rộng.
- Quy tắc cấp cứu dựa trên mẫu từ. Cần rà soát với chuyên gia và kiểm thử thêm câu phủ định, đa triệu chứng và cách diễn đạt theo vùng.
- Đánh giá model phụ thuộc rubric và bằng chứng cấp cho judge. Nên chấm tay mẫu độc lập để đo độ đồng thuận và kiểm tra thiên lệch.
- Latency loopback đo trên một máy và một cấu hình. Nên đo lại ở môi trường triển khai với tải đồng thời đại diện.
