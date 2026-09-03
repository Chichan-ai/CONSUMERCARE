'use strict';

// =============================================
// SUPABASE CONFIG - FIXED
// =============================================
const SUPABASE_URL      = 'https://mvghegfopkdnrcdkpdws.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z2hlZ2ZvcGtkbnJjZGtwZHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NDY2NDIsImV4cCI6MjA5MjMyMjY0Mn0.ktte6GZT6YCcP1cPOI7xU8vzoQ-Zw_Ju9tfwUEk1Ofw';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// GLOBAL STATE
// =============================================
let cachedTickets        = [];

let cachedUsers          = [];

let currentDashboardData = [];

let myChart              = null;

let branchChart          = null;

let engagementChart      = null;

let trendChart           = null;

let tatDistChart         = null;

let severityChart        = null;

let channelChart         = null;

// Chart patch helper — updates data without destroy/recreate (no flicker)
function patchChart(chartInstance, newLabels, newData, datasetIndex) {
    if (!chartInstance) return false;
    chartInstance.data.labels = newLabels;
    chartInstance.data.datasets[datasetIndex || 0].data = newData;
    chartInstance.update('active');
    return true;
}

// =============================================
// INITIALIZATION — wait for DOM
// =============================================
document.addEventListener('modulesReady', () => {
    // Apply login-page class to body so background styles apply correctly
    document.body.classList.add('on-login-page');

    // FIX: password toggle attached here, after DOM is ready
    const toggleBtn     = document.getElementById('toggleBtn');
    const passwordInput = document.getElementById('password');
    const eyeIcon       = document.getElementById('eyeIcon');

    if (toggleBtn && passwordInput && eyeIcon) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            eyeIcon.textContent = isPassword ? 'hide' : 'show';
        });
    }

    // Enter key on login
    document.addEventListener('keypress', (e) => {
        const loginSection = document.getElementById('login-section');
        if (e.key === 'Enter' && loginSection && !loginSection.classList.contains('hidden')) {
            handleLogin();
        }
    });

    // Apply saved theme — light by default (dark only when the user opts in)
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light');

    // Night shift subtle filter
    const h = new Date().getHours();
    if (h < 5 || h >= 23) document.body.classList.add('night-shift');

    // REFRESH vs NEW OPEN logic:
    // - sessionStorage keeps 'isLoggedIn' alive during refresh but clears on new tab/window
    // - localStorage keeps the username, role, theme across sessions
    const sessionActive = sessionStorage.getItem('isLoggedIn') === 'true';
    const lsLoggedIn    = localStorage.getItem('isLoggedIn') === 'true';

    if (sessionActive && lsLoggedIn) {
        // REFRESH — user is already logged in, restore their last page
        showDashboard();
        checkAdminAccess();   // must run before initializeAppData → showPage
        initializeAppData();
    } else {
        // NEW OPEN — always require login
        localStorage.removeItem('isLoggedIn');
        sessionStorage.clear();
        document.getElementById('login-section').classList.remove('hidden');
    }
});

// Reset session timer on click
// Refresh session timestamp on any user activity
['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(evt => {

    document.addEventListener(evt, () => {

        if (localStorage.getItem('isLoggedIn') === 'true') {

            localStorage.setItem('loginTimestamp', Date.now());

        }

    }, { passive: true });

});

function initializeAppData() {
    setTimeout(() => {
        writeAuditLog('SESSION_START', `User ${localStorage.getItem('username')||'UNKNOWN'} session started (role: ${localStorage.getItem('userRole')||'UNKNOWN'})`);
    }, 500);

    const u  = localStorage.getItem('username') || '—';
    const el = document.getElementById('sidebar-user');
    if (el) el.textContent = u;

    // On fresh login: go to dashboard. On refresh: restore the last active page.
    const restoredPage = sessionStorage.getItem('activePage') || 'dashboard';
    localStorage.setItem('activePage', restoredPage);
    showPage(restoredPage);

    loadData();
    if ((localStorage.getItem('userRole') || '').toUpperCase() === 'ADMIN') {
        loadKioskData();
        loadPendingStatusApprovals();
        setInterval(loadPendingStatusApprovals, 30000);
    }

    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) ticketForm.onsubmit = handleFormSubmit;

    setInterval(checkSession, 30000);

    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');

    logAudit('SESSION_START', `User ${localStorage.getItem('username')||'UNKNOWN'} logged in`, 'login');
    updateAuditCount();

    setInterval(() => {
        if (cachedTickets.length > 0) updateExtendedKPIs(cachedTickets);
    }, 300000);
}

// =============================================
// SESSION & AUTH
// =============================================
function checkAdminAccess() {
    const storedRole = (localStorage.getItem('userRole') || '').toUpperCase();
    const isAdmin    = storedRole === 'ADMIN';

    // Show/hide admin-only nav items based purely on stored role
    ['nav-kiosk', 'nav-admin', 'nav-audit', 'nav-analytics'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !isAdmin);
    });

    // Guard: redirect encoder away from admin-only pages
    const currentPage = localStorage.getItem('activePage') || 'dashboard';
    if (!isAdmin && ['kiosk', 'admin', 'audit', 'analytics'].includes(currentPage)) {
        localStorage.setItem('activePage', 'dashboard');
    }
    return isAdmin;
}

