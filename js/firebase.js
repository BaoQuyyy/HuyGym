/**
 * firebase.js — Quản lý kết nối và đồng bộ Firebase
 */

import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAnalytics }                         from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js';
import { getDatabase, ref, set, onValue }       from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

import { FIREBASE_CONFIG, DB_PATH_MEMBERS, DB_PATH_LOG, STORAGE_KEY_DATA, FIREBASE_TIMEOUT_MS } from './constants.js';
import { parseMemberRecord, serializeMembers, recalculateMember, normalizeStatus }               from './utils.js';
import { appState, logState }                                                                    from './state.js';

// ── Firebase instances ──
const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const firebaseDB = getDatabase(firebaseApp);
export const membersRef = ref(firebaseDB, DB_PATH_MEMBERS);
export const logRef     = ref(firebaseDB, DB_PATH_LOG);

// Khởi analytics (không ảnh hưởng app nếu fail)
try { getAnalytics(firebaseApp); } catch (_e) {}

// ── Firebase Status UI ──
export function setFirebaseStatusUI(statusClass, labelText) {
  const dot   = document.getElementById('fb-dot');
  const label = document.getElementById('fb-label');
  if (!dot || !label) return;
  dot.className   = 'firebase-dot ' + (statusClass || '');
  label.textContent = labelText || 'Firebase';
}

// ── Save to Firebase + localStorage ──
export function saveData() {
  const serialized = serializeMembers(appState.members);
  set(membersRef, serialized).catch(err => {
    console.error('[Firebase] Save error:', err);
    // import toast lazily để tránh circular dep
    import('./ui.js').then(({ showToast }) => showToast('Lỗi lưu Firebase!', 'warn'));
  });
  // Luôn backup localStorage
  try {
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(serialized));
  } catch (_e) {}
}

// ── Load từ localStorage (fallback khi offline) ──
export function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA);
    if (raw) {
      appState.members = JSON.parse(raw).map(r => parseMemberRecord(r));
    } else {
      appState.members = [];
    }
  } catch (_e) {
    appState.members = [];
  }
  recalcAllMembers();
  import('./ui.js').then(({ renderTable, setStatusBarMessage }) => {
    renderTable();
    setStatusBarMessage('Chế độ cục bộ (offline) · ' + appState.members.length + ' học viên');
  });
}

/** Tính lại toàn bộ danh sách học viên */
export function recalcAllMembers() {
  appState.members.forEach(member => {
    member.tt = normalizeStatus(member.tt);
    recalculateMember(member);
  });
}

// ── Init Firebase Sync ──
export function initFirebaseSync() {
  setFirebaseStatusUI('syncing', 'Đang kết nối…');
  const loadingMsg = document.getElementById('loading-msg');
  if (loadingMsg) loadingMsg.textContent = 'Đang tải dữ liệu từ Firebase…';

  // Timeout fallback nếu Firebase chậm
  const timeoutHandle = setTimeout(() => {
    if (!appState.isFirebaseReady) {
      console.warn('[Firebase] Timeout — dùng dữ liệu cục bộ');
      appState.isFirebaseReady = true;
      loadLocalFallback();
      hideLoadingOverlay();
      setFirebaseStatusUI('error', 'Timeout');
      import('./ui.js').then(({ showToast }) =>
        showToast('Firebase chậm — đang dùng dữ liệu cục bộ', 'warn')
      );
    }
  }, FIREBASE_TIMEOUT_MS);

  onValue(membersRef, snapshot => {
    const raw = snapshot.val();
    if (raw !== null && raw !== undefined) {
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      appState.members = arr.filter(Boolean).map(r => parseMemberRecord({ ...r }));
    } else if (!appState.isFirebaseReady) {
      // Firebase rỗng → thử migrate từ localStorage
      try {
        const local = localStorage.getItem(STORAGE_KEY_DATA);
        if (local) {
          appState.members = JSON.parse(local).map(r => parseMemberRecord(r));
          saveData(); // migrate lên Firebase
          import('./ui.js').then(({ showToast }) =>
            showToast('Đã di chuyển localStorage → Firebase ☁️', 'ok')
          );
        } else {
          appState.members = [];
        }
      } catch (_e) {
        appState.members = [];
      }
    } else {
      appState.members = [];
    }

    recalcAllMembers();
    clearTimeout(timeoutHandle);

    if (!appState.isFirebaseReady) {
      appState.isFirebaseReady = true;
      hideLoadingOverlay();
      import('./ui.js').then(({ showToast }) =>
        showToast('Kết nối Firebase thành công! ☁️', 'ok')
      );
    }

    setFirebaseStatusUI('online', 'Đồng bộ ✓');

    import('./ui.js').then(({ renderTable, setStatusBarMessage }) => {
      renderTable();
      setStatusBarMessage(
        'Firebase · ' + appState.members.length + ' học viên · ' +
        new Date().toLocaleTimeString('vi-VN')
      );
    });

    // Backup localStorage
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(serializeMembers(appState.members)));
    } catch (_e) {}

  }, error => {
    console.error('[Firebase] Error:', error);
    setFirebaseStatusUI('error', 'Lỗi kết nối');
    if (!appState.isFirebaseReady) {
      appState.isFirebaseReady = true;
      clearTimeout(timeoutHandle);
      loadLocalFallback();
      hideLoadingOverlay();
      import('./ui.js').then(({ showToast }) =>
        showToast('Không kết nối được Firebase. Dùng dữ liệu cục bộ.', 'warn')
      );
    }
  });
}

// ── Init Log Sync ──
export function initLogSync() {
  onValue(logRef, snapshot => {
    const raw = snapshot.val();
    logState.entries = raw
      ? Object.values(raw).sort((a, b) => b.ts.localeCompare(a.ts))
      : [];

    import('./log.js').then(({ renderLog }) => renderLog());

    // Refresh staff page nếu đang active
    const staffPage = document.getElementById('page-staff');
    if (staffPage?.classList.contains('active')) {
      import('./log.js').then(({ renderStaffPage }) => renderStaffPage());
    }
  }, err => console.error('[Firebase] Log sync error:', err));
}

// ── Helpers ──
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
  import('./auth.js').then(({ initIdentity }) => initIdentity());
}
