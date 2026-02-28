/**
 * constants.js — Hằng số toàn cục của ứng dụng HUY GYM
 * Tập trung tất cả magic numbers và config vào một nơi
 */

// ── Firebase Config ──
export const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyD5lpI3K6c0JtyfR85u8EFPyEKDJKxdWQ0',
  authDomain:        'huygym-16f43.firebaseapp.com',
  databaseURL:       'https://huygym-16f43-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'huygym-16f43',
  storageBucket:     'huygym-16f43.firebasestorage.app',
  messagingSenderId: '1054418294164',
  appId:             '1:1054418294164:web:255994f8c27ac036cdeb81',
  measurementId:     'G-MVD1820M08',
};

// ── Firebase Database Paths ──
export const DB_PATH_MEMBERS = 'gym_members';
export const DB_PATH_LOG     = 'activity_log';

// ── LocalStorage Keys ──
export const STORAGE_KEY_DATA = 'gym_pro_v5';
export const STORAGE_KEY_USER = 'gym_user_v1';
export const STORAGE_KEY_PWA_DISMISSED = 'pwa-dismissed';

// ── Business Logic ──
// Số ngày còn lại ngưỡng "sắp hết hạn"
export const WARNING_DAYS = 7;

// Timeout chờ Firebase kết nối (ms)
export const FIREBASE_TIMEOUT_MS = 6000;

// Mật khẩu Admin (trong thực tế nên dùng Firebase Auth)
export const ADMIN_PASSWORD = '0502';

// ── Member Status Values ──
export const STATUS = {
  ACTIVE:  'active',
  WARNING: 'warning',
  EXPIRED: 'expired',
  PAUSED:  'paused',
};

// ── Status Labels (tiếng Việt) ──
export const STATUS_LABELS = {
  [STATUS.ACTIVE]:  'Hoạt Động',
  [STATUS.WARNING]: 'Sắp HH',
  [STATUS.EXPIRED]: 'Hết Hạn',
  [STATUS.PAUSED]:  'Tạm Dừng',
};

// ── Status Badge CSS Classes ──
export const STATUS_BADGE_CLASS = {
  [STATUS.ACTIVE]:  'badge-active',
  [STATUS.WARNING]: 'badge-warning',
  [STATUS.EXPIRED]: 'badge-expired',
  [STATUS.PAUSED]:  'badge-paused',
};

// ── Action Types for Activity Log ──
export const ACTION = {
  ADD:        'add',
  EDIT:       'edit',
  DELETE:     'delete',
  UPDATE_ALL: 'update_all',
  HOLIDAY:    'holiday',
  IMPORT:     'import',
  UNDO:       'undo',
  LOGIN:      'login',
};

// ── Action Metadata (icon, label, màu sắc) ──
export const ACTION_META = {
  [ACTION.ADD]:        { icon: '➕', label: 'Thêm học viên',    bg: 'rgba(14,168,104,.1)',  color: 'var(--green)'  },
  [ACTION.EDIT]:       { icon: '✏️', label: 'Sửa học viên',     bg: 'rgba(108,71,255,.1)',  color: 'var(--purple)' },
  [ACTION.DELETE]:     { icon: '🗑️', label: 'Xóa học viên',     bg: 'rgba(224,58,106,.1)',  color: 'var(--red)'    },
  [ACTION.UPDATE_ALL]: { icon: '🔁', label: 'Cập nhật tất cả',  bg: 'rgba(14,132,168,.1)',  color: '#0891b2'       },
  [ACTION.HOLIDAY]:    { icon: '🎉', label: 'Bù ngày nghỉ lễ',  bg: 'rgba(224,114,42,.1)',  color: 'var(--orange)' },
  [ACTION.IMPORT]:     { icon: '📂', label: 'Nhập dữ liệu',     bg: 'rgba(108,71,255,.1)',  color: 'var(--purple)' },
  [ACTION.UNDO]:       { icon: '↩️', label: 'Hoàn tác',         bg: 'rgba(74,88,120,.1)',   color: 'var(--t1)'     },
  [ACTION.LOGIN]:      { icon: '🔑', label: 'Đăng nhập',        bg: 'rgba(14,168,104,.1)',  color: 'var(--green)'  },
};

// ── "Other" actions (dùng trong filter log) ──
export const OTHER_ACTIONS = [ACTION.UPDATE_ALL, ACTION.HOLIDAY, ACTION.IMPORT, ACTION.UNDO];

// ── User Role ──
export const ROLE = {
  ADMIN: 'admin',
  USER:  'user',
};

// ── User Avatar Colors ──
export const USER_COLORS = [
  '#6c47ff', '#0ea868', '#e0722a', '#e03a6a',
  '#0891b2', '#7c3aed', '#059669', '#dc2626',
];

// ── Toast Types ──
export const TOAST_TYPE = {
  OK:   'ok',
  WARN: 'warn',
  ERR:  'err',
};

// ── Breadcrumb Labels ──
export const BREADCRUMBS = {
  dashboard: 'Bảng điều khiển <span>/ Danh sách học viên</span>',
  thongke:   'Thống kê <span>/ Báo cáo tổng hợp</span>',
  biendog:   'Biến động <span>/ So sánh tháng</span>',
  log:       '📋 Nhật ký <span>/ Lịch sử hoạt động</span>',
  staff:     '👥 Nhân viên <span>/ Hoạt động theo từng người</span>',
};