// FIX: Session timeout set to 5 minutes
function checkSession() {
    const loginTime  = localStorage.getItem('loginTimestamp');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (isLoggedIn === 'true' && loginTime) {
        // 5 * 60 * 1000 = 5 minutes
        if (Date.now() - parseInt(loginTime) > 5 * 60 * 1000) {
            // Displaying a clearer message
            showToast('SESSION EXPIRED: Your session has timed out due to inactivity.', true);
            writeAuditLog('SESSION_TIMEOUT', `Session expired for user ${localStorage.getItem('username')||'UNKNOWN'} due to inactivity`);
            setTimeout(forceLogout, 1200);
        }
    }
}

function forceLogout() {
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        writeAuditLog('SESSION_END', `User ${localStorage.getItem('username')||'UNKNOWN'} manually logged out`);
        localStorage.clear();
        sessionStorage.clear();  // full clear so next open always shows login
        location.reload();
    }
}

function showDashboard() {
    document.body.classList.remove('on-login-page');
    document.getElementById('login-section').classList.add('hidden');
    const main = document.getElementById('main-dashboard');
    main.classList.remove('hidden');
    main.style.display = 'flex';
    restoreSidebarState();
}

// =============================================
// THEME
// =============================================
function applyTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(t);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(t);
    document.documentElement.style.background = '';   // let body handle the canvas

    document.body.classList.add('theme-busy');               // smooth cross-fade
    setTimeout(() => document.body.classList.remove('theme-busy'), 450);

    // Keep mobile browser chrome in sync with the theme
    const metaColor = document.getElementById('meta-theme-color');
    if (metaColor) metaColor.setAttribute('content', t === 'dark' ? '#0c1118' : '#f0f4f8');

    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = t === 'light' ? '☀️' : '🌙';

    if (cachedTickets.length > 0) renderDashboard(cachedTickets);
}

function toggleTheme() {
    const goDark = !document.body.classList.contains('dark');
    localStorage.setItem('theme', goDark ? 'dark' : 'light');
    applyTheme(goDark ? 'dark' : 'light');
}

function showPage(page) {
    const isAdmin = (localStorage.getItem('userRole') || '').toUpperCase() === 'ADMIN';

    // Route kiosk-monitoring into the kiosk page as a tab
    if (page === 'kiosk-monitoring') {
        if (!isAdmin) {
            showPage('dashboard');
            return;
        }
        showPage('kiosk');
        switchKioskTab('monitoring');
        return;
    }

    // Guard: admin-only pages — fall back to dashboard for encoders
    const adminOnlyPages = ['kiosk', 'admin', 'audit', 'analytics'];
    if (adminOnlyPages.includes(page) && !isAdmin) page = 'dashboard';

    localStorage.setItem('activePage', page);
    sessionStorage.setItem('activePage', page);
    ['dashboard','summary','reports','report','kiosk','analytics','audit','admin'].forEach(p => {
        const pageEl = document.getElementById(`page-${p}`);
        const navEl  = document.getElementById(`nav-${p}`);
        if (pageEl) pageEl.classList.toggle('hidden', p !== page);
        if (navEl)  navEl.classList.toggle('active',  p === page);
    });

    if (page === 'report')     updateDateInput();
    if (page === 'reports' && typeof renderReportTable === 'function') renderReportTable([]);
    if (page === 'kiosk') {
        // Restore last active kiosk tab (default: terminals)
        const savedTab = sessionStorage.getItem('kioskTab') || 'terminals';
        switchKioskTab(savedTab);
    }
    if (page === 'admin') {
        renderUserTable();
        loadAdminAuditLog();
        writeAuditLog('ADMIN_PANEL_VIEWED', `Admin panel opened by ${localStorage.getItem('username')||'UNKNOWN'}`);
    }
    if (page === 'analytics')  { renderAnalytics(); writeAuditLog('ANALYTICS_VIEWED', `Analytics page opened by ${localStorage.getItem('username')||'UNKNOWN'}`); }
    if (page === 'audit')      { renderAuditLog(); updateAuditCount(); }
}

// =============================================
// SIDEBAR TOGGLE — click-lock expand/collapse
// =============================================
function toggleSidebarExpand() {
    const sidebar = document.getElementById('sidebar');
    const isExpanded = sidebar.classList.toggle('expanded');
    document.body.classList.toggle('sidebar-expanded', isExpanded);
    localStorage.setItem('sidebarExpanded', isExpanded ? '1' : '0');
}

// Restore sidebar state on load
function restoreSidebarState() {
    if (localStorage.getItem('sidebarExpanded') === '1') {
        document.getElementById('sidebar')?.classList.add('expanded');
        document.body.classList.add('sidebar-expanded');
    }
}

// Legacy stubs — kept for any remaining callers
function toggleSidebar() { toggleSidebarExpand(); }

// Sidebar logo click: desktop = expand/collapse, mobile = open/close drawer
function toggleSidebarFromLogo() {
    if (window.innerWidth <= 767) toggleSidebar();
    else toggleSidebarExpand();
}

function closeSidebar()   { /* no-op — no mobile overlay in new design */ }

// =============================================
// LOAD DATA  — FIX: removed nested loadData(), fixed call order
// =============================================

