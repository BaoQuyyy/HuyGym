/**
 * log.js — Activity Log + Staff Activity Page
 */

import { ACTION_META, OTHER_ACTIONS, ACTION, ROLE, WARNING_DAYS } from './constants.js';
import { escapeHtml, getDateRangeFromFilter, getNameInitials }     from './utils.js';
import { appState, logState, staffState, authState }               from './state.js';
import { logRef, firebaseDB }                                      from './firebase.js';
import { set, ref }                                                from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { showToast }                                               from './ui.js';

// ── Log an Activity ──
export function logActivity(actionType, data) {
  if (!authState.currentUser) return;

  const entry = {
    id:     Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ts:     new Date().toISOString(),
    user:   authState.currentUser.name,
    role:   authState.currentUser.role,
    color:  authState.currentUser.color,
    action: actionType,
    data,
  };

  logState.entries.unshift(entry);

  // Lưu lên Firebase
  const entryRef = ref(firebaseDB, 'activity_log/' + entry.id);
  set(entryRef, entry).catch(err => console.error('[Log] Save error:', err));

  renderLog();
}

// ── Set Action Filter ──
export function setLogActionFilter(filterValue) {
  logState.actionFilter = filterValue;
  ['all', 'add', 'edit', 'delete', 'other'].forEach(key => {
    document.getElementById('lf-' + key)?.classList.toggle('active', key === filterValue);
  });
  renderLog();
}

// ── Set Date Filter ──
export function setLogDateFilter(dateValue) {
  logState.dateFilter = dateValue;
  ['all', 'today', 'yesterday', 'week', 'month', 'last'].forEach(key => {
    document.getElementById('ld-' + key)?.classList.toggle('active', key === dateValue);
  });

  if (dateValue === 'custom') {
    // Bỏ active tất cả preset buttons
    ['all', 'today', 'yesterday', 'week', 'month', 'last'].forEach(key => {
      document.getElementById('ld-' + key)?.classList.remove('active');
    });
    const fromEl = document.getElementById('ld-from');
    const toEl   = document.getElementById('ld-to');
    logState.customDateFrom = fromEl?.value ? new Date(fromEl.value) : null;
    logState.customDateTo   = toEl?.value   ? new Date(toEl.value + 'T23:59:59') : null;
  } else {
    // Reset custom date inputs
    const fromEl = document.getElementById('ld-from');
    const toEl   = document.getElementById('ld-to');
    if (fromEl) fromEl.value = '';
    if (toEl)   toEl.value   = '';
  }
  renderLog();
}

// ── Get Filtered Log Entries ──
function getFilteredLogEntries() {
  let filtered = [...logState.entries];

  // Filter by action type
  if (logState.actionFilter !== 'all') {
    if (logState.actionFilter === 'other') {
      filtered = filtered.filter(entry => OTHER_ACTIONS.includes(entry.action));
    } else {
      filtered = filtered.filter(entry => entry.action === logState.actionFilter);
    }
  }

  // Filter by date
  if (logState.dateFilter !== 'all') {
    const [fromDate, toDate] = getDateRangeFromFilter(
      logState.dateFilter,
      logState.customDateFrom,
      logState.customDateTo
    );
    filtered = filtered.filter(entry => {
      const entryDate = new Date(entry.ts);
      if (fromDate && entryDate < fromDate) return false;
      if (toDate   && entryDate > toDate)   return false;
      return true;
    });
  }

  return filtered;
}

