/**
 * utils.js — Các hàm tiện ích dùng chung
 * Không phụ thuộc vào state hay DOM
 */

import { WARNING_DAYS, STATUS } from './constants.js';

// ── Date Utilities ──

/** Trả về ngày hôm nay lúc 00:00:00 */
export function getTodayDate() {
  return new Date(new Date().setHours(0, 0, 0, 0));
}

/** Tính số ngày chênh lệch giữa 2 Date */
export function diffDays(dateA, dateB) {
  return Math.round((dateA - dateB) / 86_400_000);
}

/** Format Date thành dd/mm/yyyy kiểu Việt Nam */
export function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** Format Date thành "T01-2025" */
export function formatMonthKey(date) {
  return 'T' + String(date.getMonth() + 1).padStart(2, '0') + '-' + date.getFullYear();
}

/** Format Date thành "T01-2025" từ year + monthIndex */
export function formatMonthKeyFromParts(year, monthIndex) {
  return 'T' + String(monthIndex + 1).padStart(2, '0') + '-' + year;
}

/**
 * Tính khoảng thời gian từ filter name
 * @returns {[Date|null, Date|null]}
 */
export function getDateRangeFromFilter(filterName, customFrom = null, customTo = null) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (filterName) {
    case 'today':
      return [todayStart, todayEnd];
    case 'yesterday': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59);
      return [start, end];
    }
    case 'week': {
      const dayOfWeek = (now.getDay() || 7) - 1; // Monday = 0
      const start = new Date(todayStart);
      start.setDate(start.getDate() - dayOfWeek);
      return [start, todayEnd];
    }
    case 'month':
      return [new Date(now.getFullYear(), now.getMonth(), 1), todayEnd];
    case 'last':
      return [
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      ];
    case 'custom':
      return [customFrom, customTo];
    default:
      return [null, null];
  }
}

// ── Member Utilities ──

/**
 * Chuẩn hóa giá trị status về một trong 4 giá trị hợp lệ
 * Xử lý cả dữ liệu cũ lưu bằng tiếng Việt
 */
export function normalizeStatus(rawStatus) {
  if (!rawStatus) return STATUS.ACTIVE;
  const validStatuses = Object.values(STATUS);
  if (validStatuses.includes(rawStatus)) return rawStatus;

  const lower = String(rawStatus).toLowerCase();
  if (lower.includes('tam') || lower.includes('dừng') || lower.includes('dung')) return STATUS.PAUSED;
  if (lower.includes('het') || lower.includes('hết') || lower.includes('hạn')) return STATUS.EXPIRED;
  if (lower.includes('sap') || lower.includes('sắp')) return STATUS.WARNING;
  return STATUS.ACTIVE;
}

/**
 * Tính lại ngày hết hạn và trạng thái của một học viên
 * @param {Object} member - record học viên
 * @returns {void} — mutates member in place
 */
export function recalculateMember(member) {
  if (!(member.ngay_bd instanceof Date) || isNaN(member.ngay_bd) || !member.so_ngay) return;

  member.ngay_hh = new Date(member.ngay_bd);
  member.ngay_hh.setDate(member.ngay_hh.getDate() + member.so_ngay + (member.ngay_bu || 0));
  member.con_lai = diffDays(member.ngay_hh, getTodayDate());

  if (member.tt !== STATUS.PAUSED) {
    member.tt = computeStatusFromDaysLeft(member.con_lai);
  }
}

/**
 * Tính trạng thái dựa trên số ngày còn lại
 * Hàm dùng chung — loại bỏ code duplicate ở 3 chỗ cũ
 */
export function computeStatusFromDaysLeft(daysLeft) {
  if (daysLeft < 0)           return STATUS.EXPIRED;
  if (daysLeft <= WARNING_DAYS) return STATUS.WARNING;
  return STATUS.ACTIVE;
}

/** Lấy tag hiển thị của học viên (dùng cho filter chip) */
export function getMemberTag(member) {
  if (member.tt === STATUS.PAUSED) return STATUS.PAUSED;
  return computeStatusFromDaysLeft(member.con_lai);
}

/**
 * Parse record từ Firebase/JSON — convert string dates → Date objects
 */
export function parseMemberRecord(raw) {
  const member = { ...raw };
  if (typeof member.ngay_bd === 'string') member.ngay_bd = new Date(member.ngay_bd);
  if (typeof member.ngay_hh === 'string') member.ngay_hh = new Date(member.ngay_hh);
  if (typeof member.ngay_dk === 'string') member.ngay_dk = new Date(member.ngay_dk);

  // Fallback ngày đăng ký = ngày bắt đầu nếu không có
  if (!member.ngay_dk || !(member.ngay_dk instanceof Date) || isNaN(member.ngay_dk)) {
    member.ngay_dk = member.ngay_bd instanceof Date ? new Date(member.ngay_bd) : null;
  }

  member.tt      = normalizeStatus(member.tt);
  member.so_ngay = parseInt(member.so_ngay) || 0;
  member.ngay_bu = parseInt(member.ngay_bu) || 0;
  member.gia     = parseFloat(member.gia)   || 0;
  return member;
}

/**
 * Serialize mảng học viên để lưu vào Firebase/localStorage
 * Convert Date objects → ISO string
 */
export function serializeMembers(members) {
  return members.map(m => ({
    id:      m.id,
    ten:     m.ten     || '',
    sdt:     m.sdt     || '',
    ngay_dk: m.ngay_dk instanceof Date ? m.ngay_dk.toISOString() : (m.ngay_dk || ''),
    ngay_bd: m.ngay_bd instanceof Date ? m.ngay_bd.toISOString() : (m.ngay_bd || ''),
    so_ngay: m.so_ngay || 0,
    ngay_hh: m.ngay_hh instanceof Date ? m.ngay_hh.toISOString() : (m.ngay_hh || ''),
    con_lai: m.con_lai || 0,
    ngay_bu: m.ngay_bu || 0,
    tt:      m.tt      || STATUS.ACTIVE,
    ghi_chu: m.ghi_chu || '',
    gia:     m.gia     || 0,
  }));
}

// ── String Utilities ──

/** Xóa dấu tiếng Việt để search không phân biệt dấu */
export function removeVietnameseDiacritics(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Tìm kiếm không phân biệt dấu tiếng Việt */
export function vietnameseSearch(text, query) {
  if (!query) return true;
  const normalizedText  = removeVietnameseDiacritics(text);
  const normalizedQuery = removeVietnameseDiacritics(query);
  return normalizedText.includes(normalizedQuery)
    || String(text).toLowerCase().includes(query.toLowerCase());
}

/** Escape HTML để tránh XSS khi render innerHTML */
export function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

/** Lấy 2 chữ cái đầu của tên (dùng cho avatar) */
export function getNameInitials(fullName) {
  const words = (fullName || '?').trim().split(' ');
  if (words.length > 1) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return words[0].slice(0, 2).toUpperCase();
}

/** Map tên → màu avatar nhất quán */
export function getColorFromName(name, colorPalette) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return colorPalette[hash % colorPalette.length];
}

/** Format số tiền VNĐ gọn (1tr, 500k, ...) */
export function formatCurrencyShort(amount) {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + 'tr';
  if (amount >= 1_000)     return (amount / 1_000).toFixed(0) + 'k';
  return String(amount);
}