// Shared ticket mapper — used by loadData() and realtime handler
function mapTicket(t) {
    return {
        TicketNo:      t.ticket_no,
        TicketTagging: t.ticket_tagging,
        DateIssued:    t.date_issued,
        DatePickedUp:  t.date_picked_up,
        DateReplied:   t.date_replied,
        Name:          t.name,
        Branch:        t.branch,
        Type:          t.type,
        Engagement:    t.engagement,
        Concerns:      t.concerns,
        Assistance:    t.assistance,
        Action:        t.action,
        Status:        t.status,
        Channel:       t.channel,
        SeverityLevel: t.severity_level,
        _id:           t.id,
    };
}

async function loadData() {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) loadingEl.classList.remove('hidden');

    try {
        // Get last ticket number
        const { data: lastTicketNo, error: rpcError } = await db.rpc('get_last_ticket_no');
        if (!rpcError) {
            const lastID = lastTicketNo || 0;
            const hint  = document.getElementById('last-ticket-hint');
            const input = document.getElementById('ticketNoInput');
            if (hint)  hint.innerText = lastID;
            if (input) input.value   = lastID + 1;
        }

        // Paginated ticket fetch
        let allTickets = [];
        let from       = 0;
        const batchSize = 1000;
        let hasMore     = true;

        while (hasMore) {
            const { data, error } = await db
                .from('tickets')
                .select('*')
                .order('ticket_no', { ascending: false })
                .range(from, from + batchSize - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allTickets = allTickets.concat(data);
                from += batchSize;
                hasMore = data.length === batchSize;
            } else {
                hasMore = false;
            }
        }

        // Store raw data for export (uses original DB field names)
        currentDashboardData = allTickets;

        // Map to UI-friendly keys using shared mapTicket()
        cachedTickets = allTickets.map(mapTicket);

        // Store high-water-mark for incremental realtime loads
        if (allTickets.length > 0) {
            lastFetchedId = allTickets[0].id || 0;
        }

        // Sort by TicketNo descending (newest first) — keeps JS order in sync with DB order
        cachedTickets.sort((a, b) => Number(b.TicketNo) - Number(a.TicketNo));
        // Keep raw export data in same order
        currentDashboardData.sort((a, b) => Number(b.ticket_no) - Number(a.ticket_no));

        renderDashboard(cachedTickets);
        updateSummary(cachedTickets);
        showToast(`✓ SYNCED ${allTickets.length} TICKETS`);

    } catch (err) {
        console.error('Load Error:', err);
        showToast('⚠ SYNC FAILED', true);
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

// =============================================
// UPDATE TICKET STATUS
// =============================================
async function updateTicketStatus(ticketNo, newStatus) {
    if ((localStorage.getItem('userRole') || '').toUpperCase() !== 'ADMIN') {
        await requestTicketStatusChange(ticketNo, newStatus);
        return;
    }
    showToast('UPDATING...');
    try {
        const { error } = await db
            .from('tickets')
            .update({ status: newStatus })
            .eq('ticket_no', ticketNo);

        if (error) throw error;

        const index = cachedTickets.findIndex(t => t.TicketNo == ticketNo);
        if (index !== -1) {
            cachedTickets[index].Status = newStatus;
            // Also update raw data
            const rawIdx = currentDashboardData.findIndex(t => t.ticket_no == ticketNo);
            if (rawIdx !== -1) currentDashboardData[rawIdx].status = newStatus;
        }

        // Re-sort to keep display order stable after in-place update
        cachedTickets.sort((a, b) => Number(b.TicketNo) - Number(a.TicketNo));
        renderDashboard(cachedTickets);
        updateSummary(cachedTickets);
        showToast(`✓ STATUS → ${newStatus.toUpperCase()}`);
        writeAuditLog('STATUS_CHANGED', `Ticket #${ticketNo} updated to ${newStatus.toUpperCase()} by ${localStorage.getItem('username')||'UNKNOWN'}`);
        // Push notification for resolution
        if (newStatus.toUpperCase() === 'RESOLVED') {
            const t = cachedTickets.find(x => String(x.TicketNo) === String(ticketNo));
            if (t) pushNotif(`✓ Ticket #${ticketNo} (${(t.Name||'').toUpperCase()}) marked RESOLVED`, 'info', ticketNo);
        }

    } catch (err) {
        console.error('Update Error:', err);
        showToast('⚠ UPDATE FAILED', true);
    }
}

async function requestTicketStatusChange(ticketNo, newStatus) {
    const ticket = cachedTickets.find(t => String(t.TicketNo) === String(ticketNo));
    const currentStatus = (ticket?.Status || 'PENDING').toUpperCase();
    if (currentStatus === newStatus.toUpperCase()) return;

    try {
        const { error } = await db.from('status_change_requests').insert([{
            ticket_no: ticketNo,
            previous_status: currentStatus,
            requested_status: newStatus.toUpperCase(),
            requested_by: localStorage.getItem('username') || 'UNKNOWN',
            request_status: 'PENDING'
        }]);
        if (error) throw error;
        showToast('✓ STATUS CHANGE SENT FOR ADMIN APPROVAL');
        writeAuditLog('STATUS_CHANGE_REQUESTED', `Ticket #${ticketNo} status change requested: ${currentStatus} → ${newStatus.toUpperCase()}`);
    } catch (err) {
        console.error('Status request error:', err);
        showToast('⚠ APPROVAL REQUEST FAILED', true);
    }
}

// FIX: handleStatusChange was called in populateTable but never defined
function handleStatusChange(selectEl, ticketNo) {
    const newStatus = selectEl.value;
    // Update dropdown color class
    selectEl.className = 'status-select';
    if (newStatus === 'RESOLVED') selectEl.classList.add('select-resolved');
    else if (newStatus === 'BLOCKED') selectEl.classList.add('select-blocked');
    else selectEl.classList.add('select-pending');

    const isAdmin = (localStorage.getItem('userRole') || '').toUpperCase() === 'ADMIN';
    if (!isAdmin) {
        const ticket = cachedTickets.find(t => String(t.TicketNo) === String(ticketNo));
        const currentStatus = (ticket?.Status || 'PENDING').toUpperCase();
        selectEl.value = currentStatus;
        selectEl.className = 'status-select ' + (currentStatus === 'RESOLVED' ? 'select-resolved' : currentStatus === 'BLOCKED' ? 'select-blocked' : 'select-pending');
    }
    updateTicketStatus(ticketNo, newStatus);
}

async function loadPendingStatusApprovals() {
    if ((localStorage.getItem('userRole') || '').toUpperCase() !== 'ADMIN') return;
    try {
        const { data, error } = await db
            .from('status_change_requests')
            .select('*')
            .eq('request_status', 'PENDING')
            .order('created_at', { ascending: false });
        if (error) throw error;

        (data || []).forEach(request => {
            const notificationId = `status-approval-${request.id}`;
            if (!notifications.some(n => n.approvalId === notificationId)) {
                pushNotif(`Approval needed: ${request.requested_by} wants Ticket #${request.ticket_no} changed to ${request.requested_status}`, 'warning', request.ticket_no, notificationId, request);
            }
        });
    } catch (err) {
        console.error('Approval load error:', err);
    }
}

async function reviewStatusChange(requestId, approved) {
    if ((localStorage.getItem('userRole') || '').toUpperCase() !== 'ADMIN') return;
    const request = notifications.find(n => n.approvalId === `status-approval-${requestId}`)?.approvalRequest;
    if (!request) return;

    try {
        const { data: claimedRequest, error: claimError } = await db
            .from('status_change_requests')
            .update({
                request_status: approved ? 'APPROVED' : 'REJECTED',
                reviewed_by: localStorage.getItem('username') || 'UNKNOWN',
                reviewed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('request_status', 'PENDING')
            .select('id')
            .maybeSingle();
        if (claimError) throw claimError;
        if (!claimedRequest) throw new Error('This approval request was already reviewed');

        if (approved) {
            await updateTicketStatus(request.ticket_no, request.requested_status);
        } else {
            await writeAuditLog('STATUS_CHANGE_REJECTED', `Ticket #${request.ticket_no} status change to ${request.requested_status} rejected for ${request.requested_by}`);
            showToast('✓ STATUS CHANGE REJECTED');
        }
        notifications = notifications.filter(n => n.approvalId !== `status-approval-${requestId}`);
        renderNotifPanel();
        updateNotifBadge();
    } catch (err) {
        console.error('Approval review error:', err);
        showToast('⚠ APPROVAL ACTION FAILED', true);
    }
}

// XSS helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================
// CHARTS
// =============================================
function getChartDefaults() {
    const isLight = document.body.classList.contains('light');
    return {
        gridColor: isLight ? 'rgba(0,0,0,0.06)'    : 'rgba(255,255,255,0.06)',
        tickColor: isLight ? '#64748b'              : '#5a6478',
        isLight
    };
}

function animateValue(el, start, end, duration = 700) {
    if (!el || start === end) { if (el) el.innerText = end; return; }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        el.innerText   = Math.floor(eased * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function showToast(message, isError = false) {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' toast-error' : '');
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast?.remove(), 2500);
}

// =============================================
// v2.0 — EXTENDED GLOBAL STATE
// =============================================
let auditLog         = [];   // In-memory audit log

let notifications    = [];   // In-memory notification queue

let ticketNotes      = {};   // { ticketNo: [{ user, note, ts }] }

let currentTicket    = null; // Ticket currently open in modal

let activeFilter     = 'all';

// =============================================
// AUDIT TRAIL — Append + Render
// =============================================
function logAudit(action, detail, type = 'ticket') {
    const entry = {
        id:        Date.now() + Math.random(),
        action,
        detail,
        type,      // ticket | status | user | export | login | system
        user:      localStorage.getItem('username') || 'SYSTEM',
        ts:        new Date().toISOString(),
        tsDisplay: new Date().toLocaleString('en-PH', { hour12: false }),
    };
    auditLog.unshift(entry);
    if (auditLog.length > 500) auditLog.pop();
    renderAuditLog();
    updateAuditCount();
}

// =============================================
// NOTIFICATIONS — Push + Render
// =============================================
function pushNotif(msg, type = 'info', ticketNo = null, approvalId = null, approvalRequest = null) {
    // type: info | warning | critical
    const n = { id: Date.now() + Math.random(), msg, type, ticketNo, approvalId, approvalRequest, ts: new Date(), read: false };
    notifications.unshift(n);
    if (notifications.length > 50) notifications.pop();
    renderNotifPanel();
    updateNotifBadge();
}

function renderNotifPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const unread = notifications.filter(n => !n.read);
    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding:24px;text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">NO NOTIFICATIONS</div>';
        return;
    }
    const dotColor = { info:'var(--accent)', warning:'var(--orange)', critical:'var(--red)' };
    list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.read ? '' : (n.type === 'critical' ? 'unread-red' : 'unread')}" onclick="readNotif(${n.id})">
            <div class="notif-dot" style="background:${dotColor[n.type]||'var(--accent)'}; ${n.type==='critical'?'animation:pulse-dot 1.5s infinite':''}"></div>
            <div>
                <div class="notif-msg">${escapeHtml(n.msg)}</div>
                <div class="notif-time">${timeAgo(n.ts)}</div>
                ${n.approvalRequest ? `<div style="display:flex;gap:6px;margin-top:8px;">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); reviewStatusChange('${escapeHtml(String(n.approvalRequest.id))}', true)">APPROVE</button>
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); reviewStatusChange('${escapeHtml(String(n.approvalRequest.id))}', false)">REJECT</button>
                </div>` : ''}
            </div>
        </div>`).join('');
}

function readNotif(id) {
    const n = notifications.find(n => n.id === id);
    if (n) { n.read = true; if (n.ticketNo) openTicketModal(n.ticketNo); }
    renderNotifPanel();
    updateNotifBadge();
}

function updateNotifBadge() {
    const count  = notifications.filter(n => !n.read).length;
    const badge  = document.getElementById('notif-badge');
    if (badge) { badge.style.display = count > 0 ? 'flex' : 'none'; badge.textContent = count > 9 ? '9+' : count; }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        // mark all as read when opened
        notifications.forEach(n => n.read = true);
        renderNotifPanel();
        updateNotifBadge();
    }
}

function clearAllNotifs() {
    notifications = [];
    renderNotifPanel();
    updateNotifBadge();
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.remove('open');
}

// Close notif panel + search when clicking outside
document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    const btn   = document.getElementById('notif-btn');
    if (panel && !panel.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        panel.classList.remove('open');
    }
    const sp = document.getElementById('search-results-panel');
    const gs = document.getElementById('global-search');
    if (sp && !sp.contains(e.target) && e.target !== gs) sp.classList.remove('open');
});

// =============================================
// GLOBAL SEARCH
// =============================================
function handleGlobalSearch(val) {
    const panel = document.getElementById('search-results-panel');
    if (!panel) return;
    if (!val || val.length < 2) { panel.classList.remove('open'); return; }
    const q = val.toLowerCase();
    const results = cachedTickets.filter(t =>
        String(t.TicketNo).toLowerCase().includes(q) ||
        (t.Name || '').toLowerCase().includes(q) ||
        (t.Branch || '').toLowerCase().includes(q) ||
        (t.Type || '').toLowerCase().includes(q) ||
        (t.Concerns || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (results.length === 0) {
        panel.innerHTML = '<div style="padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-align:center;">NO RESULTS</div>';
    } else {
        const sevColor = { CRITICAL:'var(--red)', HIGH:'var(--orange)', MODERATE:'var(--yellow)', LOW:'var(--blue)' };
        panel.innerHTML = results.map(t => `
            <div class="search-result-item" onclick="openTicketModal(${t.TicketNo})">
                <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);min-width:44px;">#${t.TicketNo}</div>
                <div style="flex:1;">
                    <div style="font-size:12px;font-weight:600;">${escapeHtml((t.Name||'---').toUpperCase())}</div>
                    <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">${escapeHtml(t.Branch||'---')} · ${escapeHtml(t.Type||'---')}</div>
                </div>
                <div style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:${sevColor[(t.SeverityLevel||'').toUpperCase()]||'var(--text-dim)'};">${(t.SeverityLevel||'').toUpperCase()}</div>
            </div>`).join('');
    }
    panel.classList.add('open');
}

function openSearchPanel() {
    const gs = document.getElementById('global-search');
    if (gs && gs.value.length >= 2) handleGlobalSearch(gs.value);
}

// =============================================
// TICKET DETAIL MODAL
// =============================================
function openTicketModal(ticketNo) {
    const t = cachedTickets.find(x => String(x.TicketNo) === String(ticketNo));
    if (!t) { showToast('⚠ TICKET NOT FOUND', true); return; }
    currentTicket = t;
    const modal = document.getElementById('ticket-modal');

    // Populate fields
    document.getElementById('modal-ticket-no').textContent  = '#' + (t.TicketNo || '---');
    document.getElementById('modal-name').textContent       = (t.Name || '---').toUpperCase();
    document.getElementById('modal-branch').textContent     = t.Branch || '---';
    document.getElementById('modal-channel').textContent    = t.Channel || '---';
    document.getElementById('modal-type').textContent       = t.Type || '---';
    document.getElementById('modal-engagement').textContent = t.Engagement || '---';
    document.getElementById('modal-action').textContent     = t.Action || '---';
    document.getElementById('modal-concern').textContent    = t.Concerns || '---';
    document.getElementById('modal-assistance').textContent = t.Assistance || '---';
    document.getElementById('modal-date-issued').textContent = t.DateIssued ? new Date(t.DateIssued).toLocaleString('en-PH',{hour12:false}) : '---';
    document.getElementById('modal-pickup').textContent     = t.DatePickedUp ? new Date(t.DatePickedUp).toLocaleString('en-PH',{hour12:false}) : '---';
    document.getElementById('modal-replied').textContent    = t.DateReplied ? new Date(t.DateReplied).toLocaleString('en-PH',{hour12:false}) : '---';

    // Severity badge
    const sevEl = document.getElementById('modal-severity');
    if (sevEl) {
        const sevColor = { CRITICAL:'var(--red)', HIGH:'var(--orange)', MODERATE:'var(--yellow)', LOW:'var(--blue)' };
        sevEl.textContent = (t.SeverityLevel || 'LOW').toUpperCase();
        sevEl.style.color = sevColor[(t.SeverityLevel||'low').toUpperCase()] || 'var(--blue)';
        sevEl.style.fontWeight = '700';
        sevEl.style.fontFamily = 'var(--font-mono)';
    }

    // Status badge
    const sb = document.getElementById('modal-status-badge');
    if (sb) {
        const s = (t.Status || 'PENDING').toUpperCase();
        sb.textContent = s;
        sb.className = 'badge ' + (s === 'RESOLVED' ? 'badge-resolved' : s === 'BLOCKED' ? 'badge-blocked' : 'badge-pending');
    }

    // TAT calculation
    const tatEl    = document.getElementById('modal-tat');
    const slaBar   = document.getElementById('modal-sla-bar');
    if (t.DateIssued && t.DateReplied) {
        const mins = (new Date(t.DateReplied) - new Date(t.DateIssued)) / 60000;
        const hrs  = mins / 60;
        if (tatEl) tatEl.textContent = hrs >= 1 ? hrs.toFixed(1) + 'h' : Math.round(mins) + 'm';
        // SLA target: CRITICAL=2h, HIGH=4h, MODERATE=8h, LOW=24h
        const slaTarget = { CRITICAL:120, HIGH:240, MODERATE:480, LOW:1440 };
        const target = slaTarget[(t.SeverityLevel||'LOW').toUpperCase()] || 480;
        const pct = Math.min((mins / target) * 100, 100);
        if (slaBar) { slaBar.style.width = pct + '%'; slaBar.style.background = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--accent)'; }
    } else {
        if (tatEl) tatEl.textContent = 'OPEN';
        if (slaBar) slaBar.style.width = '0%';
    }

    // Interaction notes
    renderModalNotes(ticketNo);
    renderTicketAttachments(ticketNo);
    if (modal) modal.classList.add('open');
    writeAuditLog('TICKET_VIEWED', `Ticket #${ticketNo} (${(t.Name||'---').toUpperCase()}) opened by ${localStorage.getItem('username')||'UNKNOWN'}`);
}

