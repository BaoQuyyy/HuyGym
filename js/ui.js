/**
 * ui.js — Render UI: bảng học viên, toast, navigation, clock
 */

import {
  STATUS_LABELS, STATUS_BADGE_CLASS,
  BREADCRUMBS, TOAST_TYPE, WARNING_DAYS,
} from './constants.js';
import {
  escapeHtml, getNameInitials, vietnameseSearch, getMemberTag, formatDate,
} from './utils.js';
import { appState, toastTimer, setToastTimer } from './state.js';

// ── Navigation ──
export function showPage(pageName) {
  // Ẩn tất cả page và nav items
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Hiện page và nav item tương ứng
  document.getElementById('page-' + pageName)?.classList.add('active');
  document.getElementById('nav-' + pageName)?.classList.add('active');

  // Cập nhật breadcrumb
  const breadcrumb = document.getElementById('bc');
  if (breadcrumb) breadcrumb.innerHTML = BREADCRUMBS[pageName] || '';

  // Ẩn/hiện search bar (chỉ show ở dashboard)
  const searchWrap = document.getElementById('sw-wrap');
  if (searchWrap) searchWrap.style.visibility = pageName === 'dashboard' ? '' : 'hidden';

  // Render nội dung page
  switch (pageName) {
    case 'thongke': import('./pages.js').then(({ renderStatsPage })     => renderStatsPage()); break;
    case 'biendog': import('./pages.js').then(({ renderBiendogPage })   => renderBiendogPage()); break;
    case 'log':     import('./log.js').then(({ renderLog })             => renderLog()); break;
    case 'staff':   import('./log.js').then(({ renderStaffPage })       => renderStaffPage()); break;
  }
}

// ── Filter Chip ──
export function setFilterChip(chipValue) {
  appState.activeChip = chipValue;
  document.querySelectorAll('.chip').forEach(el => el.classList.remove('active'));
  document.getElementById('chip-' + chipValue)?.classList.add('active');
  renderTable();
}

// ── Get Filtered + Sorted Members ──
function getFilteredMembers() {
  const searchQuery = document.getElementById('search')?.value.toLowerCase().trim() ?? '';
  let list = [...appState.members];

  // Filter by chip
  if (appState.activeChip !== 'all') {
    list = list.filter(m => getMemberTag(m) === appState.activeChip);
  }

  // Filter by search query
  if (searchQuery) {
    list = list.filter(m =>
      vietnameseSearch(m.ten, searchQuery) ||
      (m.sdt || '').includes(searchQuery) ||
      vietnameseSearch(m.ghi_chu || '', searchQuery)
    );
  }

  return list;
}

// ── Sort by column ──
export function sortByColumn(column) {
  if (appState.sortColumn === column) {
    appState.sortAscending = !appState.sortAscending;
  } else {
    appState.sortColumn    = column;
    appState.sortAscending = true;
  }

  // Update sort arrow UI
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sorted'));
  document.querySelectorAll('.sort-arrow').forEach(arrow => {
    if (arrow.dataset.col === column) {
      arrow.textContent = appState.sortAscending ? '↑' : '↓';
      arrow.closest('th').classList.add('sorted');
    } else {
      arrow.textContent = '↕';
    }
  });

  renderTable();
}

// ── Select / Deselect Row ──
export function selectRow(memberId) {
  appState.selectedMemberId = appState.selectedMemberId === memberId ? null : memberId;
  document.querySelectorAll('tbody tr').forEach(tr => {
    const isSelected = parseInt(tr.dataset.id) === appState.selectedMemberId;
    tr.classList.toggle('selected-row', isSelected);
  });
}

