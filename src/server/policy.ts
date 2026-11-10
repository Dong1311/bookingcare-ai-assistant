import { normalize } from './knowledge.js'
import type { Intent } from '../shared/protocol.js'

const emergency = /\b(?:cap cuu|bat tinh|ngat xiu|khong tho|ngung tho|nghet tho|kho tho du doi|khong the tho|dau nguc du doi|tuc nguc kho tho|liet nua nguoi|meo mieng|noi kho dot ngot|co giat|chay mau khong cam|chay mau nhieu|soc phan ve|tu tu|tu sat|uong qua lieu|dot quy|tai bien mach mau nao|nuot pin|tim tai)\b/
const attack = /\b(?:ignore (?:all |previous |your )?(?:instructions?|rules?)|system prompt|developer message|bo qua (?:moi |tat ca )?(?:huong dan|chi dan|quy tac)|api key|prompt injection|bia (?:ra |mot )?(?:bac si|gia|nguon|lich)|gia vo (?:da dat|la bac si)|tu tao (?:bac si|link|nguon)|fake (?:citation|doctor))\b/
const advice = /\b(?:chan doan|toi bi benh gi|ke don|ke thuoc|lieu luong|uong thuoc gi|nen uong (?:thuoc|khang sinh)|thuoc nao|bao nhieu (?:mg|vien)|co phai bi|tu dieu tri|chua tai nha|doc ket qua|doc xet nghiem)\b/
const offTopic = /\b(?:bitcoin|co phieu|chung khoan|bong da|thoi tiet|viet (?:code|tho|truyen)|cong thuc nau|xem boi|dau tu|du lich|hack)\b/
const support = /\b(?:huy lich|doi lich|doi gio hen|da dat|lich da dat|den muon|di muon|sai thong tin|nhap sai|huong dan|quy trinh|dat .* nhu the nao|dat .* the nao|bao hiem|ho so suc khoe|thanh toan|bao lanh|mien phi|phi dat|mat phi|truoc khi kham|sau khi kham|bookingcare la|lam sao de|ho tro gi|cach dat|co phai benh vien|dich vu gi)\b/
const booking = /\b(?:dat (?:lich|hen|kham|giup|cho|voi|luon)|chot lich|book (?:lich|kham)|chon (?:lich|khung gio)|muon hen)\b/
const live = /\b(?:lich trong|con (?:lich|cho|slot)|gio trong|slot|gia hien tai|gia bao nhieu|gia kham|phi kham|bao nhieu tien|re nhat|gia chinh xac|gia hom nay|kham luc \d|\d+ gio (?:mai|sang|chieu)|mo cua hom nay)\b/
const lookup = /\b(?:tim|goi y|tra cuu|bac si|bacsi|chuyen khoa|kham|benh vien|phong kham|co so y te|dich vu|xet nghiem|sieu am|o dau|dia chi|noi soi|noi nao)\b/
export const redact = (text: string) => text
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[đã ẩn email]')
  .replace(/(?<!\d)(?:\+?84|0)(?:[ .-]?\d){8,10}(?!\d)/g, '[đã ẩn số điện thoại]')
  .replace(/\b\d{9,16}\b/g, '[đã ẩn mã cá nhân]')

export function route(message: string, previous: string): Intent {
  const text = normalize(message)
  if (emergency.test(text)) return 'emergency'
  if (attack.test(text) || offTopic.test(text)) return 'unsafe'
  if (advice.test(text)) return 'medical'
  if (/\b(?:hen|dat)\b/.test(text) && /\b(?:da dat|huy lich|doi lich|doi gio hen|cach dat|huong dan|dat .* nhu the nao|dat .* the nao|dat .* co mien phi|dat .* mat phi)\b/.test(text)) return 'faq'
  if (booking.test(text)) return 'booking'
  if (support.test(text)) return 'faq'
  if (live.test(text)) return 'live'
  if (/^(?:tim bac si|tim phong kham|tim co so y te|tim dich vu|tu van giup toi|toi muon di kham|toi muon kham|kham o dau|xin chao|chao|chao ban|hello|hi|cam on)$/.test(text)) return 'clarify'
  if (lookup.test(text) || (previous && /\b(?:con|o|cai|cho|nguoi|vi|thu|nay|do|tren|ha noi|hcm|sai gon)\b/.test(text))) return 'search'
  return 'clarify'
}

export function searchType(message: string) {
  const text = normalize(message)
  if (/\b(?:benh vien|phong kham|co so y te|trung tam|dia chi)\b/.test(text) && !/\btim bac si\b/.test(text)) return 'facility'
  if (/\b(?:tu xa|online|truc tuyen)\b/.test(text)) return 'service'
  if (/\b(?:bac si|bacsi)\b/.test(text)) return 'doctor'
  if (/\b(?:goi kham|dich vu|xet nghiem|noi soi|kham tong quat|tam soat|sieu am)\b/.test(text)) return 'service'
  if (/\b(?:chuyen khoa|da lieu|tim mach|tai mui hong|san phu khoa|co xuong khop|tieu hoa|than kinh)\b/.test(text)) return 'doctor'
  return 'any'
}

export const policyCopy = {
  emergency: 'Hãy gọi cấp cứu 115 tại Việt Nam ngay hoặc nhờ người bên cạnh đưa đến khoa cấp cứu gần nhất nếu có thể di chuyển an toàn. Đừng chờ đặt lịch khám qua chat.',
  medical: 'Mình có thể giúp bạn tìm nơi khám, nhưng không thể chẩn đoán, đọc kết quả cá nhân hay kê thuốc. Bạn có thể hỏi bác sĩ trực tiếp. Nếu muốn tra cứu nơi khám, hãy cho mình biết thành phố và chuyên khoa bạn muốn tìm.',
  unsafe: 'Mình hỗ trợ tra cứu bác sĩ, cơ sở y tế, dịch vụ và cách đặt khám từ nguồn công khai BookingCare. Bạn muốn tìm theo chuyên khoa hay khu vực nào?',
  clarify: 'Bạn muốn tìm bác sĩ, cơ sở hay gói khám? Hãy cho mình biết chuyên khoa hoặc tên bạn đang tìm và tỉnh/thành nếu có.',
  live: 'Mình chưa xác minh được giá hoặc giờ trống theo thời gian thực. Bạn có thể xem thông tin mới nhất và chọn lịch trên BookingCare.',
  empty: 'Mình chưa tìm thấy nguồn BookingCare đủ phù hợp để xác minh yêu cầu này. Bạn có thể cho biết tên cụ thể, chuyên khoa hoặc tỉnh/thành để mình tra lại.',
  booking: 'Chưa có lịch hẹn nào được tạo. Bạn có thể mở trang BookingCare bên dưới để xem lịch thực tế, chọn ngày giờ và xác nhận trên BookingCare.',
}