async function renderTicketAttachments(ticketNo) {
    const container = document.getElementById('modal-attachments');
    if (!container) return;
    const requestedTicketNo = String(ticketNo);
    container.innerHTML = '<div class="attachment-empty">LOADING FILES...</div>';

    const { data, error } = await db
        .from('ticket_attachments')
        .select('storage_path, original_name, content_type, file_size')
        .eq('ticket_no', ticketNo)
        .order('uploaded_at', { ascending: false });

    if (error) {
        if (!currentTicket || String(currentTicket.TicketNo) !== requestedTicketNo) return;
        console.error('Attachment List Error:', error.message);
        container.innerHTML = '<div class="attachment-empty">FILES UNAVAILABLE</div>';
        return;
    }
    if (!currentTicket || String(currentTicket.TicketNo) !== requestedTicketNo) return;
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="attachment-empty">NO FILES SUBMITTED</div>';
        return;
    }

    const links = await Promise.all(data.map(async file => {
        const { data: viewUrl, error: viewError } = await db.storage
            .from('ticket-attachments')
            .createSignedUrl(file.storage_path, 3600);
        const { data: downloadUrl, error: downloadError } = await db.storage
            .from('ticket-attachments')
            .createSignedUrl(file.storage_path, 3600, { download: file.original_name });
        return {
            file,
            viewUrl: viewError ? null : viewUrl?.signedUrl,
            downloadUrl: downloadError ? null : downloadUrl?.signedUrl,
        };
    }));
    if (!currentTicket || String(currentTicket.TicketNo) !== requestedTicketNo) return;

    container.innerHTML = links.map(({ file, viewUrl, downloadUrl }) => {
        const name = escapeHtml(file.original_name || 'Unnamed file');
        const size = formatFileSize(file.file_size);
        if (!viewUrl || !downloadUrl) return `<div class="attachment-item"><span>${name}</span><span class="attachment-unavailable">UNAVAILABLE</span></div>`;
        return `<div class="attachment-item">
            <span class="attachment-name" title="${name}">${name}<small>${size}</small></span>
            <span class="attachment-actions"><a href="${viewUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">VIEW</a><a href="${downloadUrl}" class="btn btn-primary btn-sm" download>DOWNLOAD</a></span>
        </div>`;
    }).join('');
}