// ── Render Table ──
export function renderTable() {
  const rows = getFilteredMembers();

  // Sort
  rows.sort((a, b) => {
    let valA = a[appState.sortColumn];
    let valB = b[appState.sortColumn];
    if (valA instanceof Date) valA = valA.getTime();
    if (valB instanceof Date) valB = valB.getTime();
    if (valA == null) return 1;
    if (valB == null) return -1;
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (appState.sortAscending) return valA > valB ? 1 : valA < valB ? -1 : 0;
    return valA < valB ? 1 : valA > valB ? -1 : 0;
  });

  // Update stat cards
  const counts = { active: 0, warning: 0, expired: 0, paused: 0 };
  appState.members.forEach(m => counts[getMemberTag(m)]++);
  updateStatCard('s-tong',   appState.members.length);
  updateStatCard('s-active', counts.active);
  updateStatCard('s-warn',   counts.warning);
  updateStatCard('s-exp',    counts.expired);
  updateStatCard('s-pause',  counts.paused);

  // Update row count
  const rowCountEl = document.getElementById('row-count');
  if (rowCountEl) rowCountEl.textContent = rows.length + ' học viên';

  const tbody = document.getElementById('tbody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <div class="empty-icon">🏋️</div>
          <div style="font-weight:600;font-size:14px">Chưa có học viên nào</div>
          <div style="font-size:12px;color:var(--t3)">Nhấn "Thêm" để bắt đầu</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(member => renderMemberRow(member)).join('');
}

function renderMemberRow(member) {
  const tag          = getMemberTag(member);
  const daysLeft     = member.con_lai;
  const daysClass    = daysLeft < 0 ? 'days-expired' : daysLeft <= WARNING_DAYS ? 'days-warning' : 'days-ok';
  const initials     = getNameInitials(member.ten);
  const isSelected   = member.id === appState.selectedMemberId;
  const badgeClass   = STATUS_BADGE_CLASS[tag];
  const statusLabel  = STATUS_LABELS[tag];

  return `
    <tr class="${isSelected ? 'selected-row' : ''}"
        onclick="selectRow(${member.id})"
        ondblclick="openEditMember(${member.id})"
        data-id="${member.id}">
      <td style="color:var(--t2);font-size:11.5px;font-weight:600">#${member.id}</td>
      <td>
        <div class="avatar-cell">
          <div class="avatar">${initials}</div>
          <div>
            <div class="member-name">${escapeHtml(member.ten)}</div>
            <div class="member-phone">${escapeHtml(member.sdt || '—')}</div>
          </div>
        </div>
      </td>
      <td class="col-register-date" style="font-size:12.5px">${formatDate(member.ngay_bd)}</td>
      <td class="col-package number-cell" style="color:var(--t1)">${member.so_ngay}ng</td>
      <td style="font-size:12.5px">${formatDate(member.ngay_hh)}</td>
      <td class="col-days-left number-cell ${daysClass}">${daysLeft}</td>
      <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
      <td class="col-note" style="color:var(--t2);font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis"
          title="${escapeHtml(member.ghi_chu || '')}">
        ${escapeHtml(member.ghi_chu || '—')}
      </td>
      <td>
        <div class="action-cell">
          <button class="action-btn" onclick="event.stopPropagation();openEditMember(${member.id})" title="Sửa">✏️</button>
          <button class="action-btn delete" onclick="event.stopPropagation();deleteById(${member.id})" title="Xóa">🗑️</button>
        </div>
      </td>
    </tr>`;
}

// Animate stat card khi giá trị thay đổi
function updateStatCard(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.textContent != newValue) {
    el.textContent = newValue;
    el.classList.remove('count-updated');
    void el.offsetWidth; // reflow để reset animation
    el.classList.add('count-updated');
  }
}

// ── Toast Notification ──
export function showToast(message, type = TOAST_TYPE.OK) {
  // Xóa toast cũ nếu có
  document.querySelector('.toast')?.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const colorMap = {
    [TOAST_TYPE.OK]:   'var(--green)',
    [TOAST_TYPE.WARN]: 'var(--orange)',
    [TOAST_TYPE.ERR]:  'var(--red)',
  };
  const iconMap = {
    [TOAST_TYPE.OK]:   '✓',
    [TOAST_TYPE.WARN]: '⚠',
    [TOAST_TYPE.ERR]:  '✕',
  };

  const color = colorMap[type] || colorMap[TOAST_TYPE.OK];
  const icon  = iconMap[type]  || '✓';

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.innerHTML = `
    <div class="toast-bar" style="background:${color}"></div>
    <span style="color:${color};font-size:14px;font-weight:700">${icon}</span>
    <span style="color:var(--t0)">${message}</span>`;
  document.body.appendChild(toastEl);

  setToastTimer(setTimeout(() => {
    toastEl.classList.add('hiding');
    setTimeout(() => toastEl.remove(), 280);
  }, 3000));
}

// ── Status Bar ──
export function setStatusBarMessage(message) {
  const msgEl  = document.getElementById('smsg');
  const timeEl = document.getElementById('stime');
  if (msgEl)  msgEl.textContent  = message;
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('vi-VN');
}

// ── Clock ──
export function tickClock() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  const dateEl  = document.getElementById('clock-date');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('vi-VN');
  if (dateEl)  dateEl.textContent  = now.toLocaleDateString('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Mobile Sidebar ──
export function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('show', isOpen);
  hamburger.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

export function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
  document.getElementById('hamburger')?.classList.remove('open');
  document.body.style.overflow = '';
}

export function clearBottomNavActive() {
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
}

// ── Online/Offline Banner ──
export function updateOnlineStatusBanner() {
  const bar = document.getElementById('offline-bar');
  if (!bar) return;
  bar.classList.toggle('show', !navigator.onLine);
}

// ── Jump to member on dashboard ──
export function jumpToDashboard(memberId) {
  import('./log.js').then(({ closeAlertModal }) => closeAlertModal?.());
  showPage('dashboard');
  setTimeout(() => {
    selectRow(memberId);
    const row = document.querySelector(`tbody tr[data-id="${memberId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.transition = 'box-shadow .2s';
      row.style.boxShadow  = '0 0 0 2.5px var(--purple)';
      setTimeout(() => { row.style.boxShadow = ''; }, 2200);
    }
  }, 130);
}
