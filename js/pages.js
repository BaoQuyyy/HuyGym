/**
 * pages.js — Render các trang: Thống kê, Biến động
 */

import { WARNING_DAYS, STATUS }                from './constants.js';
import { getMemberTag, formatDate, formatMonthKey, formatMonthKeyFromParts, escapeHtml, formatCurrencyShort } from './utils.js';
import { appState }                            from './state.js';
import { openAlertModal }                      from './log.js';
import { jumpToDashboard }                     from './ui.js';

// ══════════════════════════════════════════════
// TRANG THỐNG KÊ
// ══════════════════════════════════════════════

export function renderStatsPage() {
  const container = document.getElementById('tkp');
  if (!container) return;

  const now = new Date();
  const timestampStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Gom nhóm theo tháng
  const monthMap = {};
  appState.members.forEach(member => {
    if (!(member.ngay_hh instanceof Date) || isNaN(member.ngay_hh)) return;
    const monthKey     = formatMonthKey(member.ngay_hh);
    const sortableKey  = member.ngay_hh.getFullYear() * 100 + member.ngay_hh.getMonth();
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { mk: monthKey, key: sortableKey, total: 0, active: 0, warning: 0, expired: 0, paused: 0, rev: 0 };
    }
    monthMap[monthKey].total++;
    monthMap[monthKey][getMemberTag(member)]++;
    monthMap[monthKey].rev += member.gia || 0;
  });

  const months = Object.values(monthMap).sort((a, b) => a.key - b.key);
  const totals = months.reduce((acc, m) => ({
    total:   acc.total   + m.total,
    active:  acc.active  + m.active,
    warning: acc.warning + m.warning,
    expired: acc.expired + m.expired,
    paused:  acc.paused  + m.paused,
    rev:     acc.rev     + m.rev,
  }), { total: 0, active: 0, warning: 0, expired: 0, paused: 0, rev: 0 });

  // Cache các danh sách cảnh báo cho modal
  appState.warningMembers = appState.members.filter(m => getMemberTag(m) === STATUS.WARNING).sort((a, b) => a.con_lai - b.con_lai);
  appState.expiredMembers = appState.members.filter(m => getMemberTag(m) === STATUS.EXPIRED).sort((a, b) => a.con_lai - b.con_lai);

  const revenueMonths = Object.values(monthMap).filter(m => m.rev > 0).sort((a, b) => b.key - a.key);
  const maxRevenue    = revenueMonths.length ? Math.max(...revenueMonths.map(m => m.rev)) : 1;

  let html = '';

  // ── Summary Pills ──
  html += `
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">📋 Tổng Hợp Học Viên Gym</div>
        <div style="font-size:11px;color:var(--t2)">Cập nhật: ${timestampStr}</div>
      </div>
      <div class="summary-pills">
        ${buildSummaryPill(appState.members.length, 'Tổng học viên',   'Tất cả trạng thái', 'rgba(108,71,255,.07)', 'rgba(108,71,255,.2)', 'var(--purple)')}
        ${buildSummaryPill(totals.active,  'Đang hoạt động', `> ${WARNING_DAYS} ngày còn lại`, 'var(--green-soft)',  'rgba(14,168,104,.2)',  'var(--green)')}
        ${buildSummaryPill(totals.warning, 'Sắp hết hạn',    `≤ ${WARNING_DAYS} ngày còn lại`, 'var(--orange-soft)', 'rgba(245,158,11,.2)', 'var(--orange)')}
        ${buildSummaryPill(totals.expired, 'Đã hết hạn',     'Cần gọi gia hạn',               'var(--red-soft)',    'rgba(239,68,68,.2)',   'var(--red)')}
        ${buildSummaryPill(totals.paused,  'Tạm dừng',       'Đang nghỉ tập',                  'var(--gray-soft)',   'rgba(100,116,139,.2)', 'var(--gray)')}
      </div>
    </div>`;

  // ── Alert Cards ──
  html += `<div class="alert-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
  html += buildAlertCard('warn', appState.warningMembers, '⚠️', `Sắp hết hạn (≤${WARNING_DAYS} ngày)`,
    'var(--orange)', 'rgba(245,158,11,.3)', 'var(--orange-soft)');
  html += buildAlertCard('exp',  appState.expiredMembers, '🔴', 'Đã hết hạn — Cần gọi gia hạn',
    'var(--red)',    'rgba(239,68,68,.3)',   'var(--red-soft)');
  html += `</div>`;

  // ── Monthly Table ──
  html += `
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">📊 Thống Kê Theo Tháng</div>
        <span class="section-card-badge">${months.length} tháng</span>
      </div>
      <div style="overflow-x:auto">
        <table class="stats-table">
          <thead><tr>
            <th>Tháng</th><th>Tổng</th><th>Hoạt Động</th>
            <th>Sắp HH</th><th>Hết Hạn</th><th>Tạm Dừng</th><th>Doanh Thu</th>
          </tr></thead>
          <tbody>
            ${!months.length
              ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t2)">Chưa có dữ liệu</td></tr>'
              : months.map(m => `
                  <tr>
                    <td style="font-weight:600;color:var(--t0)">${m.mk}</td>
                    <td class="text-total">${m.total}</td>
                    <td class="text-active">${m.active  || '–'}</td>
                    <td class="text-warning">${m.warning || '–'}</td>
                    <td class="text-expired">${m.expired || '–'}</td>
                    <td class="text-paused">${m.paused  || '–'}</td>
                    <td style="color:var(--purple);font-weight:500">${m.rev ? m.rev.toLocaleString('vi-VN') + 'đ' : '–'}</td>
                  </tr>`).join('')
            }
            ${months.length ? `
              <tr class="totals-row">
                <td>TỔNG CỘNG</td>
                <td class="text-total">${totals.total}</td>
                <td class="text-active">${totals.active}</td>
                <td class="text-warning">${totals.warning}</td>
                <td class="text-expired">${totals.expired}</td>
                <td class="text-paused">${totals.paused}</td>
                <td style="color:var(--purple)">${totals.rev ? totals.rev.toLocaleString('vi-VN') + 'đ' : '–'}</td>
              </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>`;

  // ── Revenue Chart ──
  html += `
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">📉 Doanh Thu Theo Tháng</div>
        <span class="section-card-badge">${revenueMonths.length} tháng</span>
      </div>
      <div style="padding:14px 18px">
        ${!revenueMonths.length
          ? '<div style="color:var(--t2);font-size:12px;text-align:center;padding:14px">Chưa có dữ liệu. Nhập Giá Thu khi thêm học viên.</div>'
          : revenueMonths.map(m => {
              const pct   = Math.round(m.rev / maxRevenue * 100);
              const label = formatCurrencyShort(m.rev);
              return `
                <div class="revenue-row">
                  <div class="revenue-label">${m.mk}</div>
                  <div class="revenue-track">
                    <div class="revenue-bar" data-w="${pct}">${label}</div>
                  </div>
                  <div class="revenue-value">${m.rev.toLocaleString('vi-VN')}đ</div>
                </div>`;
            }).join('')
        }
      </div>
    </div>`;

  container.innerHTML = html;

  // Animate revenue bars
  setTimeout(() => {
    document.querySelectorAll('.revenue-bar[data-w]').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 80);
}

function buildSummaryPill(number, label, subLabel, bgColor, borderColor, textColor) {
  return `
    <div class="summary-pill" style="background:${bgColor};border-color:${borderColor};color:${textColor}">
      <div class="pill-number">${number}</div>
      <div class="pill-label">${label}</div>
      <div class="pill-sub">${subLabel}</div>
    </div>`;
}

function buildAlertCard(type, list, icon, title, color, borderColor, bgColor) {
  const hasItems      = list.length > 0;
  const clickAttrs    = hasItems
    ? `onclick="openAlertModal('${type}')" style="cursor:pointer"`
    : 'style="cursor:default"';
  const cardBorder    = hasItems ? borderColor : 'var(--border)';
  const barColor      = hasItems ? color : 'var(--border2)';
  const numberColor   = hasItems ? color : 'var(--t3)';

  let previewNames = '';
  if (hasItems) {
    previewNames = `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px">`;
    list.slice(0, 3).forEach(m => {
      previewNames += `<span style="background:${bgColor};border:1px solid ${borderColor};border-radius:99px;padding:3px 10px;font-size:11px;color:${color};font-weight:600;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block">${escapeHtml(m.ten)}</span>`;
    });
    if (list.length > 3) previewNames += `<span style="background:var(--bg-input);border:1px solid var(--border2);border-radius:99px;padding:3px 10px;font-size:11px;color:var(--t2);font-weight:600">+${list.length - 3}</span>`;
    previewNames += `</div>`;
  }

  return `
    <div ${clickAttrs} class="alert-card section-card" style="border:1.5px solid ${cardBorder}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${barColor};border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
      <div style="padding:16px 18px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:26px">${icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-heading);font-size:28px;font-weight:800;color:${numberColor};line-height:1">${list.length}</div>
            <div style="font-size:12px;color:var(--t1);margin-top:3px;font-weight:500">${title}</div>
          </div>
          ${hasItems ? `<div style="width:32px;height:32px;border-radius:50%;background:${bgColor};border:1.5px solid ${borderColor};display:flex;align-items:center;justify-content:center;font-size:14px;color:${color};flex-shrink:0">›</div>` : ''}
        </div>
        ${previewNames}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════
// TRANG BIẾN ĐỘNG
// ══════════════════════════════════════════════

export function renderBiendogPage() {
  const container = document.getElementById('bdp');
  if (!container) return;

  const { biendongThisYear: thisYear, biendongThisMonth: thisMonth, biendongPrevYear: prevYear, biendongPrevMonth: prevMonth } = appState;

  const thisStart = new Date(thisYear, thisMonth, 1);
  const thisEnd   = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
  const prevStart = new Date(prevYear, prevMonth, 1);
  const prevEnd   = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);

  const labelThis = formatMonthKeyFromParts(thisYear, thisMonth);
  const labelPrev = formatMonthKeyFromParts(prevYear, prevMonth);

  const now        = new Date();
  const isThisNow  = thisYear === now.getFullYear() && thisMonth === now.getMonth();
  const isPrevNow  = prevYear === now.getFullYear() && prevMonth === now.getMonth();

  function inRange(date, start, end) {
    return date instanceof Date && !isNaN(date) && date >= start && date <= end;
  }

  const newThis    = appState.members.filter(m => inRange(m.ngay_bd, thisStart, thisEnd));
  const newPrev    = appState.members.filter(m => inRange(m.ngay_bd, prevStart, prevEnd));
  const stopThis   = appState.members.filter(m =>
    (m.tt === STATUS.EXPIRED || m.tt === STATUS.PAUSED) && inRange(m.ngay_hh, thisStart, thisEnd)
  );
  const stopPrev   = appState.members.filter(m =>
    (m.tt === STATUS.EXPIRED || m.tt === STATUS.PAUSED) && inRange(m.ngay_hh, prevStart, prevEnd)
  );
  const activeNow  = appState.members.filter(m => m.tt === STATUS.ACTIVE || m.tt === STATUS.WARNING);
  const activePrev = appState.members.filter(m =>
    m.ngay_bd instanceof Date && m.ngay_bd <= prevEnd &&
    (!(m.ngay_hh instanceof Date) || m.ngay_hh >= prevStart)
  );

  let html = '';

  // ── Header với month picker ──
  html += `
    <div class="section-card" style="padding:16px 20px;flex-shrink:0">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:var(--font-heading);font-size:15px;font-weight:800;color:var(--t0)">🔄 Biến Động Học Viên</div>
          <div style="font-size:11px;color:var(--t1);margin-top:3px">Nhấn <b style="color:var(--t0)">‹ ›</b> để đổi tháng</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${buildMonthPicker(labelThis, true, isThisNow)}
          <div style="color:var(--t2);font-size:12px;font-weight:700">vs</div>
          ${buildMonthPicker(labelPrev, false, isPrevNow)}
          <button onclick="biendogGoToday()" style="background:var(--purple-soft);border:1.5px solid rgba(108,71,255,.3);color:var(--purple);cursor:pointer;font-size:12px;padding:6px 12px;border-radius:8px;font-weight:600;white-space:nowrap"
            onmouseover="this.style.background='var(--purple-mid)'" onmouseout="this.style.background='var(--purple-soft)'">
            ⏎ Hôm nay
          </button>
        </div>
      </div>
    </div>`;

  // ── KPI Cards ──
  html += `<div class="kpi-row" style="display:flex;gap:10px;flex-shrink:0">
    ${buildKpiCard('Học viên mới',      newThis.length,  newPrev.length,  'var(--green)')}
    ${buildKpiCard('Dừng hoạt động',    stopThis.length, stopPrev.length, 'var(--red)')}
    ${buildKpiCard('Đang hoạt động',    activeNow.length, activePrev.length, 'var(--purple)')}
  </div>`;

  // ── Member Lists ──
  html += `<div class="bd-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    ${buildMemberListBox('🆕 Mới — ' + labelThis, '🆕', newThis, 'Tháng này chưa có học viên mới',   'var(--green)', 'linear-gradient(90deg,var(--green),#00d4b0)')}
    ${buildMemberListBox('🚪 Dừng — ' + labelThis, '🚪', stopThis, 'Tháng này chưa có ai dừng', 'var(--red)',   'linear-gradient(90deg,var(--red),var(--orange))')}
  </div>`;

  container.innerHTML = html;
}

function buildKpiCard(label, thisValue, prevValue, kpiColor) {
  const diff  = thisValue - prevValue;
  const sign  = diff > 0 ? '+' : '';
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
  const diffColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--t2)';

  return `
    <div class="kpi-card" style="--kpi-color:${kpiColor}">
      <div style="font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;padding-left:8px">${label}</div>
      <div style="display:flex;align-items:flex-end;gap:10px;margin-top:6px;padding-left:8px">
        <div style="font-family:var(--font-heading);font-size:28px;font-weight:800;color:${kpiColor};line-height:1">${thisValue}</div>
        <div style="font-size:11px;padding-bottom:3px">
          <div style="color:var(--t2)">Tháng so sánh: ${prevValue}</div>
          <div style="color:${diffColor};font-weight:700">${arrow} ${sign}${diff}</div>
        </div>
      </div>
    </div>`;
}

function buildMemberListBox(title, icon, list, emptyMessage, color, gradient) {
  const memberRows = list.map(member => {
    const tag   = getMemberTag(member);
    const tColors = { active: 'var(--green)', warning: 'var(--orange)', expired: 'var(--red)', paused: 'var(--gray)' };
    const tLabels = { active: 'Hoạt động', warning: 'Sắp HH', expired: 'Hết hạn', paused: 'Tạm dừng' };
    const tagColor = tColors[tag];

    return `
      <div class="member-row">
        <div class="member-row-avatar">${escapeHtml(member.ten?.charAt(0)?.toUpperCase() || '?')}</div>
        <div style="flex:1;min-width:0">
          <div class="member-row-name" onclick="jumpToDashboard(${member.id})">${escapeHtml(member.ten)} ↗</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">${escapeHtml(member.sdt || '—')} · 📅 ${formatDate(member.ngay_bd)}</div>
        </div>
        <span style="border-radius:99px;padding:3px 10px;font-size:11px;font-weight:600;
          color:${tagColor};background:${tagColor.replace(')', ',0.1)').replace('var(--', 'rgba(')};
          border:1px solid ${tagColor.replace(')', ',0.25)').replace('var(--', 'rgba(')}">
          ${tLabels[tag]}
        </span>
      </div>`;
  }).join('');

  return `
    <div class="section-card">
      <div class="section-card-header" style="position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${gradient}"></div>
        <span style="font-size:16px">${icon}</span>
        <span class="section-card-title">${title}</span>
        <span class="section-card-badge" style="color:${color}">${list.length} người</span>
      </div>
      ${list.length ? memberRows : `<div style="padding:28px;text-align:center;color:var(--t2);font-size:12px">${emptyMessage}</div>`}
    </div>`;
}

function buildMonthPicker(label, isMain, isNow) {
  const color   = isMain ? 'var(--purple)' : 'var(--t1)';
  const bg      = isMain ? 'var(--purple-soft)' : 'var(--bg-input)';
  const border  = isMain ? 'rgba(108,71,255,.35)' : 'var(--border)';
  const prevFn  = isMain ? 'biendogChangeThis(-1)' : 'biendogChangePrev(-1)';
  const nextFn  = isMain ? 'biendogChangeThis(1)'  : 'biendogChangePrev(1)';
  const rowLabel = isMain ? 'THÁNG XEM' : 'SO SÁNH';

  return `
    <div style="background:${bg};border:1.5px solid ${border};border-radius:10px;padding:5px 4px;display:flex;align-items:center;gap:3px;user-select:none">
      <button onclick="${prevFn}" style="background:none;border:none;color:${color};cursor:pointer;font-size:16px;padding:0 5px;line-height:1;opacity:.6;transition:opacity .15s"
        onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">‹</button>
      <div style="text-align:center;min-width:78px">
        <div style="font-family:var(--font-heading);font-size:16px;font-weight:800;color:${color};line-height:1">${label}</div>
        <div style="font-size:8px;color:var(--t2);letter-spacing:1px;margin-top:2px;font-weight:600">${rowLabel}${isNow ? ' · NOW' : ''}</div>
      </div>
      <button onclick="${nextFn}" style="background:none;border:none;color:${color};cursor:pointer;font-size:16px;padding:0 5px;line-height:1;opacity:.6;transition:opacity .15s"
        onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">›</button>
    </div>`;
}

// ── Biến động navigation ──
function recalcPrevMonth() {
  appState.biendongPrevMonth = appState.biendongThisMonth === 0 ? 11 : appState.biendongThisMonth - 1;
  appState.biendongPrevYear  = appState.biendongThisMonth === 0 ? appState.biendongThisYear - 1 : appState.biendongThisYear;
}

export function biendogGoToday() {
  const now = new Date();
  appState.biendongThisYear  = now.getFullYear();
  appState.biendongThisMonth = now.getMonth();
  recalcPrevMonth();
  renderBiendogPage();
}

export function biendogChangeThis(delta) {
  appState.biendongThisMonth += delta;
  if (appState.biendongThisMonth > 11) { appState.biendongThisMonth = 0;  appState.biendongThisYear++; }
  if (appState.biendongThisMonth < 0)  { appState.biendongThisMonth = 11; appState.biendongThisYear--; }
  recalcPrevMonth();
  renderBiendogPage();
}

export function biendogChangePrev(delta) {
  appState.biendongPrevMonth += delta;
  if (appState.biendongPrevMonth > 11) { appState.biendongPrevMonth = 0;  appState.biendongPrevYear++; }
  if (appState.biendongPrevMonth < 0)  { appState.biendongPrevMonth = 11; appState.biendongPrevYear--; }
  renderBiendogPage();
}

// Init prev month
recalcPrevMonth();