function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) modal.classList.remove('open');
    const ni = document.getElementById('note-input');
    if (ni) ni.value = '';
    currentTicket = null;
}

function modalChangeStatus(newStatus) {
    if (!currentTicket) return;
    handleStatusChange({ value: newStatus, className: 'status-select', classList: { add:()=>{}, remove:()=>{} } }, currentTicket.TicketNo);
    // Update modal badge immediately
    const sb = document.getElementById('modal-status-badge');
    if (sb) { sb.textContent = newStatus; sb.className = 'badge ' + (newStatus === 'RESOLVED' ? 'badge-resolved' : newStatus === 'BLOCKED' ? 'badge-blocked' : 'badge-pending'); }
    writeAuditLog('STATUS_CHANGED', `Ticket #${currentTicket.TicketNo} status changed to ${newStatus} via modal by ${localStorage.getItem('username')||'UNKNOWN'}`);
    closeTicketModal();
}

function copyTicketInfo() {
    if (!currentTicket) return;
    const t = currentTicket;
    const text = `TICKET #${t.TicketNo}
Client: ${t.Name||'---'}
Branch: ${t.Branch||'---'}
Type: ${t.Type||'---'}
Status: ${t.Status||'---'}
Severity: ${t.SeverityLevel||'---'}
Concern: ${t.Concerns||'---'}
Assistance Provided: ${t.Assistance||'---'}`;
    navigator.clipboard?.writeText(text).then(() => showToast('✓ COPIED TO CLIPBOARD')).catch(() => showToast('⚠ COPY FAILED', true));
}