// ── Render Log Page ──
export function renderLog() {
  const listEl     = document.getElementById('log-list');
  const countEl    = document.getElementById('log-count');
  const clearBtnEl = document.getElementById('clear-log-btn');
  if (!listEl) return;

  const filtered = getFilteredLogEntries();

  if (countEl) countEl.textContent = filtered.length + ' thao tác';
  if (clearBtnEl) {
    clearBtnEl.style.display = authState.currentUser?.role === ROLE.ADMIN ? '' : 'none';
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;color:var(--t2);gap:10px">
        <div style="font-size:40px;opacity:.2">📋</div>
        <div style="font-weight:600">Chưa có hoạt động nào</div>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(entry => renderLogItem(entry)).join('');
}

function renderLogItem(entry) {
  const meta    = ACTION_META[entry.action] || { icon: '⚙️', label: entry.action, bg: 'var(--bg-input)', color: 'var(--t2)' };
  const entryDt = new Date(entry.ts);
  const dateStr = entryDt.toLocaleDateString('vi-VN',  { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = entryDt.toLocaleTimeString('vi-VN',  { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const canUndo  = authState.currentUser?.role === ROLE.ADMIN
    && [ACTION.ADD, ACTION.EDIT, ACTION.DELETE].includes(entry.action);

  const roleBadge = entry.role === ROLE.ADMIN
    ? '<span class="role-admin">Admin</span>'
    : '<span class="role-user">NV</span>';

  const description = buildLogDescription(entry);

  return `
    <div class="log-item">
      <div class="log-icon-wrap" style="background:${meta.bg}">${meta.icon}</div>
      <div class="log-main">
        <div class="log-action">${meta.label}</div>
        <div class="log-detail">${description}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <div class="log-who" style="color:${entry.color || 'var(--purple)'}">${escapeHtml(entry.user || '?')}</div>
          ${roleBadge}
          ${canUndo ? `<button class="undo-btn" onclick="undoEntry('${entry.id}')">↩ Hoàn tác</button>` : ''}
        </div>
      </div>
      <div class="log-time">${dateStr}<br/>${timeStr}</div>
    </div>`;
}

function buildLogDescription(entry) {
  if (!entry.data) return '';
  switch (entry.action) {
    case ACTION.ADD:
      return `Thêm mới: <b>${escapeHtml(entry.data.ten || '')}</b> · ${escapeHtml(entry.data.sdt || '—')} · ${entry.data.so_ngay || 0} ngày`;
    case ACTION.EDIT: {
      let desc = `<b>${escapeHtml(entry.data.after?.ten || entry.data.ten || '')}</b>`;
      if (entry.data.changes && Object.keys(entry.data.changes).length) {
        const parts = Object.entries(entry.data.changes)
          .map(([field, [oldVal, newVal]]) =>
            `${field}: <i>${escapeHtml(String(oldVal || ''))}</i> → <b>${escapeHtml(String(newVal || ''))}</b>`
          );
        desc += ' · ' + parts.slice(0, 3).join(', ') + (parts.length > 3 ? '…' : '');
      }
      return desc;
    }
    case ACTION.DELETE:
      return `Xóa: <b>${escapeHtml(entry.data.ten || '')}</b> · ${escapeHtml(entry.data.sdt || '—')}`;
    case ACTION.UPDATE_ALL:
      return `Cập nhật ${entry.data.count || 0} học viên`;
    case ACTION.HOLIDAY:
      return `Bù ${entry.data.days || 0} ngày cho ${entry.data.count || 0} học viên`;
    case ACTION.IMPORT:
      return `Nhập ${entry.data.count || 0} học viên`;
    case ACTION.UNDO:
      return `Hoàn tác: ${escapeHtml(entry.data.what || '')}`;
    case ACTION.LOGIN:
      return `Đăng nhập từ thiết bị`;
    default:
      return '';
  }
}

// ── Undo a Log Entry ──
export async function undoLogEntry(entryId) {
  if (authState.currentUser?.role !== ROLE.ADMIN) {
    showToast('Chỉ Admin mới có thể hoàn tác!', 'warn');
    return;
  }

  const entry = logState.entries.find(e => e.id === entryId);
  if (!entry) { showToast('Không tìm thấy thao tác!', 'warn'); return; }

  const actionLabel = (ACTION_META[entry.action] || {}).label || entry.action;
  if (!confirm(`Hoàn tác: ${actionLabel} bởi ${entry.user}`)) return;

  let undoDescription = '';
  const { parseMemberRecord, recalculateMember } = await import('./utils.js');
  const { recalcAllMembers, saveData }           = await import('./firebase.js');
  const { renderTable }                          = await import('./ui.js');

  if (entry.action === ACTION.ADD) {
    const beforeLen = appState.members.length;
    appState.members = appState.members.filter(m =>
      !(m.ten === entry.data.ten && m.sdt === entry.data.sdt)
    );
    if (appState.members.length === beforeLen && entry.data.id) {
      appState.members = appState.members.filter(m => m.id !== entry.data.id);
    }
    appState.members.forEach((m, i) => m.id = i + 1);
    undoDescription = 'Hoàn tác thêm: ' + entry.data.ten;

  } else if (entry.action === ACTION.DELETE) {
    const restored = parseMemberRecord({ ...entry.data });
    restored.id = appState.members.length
      ? Math.max(...appState.members.map(m => m.id)) + 1
      : 1;
    appState.members.push(restored);
    recalcAllMembers();
    undoDescription = 'Hoàn tác xóa: ' + entry.data.ten;

  } else if (entry.action === ACTION.EDIT && entry.data.before) {
    const idx = appState.members.findIndex(m => m.id === entry.data.before.id);
    if (idx >= 0) {
      appState.members[idx] = parseMemberRecord({ ...entry.data.before });
      recalculateMember(appState.members[idx]);
    }
    undoDescription = 'Hoàn tác sửa: ' + (entry.data.after?.ten || entry.data.before?.ten || '');
  }

  saveData();
  renderTable();
  logActivity(ACTION.UNDO, { what: undoDescription, ref_id: entryId });
  showToast('Đã hoàn tác thành công! ↩', 'ok');
}

// ── Clear All Logs ──
export function clearAllLogs() {
  if (authState.currentUser?.role !== ROLE.ADMIN) {
    showToast('Chỉ Admin mới có thể xóa log!', 'warn');
    return;
  }
  if (!confirm('Xóa toàn bộ lịch sử hoạt động?\nKhông thể hoàn tác!')) return;

  set(logRef, null).catch(err => console.error('[Log] Clear error:', err));
  logState.entries = [];
  renderLog();
  showToast('Đã xóa toàn bộ lịch sử', 'warn');
}

// ══════════════════════════════════════════════
// STAFF ACTIVITY PAGE
// ══════════════════════════════════════════════

export function setStaffDateFilter(value) {
  staffState.dateFilter = value;
  renderStaffPage();
}

export function selectStaffUser(userName) {
  staffState.selectedUser = userName;
  renderStaffPage();
  document.getElementById('staff-content')?.scrollTo({ top: 0 });
}

function getStaffFilteredLog() {
  let list = [...logState.entries];

  // Filter by date
  if (staffState.dateFilter !== 'all') {
    const [fromDate, toDate] = getDateRangeFromFilter(staffState.dateFilter);
    list = list.filter(entry => {
      const d = new Date(entry.ts);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  // Filter by action
  const actionSelect = document.getElementById('staff-action-sel');
  const actionFilter = actionSelect?.value ?? 'all';
  if (actionFilter !== 'all') {
    if (actionFilter === 'other') {
      list = list.filter(entry => OTHER_ACTIONS.includes(entry.action));
    } else if (actionFilter === 'login') {
      list = list.filter(entry => entry.action === ACTION.LOGIN);
    } else {
      list = list.filter(entry => entry.action === actionFilter);
    }
  }

  return list;
}

export function renderStaffPage() {
  const contentEl   = document.getElementById('staff-content');
  const tabsEl      = document.getElementById('staff-tabs');
  const totalBadge  = document.getElementById('staff-total-badge');
  const adminBadge  = document.getElementById('staff-admin-badge');
  if (!contentEl || !tabsEl) return;

  // Chỉ admin mới xem được
  if (adminBadge) adminBadge.style.display = authState.currentUser?.role === ROLE.ADMIN ? '' : 'none';
  if (authState.currentUser?.role !== ROLE.ADMIN) {
    tabsEl.innerHTML = '';
    contentEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:80px 20px;color:var(--t2);gap:14px">
        <div style="font-size:52px;opacity:.15">🔒</div>
        <div style="font-weight:700;font-size:15px;color:var(--t0)">Chỉ Admin mới xem được</div>
        <div style="font-size:12px;text-align:center;max-width:280px">
          Đăng nhập với tài khoản Admin để xem lịch sử hoạt động của từng nhân viên
        </div>
      </div>`;
    return;
  }

  const filteredLog = getStaffFilteredLog();

  // Group by user
  const byUser = {};
  filteredLog.forEach(entry => {
    const userName = entry.user || '?';
    if (!byUser[userName]) {
      byUser[userName] = { name: userName, color: entry.color || 'var(--purple)', role: entry.role || ROLE.USER, entries: [] };
    }
    byUser[userName].entries.push(entry);
  });

  const users     = Object.values(byUser).sort((a, b) => b.entries.length - a.entries.length);
  const totalCount = filteredLog.length;

  if (totalBadge) totalBadge.textContent = totalCount + ' thao tác · ' + users.length + ' người';

  // Validate selected user vẫn tồn tại
  if (staffState.selectedUser !== 'all' && !byUser[staffState.selectedUser]) {
    staffState.selectedUser = 'all';
  }

  // Render tabs
  tabsEl.innerHTML = renderStaffTabs(users, totalCount);

  if (!filteredLog.length) {
    contentEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;color:var(--t2);gap:10px">
        <div style="font-size:44px;opacity:.15">📋</div>
        <div style="font-weight:600;font-size:14px">Chưa có hoạt động nào</div>
      </div>`;
    return;
  }

  const usersToShow = staffState.selectedUser === 'all'
    ? users
    : users.filter(u => u.name === staffState.selectedUser);

  if (!usersToShow.length) {
    contentEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t2);font-size:13px">Không có dữ liệu</div>`;
    return;
  }

  contentEl.innerHTML = usersToShow.map(u => renderStaffUserBlock(u)).join('');
}

function renderStaffTabs(users, totalCount) {
  const isAllSelected = staffState.selectedUser === 'all';
  const allTabStyle = isAllSelected
    ? 'background:var(--purple);color:#fff;border-color:var(--purple);'
    : 'background:#fff;color:var(--t1);border-color:var(--border2);';

  const allTab = `
    <button onclick="staffSelectUser('all')" style="
      display:flex;align-items:center;gap:7px;padding:7px 14px;border-radius:99px;border:2px solid;
      cursor:pointer;font-family:var(--font-body);font-size:12px;font-weight:700;white-space:nowrap;transition:all .15s;
      ${allTabStyle}">
      <span>👥</span>
      <span>Tất cả</span>
      <span style="font-size:10.5px;padding:1px 7px;border-radius:99px;font-weight:700;
        ${isAllSelected ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:var(--purple-soft);color:var(--purple)'}">
        ${totalCount}
      </span>
    </button>`;

  const userTabs = users.map(user => {
    const isSelected = staffState.selectedUser === user.name;
    const roleIcon   = user.role === ROLE.ADMIN ? '👑' : '👤';
    const tabStyle   = isSelected
      ? `background:${user.color};color:#fff;border-color:${user.color};`
      : 'background:#fff;color:var(--t1);border-color:var(--border2);';

    return `
      <button onclick="staffSelectUser('${escapeHtml(user.name)}')" style="
        display:flex;align-items:center;gap:7px;padding:7px 14px;border-radius:99px;border:2px solid;
        cursor:pointer;font-family:var(--font-body);font-size:12px;font-weight:700;white-space:nowrap;transition:all .15s;
        ${tabStyle}">
        <span style="width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;
          ${isSelected ? 'background:rgba(255,255,255,.25);color:#fff;' : `background:${user.color}22;color:${user.color}`}">
          ${getNameInitials(user.name)}
        </span>
        <span>${escapeHtml(user.name)}</span>
        <span style="font-size:10.5px;">${roleIcon}</span>
        <span style="font-size:10.5px;padding:1px 7px;border-radius:99px;font-weight:700;
          ${isSelected ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:#f0f3fa;color:var(--t1)'}">
          ${user.entries.length}
        </span>
      </button>`;
  }).join('');

  return allTab + userTabs;
}

function renderStaffUserBlock(user) {
  const ACTION_COUNT_KEYS = [ACTION.ADD, ACTION.EDIT, ACTION.DELETE, ACTION.UPDATE_ALL, ACTION.HOLIDAY, ACTION.IMPORT, ACTION.UNDO];
  const counts = {};
  ACTION_COUNT_KEYS.forEach(k => counts[k] = 0);
  user.entries.forEach(entry => {
    if (counts[entry.action] !== undefined) counts[entry.action]++;
  });

  const chips = [
    { key: ACTION.ADD,        icon: '➕', color: 'var(--green)'  },
    { key: ACTION.EDIT,       icon: '✏️', color: 'var(--purple)' },
    { key: ACTION.DELETE,     icon: '🗑',  color: 'var(--red)'    },
    { key: ACTION.UPDATE_ALL, icon: '🔁', color: '#0891b2'       },
    { key: ACTION.HOLIDAY,    icon: '🎉', color: 'var(--orange)' },
    { key: ACTION.IMPORT,     icon: '📂', color: 'var(--purple)' },
    { key: ACTION.UNDO,       icon: '↩️', color: 'var(--t1)'     },
  ]
    .filter(c => counts[c.key] > 0)
    .map(c => `
      <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;
        background:${c.color}18;border:1.5px solid ${c.color}44;color:${c.color};font-size:11px;font-weight:700">
        ${c.icon} ${counts[c.key]}
      </span>`)
    .join('');

  const lastEntry  = user.entries[0];
  const lastDt     = lastEntry ? new Date(lastEntry.ts) : null;
  const lastStr    = lastDt
    ? lastDt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' +
      lastDt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const entryRows = user.entries.slice(0, 50).map(entry => {
    const meta     = ACTION_META[entry.action] || { icon: '⚙️', label: entry.action, bg: 'var(--bg-input)' };
    const entryDt  = new Date(entry.ts);
    const timeStr  = entryDt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                     entryDt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const desc     = buildLogDescription(entry);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);transition:background .1s"
           onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <div style="width:28px;height:28px;border-radius:8px;background:${meta.bg};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">
          ${meta.icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--t0)">${meta.label}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:1px">${desc || '—'}</div>
        </div>
        <div style="font-size:10px;color:var(--t2);text-align:right;flex-shrink:0;white-space:nowrap">${timeStr}</div>
      </div>`;
  }).join('');

  const moreCount = user.entries.length - 50;

  return `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;overflow:hidden;margin:12px 16px">
      <div style="padding:14px 18px;border-bottom:1.5px solid var(--border);display:flex;align-items:center;gap:12px;
           background:linear-gradient(135deg,${user.color}0d,transparent)">
        <div style="width:44px;height:44px;border-radius:50%;background:${user.color}22;border:2px solid ${user.color}44;
             display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${user.color};flex-shrink:0">
          ${getNameInitials(user.name)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-family:var(--font-heading);font-size:15px;font-weight:800;color:var(--t0)">${escapeHtml(user.name)}</span>
            <span class="${user.role === ROLE.ADMIN ? 'role-admin' : 'role-user'}">${user.role === ROLE.ADMIN ? '👑 Admin' : '👤 Nhân viên'}</span>
          </div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Hoạt động gần nhất: ${lastStr}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${chips}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-heading);font-size:26px;font-weight:800;color:${user.color};line-height:1">${user.entries.length}</div>
          <div style="font-size:9.5px;color:var(--t2);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-top:2px">thao tác</div>
        </div>
      </div>
      ${entryRows}
      ${moreCount > 0 ? `<div style="text-align:center;padding:10px;color:var(--t2);font-size:11px;background:#fafbff;border-top:1px solid var(--border)">... và ${moreCount} thao tác khác</div>` : ''}
    </div>`;
}

// ── Alert Modal (dùng cho thống kê) ──
export function openAlertModal(type) {
  const isWarning = type === 'warn';
  const list      = isWarning ? appState.warningMembers : appState.expiredMembers;
  const color     = isWarning ? 'var(--orange)' : 'var(--red)';
  const bgColor   = isWarning ? 'var(--orange-soft)' : 'var(--red-soft)';
  const borderCol = isWarning ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)';
  const gradient  = isWarning
    ? 'linear-gradient(90deg,var(--orange),#ffc44a)'
    : 'linear-gradient(90deg,var(--red),#ff7050)';

  document.getElementById('am-bar').style.background = gradient;
  document.getElementById('am-icon').textContent = isWarning ? '⚠️' : '🔴';
  document.getElementById('am-title').textContent = isWarning
    ? `Sắp hết hạn trong ${WARNING_DAYS} ngày`
    : 'Đã hết hạn — Cần gọi gia hạn';

  const countEl = document.getElementById('am-cnt');
  if (countEl) {
    countEl.textContent = list.length + ' học viên';
    countEl.style.cssText = `background:${bgColor};color:${color};border:1.5px solid ${borderCol};border-radius:99px;padding:3px 10px;font-size:11px;font-weight:700;flex-shrink:0`;
  }

  const rows = list.map(member => {
    const daysValue   = isWarning ? member.con_lai : Math.abs(member.con_lai);
    const daysLabel   = isWarning ? 'ngày còn' : 'ngày quá';
    const prefix      = isWarning ? '' : '+';
    const isUrgent    = isWarning && member.con_lai <= 2;
    const itemColor   = isUrgent ? 'var(--red)' : color;
    const itemBg      = isUrgent ? 'var(--red-soft)' : bgColor;
    const itemBorder  = isUrgent ? 'rgba(239,68,68,.3)' : borderCol;

    return `
      <div class="alert-modal-row">
        <div style="width:28px;flex-shrink:0;font-size:11px;color:var(--t2);font-weight:700">#${member.id}</div>
        <div style="flex:1;min-width:0">
          <div onclick="jumpToDashboard(${member.id})"
               style="font-weight:700;font-size:13px;color:${isWarning ? 'var(--t0)' : 'var(--red)'};cursor:pointer;text-decoration:underline;text-underline-offset:2px">
            ${escapeHtml(member.ten)} ↗
          </div>
          <div style="font-size:12px;color:var(--t1);margin-top:2px">${escapeHtml(member.sdt || '—')}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">HH: ${member.ngay_hh?.toLocaleDateString?.('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) ?? '—'}</div>
        </div>
        <div style="flex-shrink:0;width:68px;text-align:center;background:${itemBg};border:1.5px solid ${itemBorder};border-radius:10px;padding:7px 5px">
          <div style="font-family:var(--font-heading);font-size:20px;font-weight:800;color:${itemColor};line-height:1">${prefix}${daysValue}</div>
          <div style="font-size:9.5px;color:${itemColor};opacity:.75;margin-top:2px">${daysLabel}</div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('am-body').innerHTML = rows || '<div style="padding:32px;text-align:center;color:var(--t2)">Không có dữ liệu</div>';
  document.getElementById('am')?.classList.add('show');
}

export function closeAlertModal() {
  document.getElementById('am')?.classList.remove('show');
}
