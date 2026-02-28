/**
 * app.js — Entry point: khởi động ứng dụng HUY GYM
 * Import tất cả modules và expose các function cần thiết ra window
 */

import { STORAGE_KEY_PWA_DISMISSED } from './constants.js';
import { appState }                  from './state.js';

import { initFirebaseSync, initLogSync } from './firebase.js';
import { initIdentity, doLogin, doLogout, selectRole } from './auth.js';
import {
  showPage, setFilterChip, sortByColumn, selectRow,
  toggleSidebar, closeSidebar, clearBottomNavActive,
  updateOnlineStatusBanner, setStatusBarMessage, tickClock,
  jumpToDashboard,
} from './ui.js';
import {
  openAddMember, openEditMember, editSelectedMember,
  closeForm, saveForm,
  confirmDeleteSelected, deleteById, closeConfirmDialog, executeDelete,
  updateAllMembers, addHolidayBonus,
  exportData, importData, handleImportFile,
} from './crud.js';
import {
  renderStatsPage, renderBiendogPage,
  biendogGoToday, biendogChangeThis, biendogChangePrev,
} from './pages.js';
import {
  renderLog, renderStaffPage,
  setLogActionFilter, setLogDateFilter,
  undoLogEntry, clearAllLogs,
  setStaffDateFilter, selectStaffUser,
  openAlertModal, closeAlertModal,
} from './log.js';

// ── Expose tất cả functions ra window (vì HTML dùng onclick=...) ──
Object.assign(window, {
  // Navigation
  showPage, closeSidebar, toggleSidebar, clearBottomNavActive,

  // Member CRUD
  openAdd:         openAddMember,
  openEditMember,
  editSel:         editSelectedMember,
  closeForm,
  saveForm,
  delSel:          confirmDeleteSelected,
  deleteById,
  closeConfirm:    closeConfirmDialog,
  confirmDelete:   executeDelete,

  // Bulk actions
  capNhatTatCa:    updateAllMembers,
  buNgayLe:        addHolidayBonus,
  exportData,
  importData,
  handleImport:    handleImportFile,

  // Table
  sortBy:          sortByColumn,
  selectRow,
  setChip:         setFilterChip,

  // Pages — expose cả tên gốc (dùng trong pages.js onclick) và alias
  renderTK:           renderStatsPage,
  renderBD:           renderBiendogPage,
  biendogGoToday,
  biendogChangeThis,
  biendogChangePrev,
  bdGoToday:          biendogGoToday,
  bdChangeThis:       biendogChangeThis,
  bdChangePrev:       biendogChangePrev,

  // Alert Modal
  openAlertModal,
  closeAM:         closeAlertModal,
  jumpToDashboard,

  // Auth
  doLogin, doLogout, selectRole,

  // Log
  setLogFilter:    setLogActionFilter,
  setLogDate:      setLogDateFilter,
  undoEntry:       undoLogEntry,
  clearAllLogs,
  renderStaff:     renderStaffPage,
  staffSelectUser: selectStaffUser,
  setStaffDate:    setStaffDateFilter,
});

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', e => {
  const isFormOpen = document.getElementById('mf')?.classList.contains('show');
  if (e.key === 'Delete' && appState.selectedMemberId != null && !isFormOpen) {
    confirmDeleteSelected();
  }
  if (e.key === 'Escape') {
    closeForm();
    closeConfirmDialog();
    closeAlertModal();
  }
});

// ── Close modals on backdrop click ──
['mf', 'mc'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if (e.target === this) {
      closeForm();
      closeConfirmDialog();
    }
  });
});

// ── PWA: Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW failed:', err));
  });
}

// ── PWA: Install Banner ──
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('pwa-banner');
  if (banner && !localStorage.getItem(STORAGE_KEY_PWA_DISMISSED)) {
    banner.classList.add('show');
  }
});

document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    import('./ui.js').then(({ showToast }) => showToast('HUY GYM đã được cài đặt! 📱', 'ok'));
  }
  deferredInstallPrompt = null;
  document.getElementById('pwa-banner')?.classList.remove('show');
});

document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
  document.getElementById('pwa-banner')?.classList.remove('show');
  localStorage.setItem(STORAGE_KEY_PWA_DISMISSED, '1');
});

// ── Online/Offline Status ──
window.addEventListener('online',  updateOnlineStatusBanner);
window.addEventListener('offline', updateOnlineStatusBanner);
updateOnlineStatusBanner();

// ── Init App ──
setStatusBarMessage('Đang kết nối Firebase…');
setInterval(tickClock, 1000);
tickClock();
initFirebaseSync();
initLogSync();