// ── Interaction Notes ──
function renderModalNotes(ticketNo) {
    const container = document.getElementById('modal-interaction-log');
    const countEl   = document.getElementById('modal-log-count');
    const notes     = ticketNotes[ticketNo] || [];
    if (countEl) countEl.textContent = `${notes.length} NOTE${notes.length !== 1 ? 'S' : ''}`;
    if (!container) return;
    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">NO NOTES YET</div>';
        return;
    }
    container.innerHTML = notes.map(n => `
        <div class="interaction-entry">
            <div class="interaction-meta">
                <span style="color:var(--accent);">${escapeHtml(n.user)}</span>
                <span>·</span>
                <span>${n.tsDisplay}</span>
            </div>
            <div>${escapeHtml(n.note)}</div>
        </div>`).join('');
    container.scrollTop = container.scrollHeight;
}

function addTicketNote() {
    if (!currentTicket) return;
    const inp  = document.getElementById('note-input');
    const note = (inp?.value || '').trim();
    if (!note) { showToast('⚠ NOTE CANNOT BE EMPTY', true); return; }
    const ticketNo = currentTicket.TicketNo;
    if (!ticketNotes[ticketNo]) ticketNotes[ticketNo] = [];
    const entry = {
        user:      localStorage.getItem('username') || 'UNKNOWN',
        note,
        ts:        new Date().toISOString(),
        tsDisplay: new Date().toLocaleString('en-PH', { hour12: false }),
    };
    ticketNotes[ticketNo].push(entry);
    if (inp) inp.value = '';
    renderModalNotes(ticketNo);
    showToast('✓ NOTE ADDED');
    writeAuditLog('NOTE_ADDED', `Note added to Ticket #${ticketNo} by ${localStorage.getItem('username')||'UNKNOWN'}: "${note.slice(0,80)}"`);
}

