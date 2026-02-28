/**
 * crud.js — Thêm / Sửa / Xóa học viên
 */

import { STATUS, ACTION }                             from './constants.js';
import {
  parseMemberRecord, serializeMembers,
  recalculateMember, normalizeStatus,
  diffDays, getTodayDate, computeStatusFromDaysLeft,
} from './utils.js';
import { appState }                                   from './state.js';
import { saveData, recalcAllMembers }                 from './firebase.js';
import { showToast, renderTable, setStatusBarMessage } from './ui.js';
import { logActivity }                                from './log.js';

// ── Mở form Thêm mới ──
export function openAddMember() {
  appState.editingMemberId = null;
  document.getElementById('mft').textContent = 'Thêm Học Viên Mới';

  // Ẩn info ngày đăng ký
  const infoEl = document.getElementById('f-ngay-dk-info');
  if (infoEl) { infoEl.textContent = ''; infoEl.style.display = 'none'; }

  // Reset form fields
  ['f-ten', 'f-sdt', 'f-ghi-chu'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-ngay-bd').value = new Date().toISOString().slice(0, 10);
  document.getElementById('f-so-ngay').value = '';
  document.getElementById('f-ngay-bu').value = '0';
  document.getElementById('f-tt').value      = STATUS.ACTIVE;
  document.getElementById('f-gia').value     = '';

  document.getElementById('mf').classList.add('show');
  setTimeout(() => document.getElementById('f-ten')?.focus(), 180);
}

// ── Mở form Sửa ──
export function openEditMember(memberId) {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) return;

  appState.editingMemberId = memberId;
  document.getElementById('mft').textContent = 'Chỉnh Sửa: ' + member.ten;

  document.getElementById('f-ten').value    = member.ten     || '';
  document.getElementById('f-sdt').value    = member.sdt     || '';
  document.getElementById('f-ngay-bd').value = member.ngay_bd instanceof Date
    ? member.ngay_bd.toISOString().slice(0, 10) : '';
  document.getElementById('f-so-ngay').value = member.so_ngay || '';
  document.getElementById('f-ngay-bu').value = member.ngay_bu ?? 0;
  document.getElementById('f-gia').value    = member.gia     || '';
  document.getElementById('f-tt').value     = member.tt      || STATUS.ACTIVE;
  document.getElementById('f-ghi-chu').value = member.ghi_chu || '';

  // Hiển thị ngày đăng ký đầu tiên
  const infoEl = document.getElementById('f-ngay-dk-info');
  if (infoEl && member.ngay_dk) {
    infoEl.textContent = '📅 Ngày đăng ký đầu tiên: ' + member.ngay_dk.toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    infoEl.style.display = 'block';
  }

  document.getElementById('mf').classList.add('show');
  setTimeout(() => document.getElementById('f-ten')?.focus(), 180);
}

// ── Sửa học viên đang chọn ──
export function editSelectedMember() {
  if (!appState.selectedMemberId) {
    showToast('Chọn học viên cần sửa!', 'warn');
    return;
  }
  openEditMember(appState.selectedMemberId);
}

// ── Đóng form ──
export function closeForm() {
  document.getElementById('mf')?.classList.remove('show');
}

// ── Lưu form (Thêm hoặc Sửa) ──
export function saveForm() {
  // Validate
  const name = document.getElementById('f-ten').value.trim();
  if (!name) { showToast('Vui lòng nhập Họ Tên!', 'err'); return; }

  const startDateStr = document.getElementById('f-ngay-bd').value;
  if (!startDateStr) { showToast('Vui lòng chọn Ngày Đăng Ký!', 'err'); return; }

  const packageStr = document.getElementById('f-so-ngay').value;
  if (!packageStr) { showToast('Vui lòng chọn Gói Tập!', 'err'); return; }

  // Parse values
  const startDate    = new Date(startDateStr);
  const packageDays  = parseInt(packageStr);
  const bonusDays    = parseInt(document.getElementById('f-ngay-bu').value) || 0;
  const note         = document.getElementById('f-ghi-chu').value.trim();
  const price        = parseFloat(document.getElementById('f-gia').value) || 0;
  let   status       = document.getElementById('f-tt').value;
  const phone        = document.getElementById('f-sdt').value.trim();

  // Tính ngày hết hạn và số ngày còn lại
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + packageDays + bonusDays);
  const daysLeft = diffDays(expiryDate, getTodayDate());

  // Tự động cập nhật status (trừ khi đang tạm dừng)
  if (status !== STATUS.PAUSED) {
    status = computeStatusFromDaysLeft(daysLeft);
  }

  const formData = {
    ten:     name,
    sdt:     phone,
    ngay_bd: startDate,
    so_ngay: packageDays,
    ngay_hh: expiryDate,
    con_lai: daysLeft,
    ngay_bu: bonusDays,
    tt:      status,
    ghi_chu: note,
    gia:     price,
  };

  if (appState.editingMemberId !== null) {
    // ── Sửa ──
    const memberIndex = appState.members.findIndex(m => m.id === appState.editingMemberId);
    if (memberIndex >= 0) {
      const existing = appState.members[memberIndex];

      // Snapshot trước khi sửa (để log)
      const beforeSnapshot = buildDateSafeSnapshot(existing);

      // Giữ lại ngày đăng ký đầu tiên (không ghi đè)
      const originalRegisterDate = existing.ngay_dk;
      appState.members[memberIndex] = { ...existing, ...formData };
      if (originalRegisterDate) appState.members[memberIndex].ngay_dk = originalRegisterDate;

      const afterSnapshot = buildDateSafeSnapshot(appState.members[memberIndex]);

      // Tính các thay đổi để log
      const changedFields = computeChangedFields(beforeSnapshot, afterSnapshot);
      logActivity(ACTION.EDIT, {
        before: beforeSnapshot,
        after:  afterSnapshot,
        changes: changedFields,
        ten: name,
      });
    }
    showToast('Đã cập nhật: ' + name, 'ok');
  } else {
    // ── Thêm mới ──
    const newId = appState.members.length
      ? Math.max(...appState.members.map(m => m.id)) + 1
      : 1;

    const newMember = { id: newId, ...formData, ngay_dk: startDate };
    appState.members.push(newMember);

    logActivity(ACTION.ADD, {
      ...serializeMembers([newMember])[0],
      id: newId,
    });
    showToast('Đã thêm: ' + name, 'ok');
  }

  saveData();
  renderTable();
  closeForm();
  setStatusBarMessage('Đã lưu: ' + name);
}

