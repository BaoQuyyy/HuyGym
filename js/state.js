/**
 * state.js — Quản lý state tập trung của ứng dụng
 * Thay vì để biến global rải rác, tất cả state nằm ở đây
 */

// ── App State ──
export const appState = {
  // Danh sách học viên
  members: [],

  // Học viên đang được chọn trên bảng
  selectedMemberId: null,

  // ID đang edit (null = đang thêm mới)
  editingMemberId: null,

  // ID đang chờ xác nhận xóa
  deletingMemberId: null,

  // Firebase đã sẵn sàng chưa
  isFirebaseReady: false,

  // Sort state của bảng
  sortColumn: 'id',
  sortAscending: true,

  // Filter chip đang active
  activeChip: 'all',

  // Cache danh sách sắp hết hạn / đã hết hạn (dùng cho modal alert)
  warningMembers: [],
  expiredMembers: [],

  // Biến động page state
  biendongThisYear:  new Date().getFullYear(),
  biendongThisMonth: new Date().getMonth(),
  biendongPrevYear:  null,
  biendongPrevMonth: null,
};

// ── Log State ──
export const logState = {
  entries: [],
  actionFilter: 'all',      // 'all' | 'add' | 'edit' | 'delete' | 'other'
  dateFilter:   'all',      // 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last' | 'custom'
  customDateFrom: null,
  customDateTo:   null,
};

// ── Staff Page State ──
export const staffState = {
  dateFilter:    'all',
  selectedUser:  'all',
};

// ── Auth State ──
export const authState = {
  currentUser: null,     // { name, role, color } hoặc null
  selectedRole: 'user',  // role đang chọn trong form login
};

// ── Toast Timer (để clear khi có toast mới) ──
export let toastTimer = null;
export function setToastTimer(timer) { toastTimer = timer; }