// =============================================
// UTILITY: timeAgo
// =============================================
function timeAgo(date) {
    const s = Math.floor((new Date() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
}

// ========================
// KIOSK MONITORING MODULE
// ========================

// ── State (single declaration only) ──
let kmAllRecords = [];

let kmFiltered = [];

let kmCurrentPage = 1;

let kmPerPage = 25;

let kmDeletePending = null;

const HIGH_COST_THRESHOLD = 5000;

// ── Format currency in PHP Peso ──
const phpFormat = v => {
    const num = parseFloat(v || 0);
    return '₱' + num.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Audit log helper — writes to Supabase audit_logs
// Columns: id (uuid, auto), created_at (timestamptz, auto), actor (text), action (text), details (text)
async function writeAuditLog(action, details) {
    // Derive in-memory type tag for the local audit page
    const type = (action.includes('LOGIN') || action.includes('SESSION')) ? 'login'
               : action.includes('EXPORT')  ? 'export'
               : action.includes('STATUS')  ? 'status'
               : action.includes('USER_')   ? 'user'
               : action.includes('KIOSK')   ? 'kiosk'
               : 'ticket';

    // Mirror to in-memory log (always succeeds, shown on Audit Trail page)
    if (typeof logAudit === 'function') {
        logAudit(action, details, type);
    }

    // Persist to Supabase — only send the 3 writable columns.
    // DO NOT send id or created_at — Supabase auto-generates both.
    // Sending created_at causes a 400/403 error on tables with a server default.
    try {
        const actor = (localStorage.getItem('username') || 'UNKNOWN').trim();
        const payload = { actor, action, details: String(details || '') };
        const { data, error } = await db.from('audit_logs').insert([payload]).select();
        if (error) {
            console.error('[AuditLog] DB insert failed:', error.message, error.details, error.hint);
        } else {
            console.log('[AuditLog] Saved:', action, '— id:', data?.[0]?.id);
        }
    } catch (e) {
        console.error('[AuditLog] Exception during DB write:', e.message);
    }
}

// USER_LOGIN is written directly in handleLogin() on successful auth

// =============================================
// REALTIME SUBSCRIPTION — Surgical cache patching
// =============================================
let realtimeSub    = null;

let lastFetchedId  = 0;

let renderTimer    = null;

let connectionState = 'connecting';

let degradedTimer  = null;

function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
        renderDashboard(cachedTickets);
        updateSummary(cachedTickets);
    }, 120);
}

