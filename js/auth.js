/**
 * auth.js — Xử lý đăng nhập / identity người dùng
 */

import { STORAGE_KEY_USER, ADMIN_PASSWORD, ROLE, USER_COLORS } from './constants.js';
import { getColorFromName, getNameInitials }                    from './utils.js';
import { authState }                                            from './state.js';
import { showToast }                                            from './ui.js';
import { logActivity }                                          from './log.js';

// ── Chọn Role trong form login ──
export function selectRole(role) {
  authState.selectedRole = role;

  const btnAdmin   = document.getElementById('role-btn-admin');
  const btnUser    = document.getElementById('role-btn-user');
  const passRow    = document.getElementById('admin-pass-row');

  if (btnAdmin) btnAdmin.classList.toggle('selected', role === ROLE.ADMIN);
  if (btnUser)  btnUser.classList.toggle('selected',  role === ROLE.USER);

  // Hiện ô mật khẩu chỉ khi chọn Admin
  if (passRow) {
    passRow.style.display = role === ROLE.ADMIN ? 'block' : 'none';
    if (role === ROLE.ADMIN) {
      setTimeout(() => document.getElementById('login-pass')?.focus(), 50);
    }
  }
}

// ── Đăng nhập ──
export function doLogin() {
  const nameInput = document.getElementById('login-name');
  const passInput = document.getElementById('login-pass');
  const name = nameInput?.value.trim() ?? '';

  if (!name) {
    nameInput?.focus();
    showToast('Vui lòng nhập tên!', 'warn');
    return;
  }

  // Kiểm tra mật khẩu nếu chọn Admin
  if (authState.selectedRole === ROLE.ADMIN) {
    const password = passInput?.value.trim() ?? '';
    if (password !== ADMIN_PASSWORD) {
      showToast('Mật khẩu Admin không đúng!', 'err');
      if (passInput) {
        passInput.value = '';
        passInput.focus();
        passInput.style.borderColor = 'var(--red)';
        setTimeout(() => { passInput.style.borderColor = ''; }, 1500);
      }
      return;
    }
  }

  authState.currentUser = {
    name,
    role:  authState.selectedRole,
    color: getColorFromName(name, USER_COLORS),
  };

  // Lưu session vào localStorage
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authState.currentUser));
  } catch (_e) {}

  // Ẩn login overlay
  document.getElementById('login-overlay')?.classList.add('hidden');

  updateUserBadge();
  logActivity('login', { device: navigator.userAgent.slice(0, 60) });

  const greeting = authState.selectedRole === ROLE.ADMIN ? '👑' : '👋';
  showToast(`Xin chào, ${name} ${greeting}`, 'ok');
}

// ── Đăng xuất / Đổi người dùng ──
export function doLogout() {
  if (!confirm('Đổi người dùng?\n(Dữ liệu không bị ảnh hưởng)')) return;

  authState.currentUser = null;
  try { localStorage.removeItem(STORAGE_KEY_USER); } catch (_e) {}

  // Reset form login
  const nameInput = document.getElementById('login-name');
  const passInput = document.getElementById('login-pass');
  if (nameInput) nameInput.value = '';
  if (passInput) passInput.value = '';
  selectRole(ROLE.USER);

  document.getElementById('login-overlay')?.classList.remove('hidden');
}

// ── Cập nhật User Badge trên topbar ──
export function updateUserBadge() {
  if (!authState.currentUser) return;
  const { name, role, color } = authState.currentUser;

  const avatarEl   = document.getElementById('user-avatar');
  const nameEl     = document.getElementById('user-name-display');
  const roleEl     = document.getElementById('user-role-display');

  if (avatarEl) {
    avatarEl.textContent = getNameInitials(name);
    avatarEl.style.background = color;
  }
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role === ROLE.ADMIN ? '👑 Admin' : '👤 Nhân viên';
}

// ── Khởi tạo Identity khi app load ──
export function initIdentity() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      const user = JSON.parse(saved);
      if (user?.name) {
        authState.currentUser = user;
        updateUserBadge();
        return; // Đã có session → không cần show login
      }
    }
  } catch (_e) {}

  // Chưa có session → hiện login
  document.getElementById('login-overlay')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('login-name')?.focus(), 80);
}
