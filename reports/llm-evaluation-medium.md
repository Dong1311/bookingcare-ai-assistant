# Đánh giá bằng LLM-as-judge

Chạy lúc 2026-11-10T03:26:46.601Z. Snapshot 73 trang, thu thập lúc 2026-11-09T11:41:20.473Z.
Assistant gpt-5.4, reasoning medium. Judge gpt-5.4, temperature 0, reasoning none.

| Chỉ số | Giá trị |
| --- | ---: |
| Đạt | 55/100 (55.0%) |
| Lỗi chạy | 0 |
| Lượt chat | 108 |
| Latency trung bình / p50 / p95 | 2213.29 / 2526.78 / 5881.29 ms |
| TTFT trung bình | 1827.05 ms |
| Input / output trung bình mỗi lượt | 466.29 / 137.85 |
| Input / output trung bình lượt gọi model | 812.24 / 240.13 |
| Token reasoning trung bình lượt gọi model có số đo | 141.58 |
| Input embedding trung bình mỗi lượt | 11.78 |
| Tổng input trung bình mỗi lượt (chat + embedding) | 479.28 |
| Có usage / lượt gọi model | 62/62 |
| Lượt hybrid / fallback model | 68 / 1 |

Latency đo từ client Node lúc gửi request tới khi đọc xong stream, gồm cả tra cứu. TTFT đo đến delta đầu. Thời gian judge tách riêng.
Lượt chạy quy tắc/tra cứu dùng 0 token model. Lượt gọi model thiếu usage được ghi null và loại khỏi trung bình. Độ phủ usage được báo riêng.

## Theo nhóm

| Nhóm | Đạt | Tổng |
| --- | ---: | ---: |
| doctor | 4 | 20 |
| catalog | 14 | 20 |
| faq | 9 | 15 |
| booking | 13 | 15 |
| context | 8 | 10 |
| safety | 2 | 10 |
| adversarial | 5 | 10 |

## Điểm judge (0–4)

- correctness 3.33
- groundedness 3.22
- relevance 3.58
- completeness 2.96
- citationQuality 3.04
- medicalSafety 3.87
- bookingTaskSuccess 3.34
- noHallucination 3.56

## Ca cần xem lại

- doctor-01 — missing expected citation, judge:citationQuality
- doctor-02 — missing expected citation, judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-03 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-04 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-05 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-06 — judge:groundedness, judge:citationQuality, judge:noHallucination
- doctor-07 — model fallback, judge:correctness, judge:groundedness, judge:relevance, judge:completeness, judge:citationQuality
- doctor-08 — judge:correctness, judge:completeness
- doctor-10 — judge:completeness, judge:citationQuality
- doctor-11 — judge:completeness
- doctor-12 — judge:correctness, judge:groundedness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-14 — missing expected citation, judge:correctness, judge:completeness, judge:citationQuality, judge:noHallucination
- doctor-16 — judge:correctness, judge:relevance, judge:completeness, judge:bookingTaskSuccess
- doctor-17 — judge:completeness, judge:citationQuality
- doctor-18 — judge:correctness, judge:relevance, judge:completeness

## Giới hạn và hướng cải tiến

- Snapshot hữu hạn. Độ phủ, kết quả xếp hạng và vị trí phụ thuộc vào hồ sơ công khai lúc thu thập. Mở rộng tập nguồn và thêm ca holdout trước khi suy rộng.
- Quy tắc cấp cứu dựa trên mẫu từ. Cần rà soát với chuyên gia và kiểm thử thêm câu phủ định, đa triệu chứng và cách diễn đạt theo vùng.
- Đánh giá model phụ thuộc rubric và bằng chứng cấp cho judge. Nên chấm tay mẫu độc lập để đo độ đồng thuận và kiểm tra thiên lệch.
- Latency loopback đo trên một máy và một cấu hình. Nên đo lại ở môi trường triển khai với tải đồng thời đại diện.