// ── Xóa theo ID ──
export function deleteById(memberId) {
  appState.selectedMemberId = memberId;
  confirmDeleteSelected();
}

// ── Mở dialog xác nhận xóa ──
export function confirmDeleteSelected() {
  if (!appState.selectedMemberId) {
    showToast('Chọn học viên cần xóa!', 'warn');
    return;
  }
  appState.deletingMemberId = appState.selectedMemberId;
  const member = appState.members.find(m => m.id === appState.deletingMemberId);
  const nameEl = document.getElementById('cnm');
  if (nameEl) nameEl.textContent = member?.ten ?? '';
  document.getElementById('mc')?.classList.add('show');
}

// ── Đóng dialog xác nhận ──
export function closeConfirmDialog() {
  document.getElementById('mc')?.classList.remove('show');
  appState.deletingMemberId = null;
}

// ── Thực hiện xóa sau khi xác nhận ──
export function executeDelete() {
  if (!appState.deletingMemberId) return;

  const member = appState.members.find(m => m.id === appState.deletingMemberId);
  if (member) {
    logActivity(ACTION.DELETE, buildDateSafeSnapshot(member));
  }

  // Xóa và renumber ID
  appState.members = appState.members.filter(m => m.id !== appState.deletingMemberId);
  appState.members.forEach((m, index) => m.id = index + 1);

  appState.selectedMemberId = null;
  appState.deletingMemberId = null;

  saveData();
  renderTable();
  closeConfirmDialog();
  showToast('Đã xóa: ' + (member?.ten ?? ''), 'warn');
}

// ── Cập nhật tất cả (tính lại ngày hết hạn) ──
export function updateAllMembers() {
  recalcAllMembers();
  saveData();
  renderTable();
  logActivity(ACTION.UPDATE_ALL, { count: appState.members.length });
  showToast('Đã cập nhật ' + appState.members.length + ' học viên', 'ok');
  setStatusBarMessage('Cập nhật xong ' + appState.members.length + ' học viên');
}

// ── Bù ngày nghỉ lễ ──
export function addHolidayBonus() {
  const input = prompt('Số ngày bù cho Hoạt Động + Sắp Hết Hạn:', '1');
  const bonusDays = parseInt(input);
  if (!bonusDays || bonusDays < 1) return;

  let updatedCount = 0;
  appState.members.forEach(member => {
    if (member.tt === STATUS.ACTIVE || member.tt === STATUS.WARNING) {
      member.ngay_bu = (member.ngay_bu || 0) + bonusDays;
      recalculateMember(member);
      updatedCount++;
    }
  });

  saveData();
  renderTable();
  logActivity(ACTION.HOLIDAY, { days: bonusDays, count: updatedCount });
  showToast(`Đã bù ${bonusDays} ngày cho ${updatedCount} học viên`, 'ok');
}

// ── Export JSON ──
export function exportData() {
  const json    = JSON.stringify(serializeMembers(appState.members), null, 2);
  const blob    = new Blob([json], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href   = url;
  anchor.download = 'gym_data_' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Đã xuất file JSON!', 'ok');
}

// ── Import JSON ──
export function importData() {
  document.getElementById('ii')?.click();
}

export function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      let data = JSON.parse(ev.target.result);
      if (!Array.isArray(data) && data.records) data = data.records;
      if (!Array.isArray(data)) throw new Error('Invalid format');

      appState.members = data.map(r => parseMemberRecord({ ...r }));
      recalcAllMembers();
      saveData();
      renderTable();
      logActivity(ACTION.IMPORT, { count: appState.members.length });
      showToast(`Đã nhập ${appState.members.length} học viên → Firebase ☁️`, 'ok');
    } catch (_e) {
      showToast('File JSON không hợp lệ!', 'err');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input để có thể import lại cùng file
}

// ── Helpers ──

/** Tạo snapshot an toàn (Date → ISO string) để lưu vào log */
function buildDateSafeSnapshot(member) {
  return {
    ...member,
    ngay_bd: member.ngay_bd instanceof Date ? member.ngay_bd.toISOString() : member.ngay_bd,
    ngay_hh: member.ngay_hh instanceof Date ? member.ngay_hh.toISOString() : member.ngay_hh,
    ngay_dk: member.ngay_dk instanceof Date ? member.ngay_dk.toISOString() : member.ngay_dk,
  };
}

/** So sánh before/after để tìm các field thay đổi */
function computeChangedFields(before, after) {
  const FIELD_LABELS = {
    ten: 'Tên', sdt: 'SĐT', so_ngay: 'Gói',
    ngay_bu: 'Ngày bù', tt: 'T.thái', ghi_chu: 'Ghi chú', gia: 'Giá',
  };
  const changes = {};
  Object.keys(FIELD_LABELS).forEach(key => {
    if (String(before[key] ?? '') !== String(after[key] ?? '')) {
      changes[FIELD_LABELS[key]] = [before[key] ?? '', after[key] ?? ''];
    }
  });
  return changes;
}