function handleTicketChange({ eventType, new: row, old }) {
    if (!row && !old) return;
    const mapped = mapTicket(row || {});

    if (eventType === 'INSERT') {
        cachedTickets.unshift(mapped);
        if (row && row.id) lastFetchedId = Math.max(lastFetchedId, row.id);
        pushNotif('New ticket #' + (row.ticket_no || '?') + ' submitted', 'info');

    } else if (eventType === 'UPDATE') {
        const idx = cachedTickets.findIndex(t => String(t.TicketNo) === String(row.ticket_no));
        if (idx !== -1) cachedTickets[idx] = { ...cachedTickets[idx], ...mapped };
        const rawIdx = currentDashboardData.findIndex(t => t.ticket_no == row.ticket_no);
        if (rawIdx !== -1) currentDashboardData[rawIdx] = { ...currentDashboardData[rawIdx], ...row };

    } else if (eventType === 'DELETE') {
        cachedTickets = cachedTickets.filter(t => String(t.TicketNo) !== String(old.ticket_no));
        currentDashboardData = currentDashboardData.filter(t => t.ticket_no != old.ticket_no);
    }

    scheduleRender();
}

function handleSubStatus(status) {
    if (status === 'SUBSCRIBED') {
        setConnectionStatus('live');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnectionStatus('error');
    }
}

function startRealtimeSync() {
    if (realtimeSub) { try { realtimeSub.unsubscribe(); } catch(e) {} }
    realtimeSub = db
        .channel('tickets-realtime')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'tickets' },
            handleTicketChange)
        .subscribe(handleSubStatus);
}

// =============================================
// CONNECTION STATUS BAR
// =============================================
function setConnectionStatus(state) {
    connectionState = state;
    if (state === 'live') {
        clearTimeout(degradedTimer);
        const bar = document.getElementById('conn-status-bar');
        if (bar) bar.style.display = 'none';
    } else if (state === 'error') {
        setStatusBar('degraded', 'RECONNECTING — DATA MAY BE DELAYED');
        degradedTimer = setTimeout(() =>
            setStatusBar('offline', 'OFFLINE — DATA MAY BE STALE'), 30000);
    }
}

function setStatusBar(level, msg) {
    const bar = document.getElementById('conn-status-bar');
    if (!bar) return;
    bar.className = 'conn-bar--' + level;
    bar.style.display = 'flex';
    if (level === 'offline') {
        bar.innerHTML = msg + ' <button onclick="retryConnection()" class="btn btn-ghost btn-sm" style="margin-left:8px;min-height:28px;padding:4px 10px;">RETRY</button>';
    } else {
        bar.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;border-top-color:currentColor;border-color:rgba(255,197,61,0.3);"></div> ' + msg;
    }
}

async function retryConnection() {
    setStatusBar('degraded', 'RECONNECTING...');
    startRealtimeSync();
    if (lastFetchedId) {
        try {
            const { data } = await db.from('tickets')
                .select('*').gt('id', lastFetchedId).order('id', { ascending: true });
            if (data && data.length > 0) {
                data.forEach(r => cachedTickets.unshift(mapTicket(r)));
                lastFetchedId = data[data.length - 1].id;
                scheduleRender();
                showToast('✓ SYNCED ' + data.length + ' NEW RECORDS');
            }
        } catch(e) {
            console.error('[Retry] delta fetch failed:', e);
        }
    }
}

// Browser native connectivity events
window.addEventListener('online',  () => retryConnection());

window.addEventListener('offline', () => setConnectionStatus('error'));

// =============================================
// SESSION — activity reset
// =============================================

// =============================================
// KEYBOARD SHORTCUTS — unified single handler
// =============================================
document.addEventListener('keydown', function(e) {
    // Escape closes any open modal/panel
    if (e.key === 'Escape') {
        closeMonitoringModal();
        closeDeleteConfirm();
        closeTicketModal();
        const um = document.getElementById('add-user-modal');
        if (um) um.classList.remove('open');
        const notif = document.getElementById('notif-panel');
        if (notif) notif.classList.remove('open');
        return;
    }
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key === '/') {
        e.preventDefault();
        document.getElementById('tableSearch')?.focus();
    }
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        refreshDashboardData();
    }
    if (e.key >= '1' && e.key <= '5') {
        const pages = ['dashboard','summary','reports','report','kiosk','analytics','audit','admin'];
        showPage(pages[parseInt(e.key) - 1]);
    }
    if (e.key === '?') {
        alert('KEYBOARD SHORTCUTS\n━━━━━━━━━━━━━━━━━━\n/  →  Focus search\nR  →  Refresh data\n1-7  →  Jump to page\nEsc →  Close modal');
    }
}, true);

// =============================================
// ADMIN — Audit Trail (fetches from Supabase)
// =============================================
let adminAuditData = [];

// =============================================
// ADMIN — addLog stub (legacy compat)
// =============================================
function addLog(msg) { if (typeof writeAuditLog === 'function') writeAuditLog('SYSTEM', msg); }
