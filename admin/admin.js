// Auto-refresh admin table every 30s if visible and user is logged in
setInterval(() => {

    if (localStorage.getItem('isLoggedIn') !== 'true') return;

    const adminPage = document.getElementById('page-admin');

    if (adminPage && !adminPage.classList.contains('hidden')) renderUserTable();

}, 30000);

// =============================================
// ADMIN — USER TABLE (Enhanced)
// =============================================
async function renderUserTable() {
    const tableBody = document.getElementById('user-list-table');
    const countEl   = document.getElementById('user-count');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;"><div class="spinner" style="margin:0 auto 8px;"></div><div class="label">LOADING USERS...</div></td></tr>';

    try {
        const { data: users, error } = await db
            .from('users')
            .select('id, username, branch, status, role, created_at')
            .order('username');
        if (error) throw error;

        cachedUsers = (users || []).filter(u => u.username && u.username.trim() !== '');
        const activeCount = cachedUsers.filter(u => (u.status || '').toUpperCase() === 'ACTIVE').length;
        if (countEl) countEl.innerText = activeCount.toString().padStart(2, '0');
        const totalEl = document.getElementById('user-total-count');
        if (totalEl) totalEl.textContent = cachedUsers.length;

        renderFilteredUsers(cachedUsers);

    } catch (e) {
        console.error('User table error:', e);
        tableBody.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--red);font-family:var(--font-mono);font-size:11px;">LOAD FAILED: ' + escapeHtml(e.message) + ' <button onclick="renderUserTable()" class="btn btn-ghost btn-sm" style="margin-left:8px;">RETRY</button></td></tr>';
    }
}

function filterUserTable() {
    const q      = (document.getElementById('user-search')?.value       || '').toLowerCase();
    const roleF  = (document.getElementById('user-role-filter')?.value   || '').toUpperCase();
    const statF  = (document.getElementById('user-status-filter')?.value || '').toUpperCase();

    const filtered = cachedUsers.filter(u => {
        const uname   = (u.username || '').toLowerCase();
        const ubranch = (u.branch   || '').toLowerCase();
        const uRole   = (u.role     || (u.username?.toUpperCase().includes('ADMIN') ? 'ADMIN' : 'ENCODER')).toUpperCase();
        const uStat   = (u.status   || 'ACTIVE').toUpperCase();
        if (q     && !uname.includes(q) && !ubranch.includes(q)) return false;
        if (roleF && uRole !== roleF) return false;
        if (statF && uStat !== statF) return false;
        return true;
    });
    renderFilteredUsers(filtered);
}

function renderFilteredUsers(userArray) {
    const tableBody = document.getElementById('user-list-table');
    const totalEl   = document.getElementById('user-total-count');
    if (!tableBody) return;
    if (totalEl) totalEl.textContent = userArray.length;

    if (userArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="padding:28px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">NO MATCHING USERS FOUND</td></tr>';
        return;
    }

    const selfUser = (localStorage.getItem('username') || '').toUpperCase();

    tableBody.innerHTML = userArray.map(user => {
        const uname   = (user.username || 'UNKNOWN').trim().toUpperCase();
        const status  = (user.status   || 'ACTIVE').toUpperCase();
        const branch  = (user.branch   || '—').toUpperCase();
        const role    = (user.role     || (uname.includes('ADMIN') || uname === 'CHRISTIAN' ? 'ADMIN' : 'ENCODER')).toUpperCase();
        const isAdmin = role === 'ADMIN';
        const isSelf  = uname === selfUser;
        const joined  = user.created_at
            ? new Date(user.created_at).toLocaleDateString('en-PH', { year:'2-digit', month:'short', day:'numeric' })
            : '—';

        const roleChip  = isAdmin
            ? '<span class="role-chip role-chip-admin">ADMIN</span>'
            : '<span class="role-chip role-chip-encoder">ENCODER</span>';
        const statBadge = status === 'ACTIVE'
            ? '<span class="badge badge-active">ACTIVE</span>'
            : '<span class="badge badge-inactive">' + escapeHtml(status) + '</span>';

        return '<tr ' + (isSelf ? 'style="background:var(--accent-dim);"' : '') + '>' +
            '<td style="font-family:var(--font-mono);font-weight:700;color:' + (isAdmin ? 'var(--purple)' : 'var(--text)') + ';">' +
                escapeHtml(uname) + (isSelf ? ' <span style="font-family:var(--font-mono);font-size:9px;color:var(--accent);">(YOU)</span>' : '') +
            '</td>' +
            '<td>' + roleChip + '</td>' +
            '<td style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono);">' + escapeHtml(branch) + '</td>' +
            '<td>' + statBadge + '</td>' +
            '<td style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">' + joined + '</td>' +
            '<td style="text-align:right;white-space:nowrap;">' +
                '<button onclick="openAddUserModal(\'' + escapeHtml(uname) + '\')" class="btn btn-ghost btn-sm" style="font-size:10px;padding:4px 8px;min-height:28px;">EDIT</button> ' +
                '<button onclick="toggleUserStatus(\'' + escapeHtml(uname) + '\',\'' + status + '\')" ' +
                    'class="btn btn-sm ' + (status === 'ACTIVE' ? 'btn-danger' : 'btn-primary') + '" ' +
                    'style="font-size:10px;padding:4px 8px;min-height:28px;" ' +
                    (isSelf ? 'disabled title="Cannot deactivate yourself"' : '') + '>' +
                    (status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE') +
                '</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

// Legacy alias
function displayUsers(userArray) { renderFilteredUsers(userArray); }

async function toggleUserStatus(username, currentStatus) {
    const selfUser = (localStorage.getItem('username') || '').toUpperCase();
    if (username.toUpperCase() === selfUser) {
        showToast('⚠ CANNOT DEACTIVATE YOUR OWN ACCOUNT', true);
        return;
    }
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await db.from('users').update({ status: newStatus }).eq('username', username);
    if (error) { showToast('✗ UPDATE FAILED: ' + error.message, true); return; }
    showToast('✓ ' + username + ' → ' + newStatus);
    await writeAuditLog('USER_STATUS_CHANGED', username + ' status changed to ' + newStatus);
    renderUserTable();
}

// =============================================
// ADMIN — USER MODAL (Add / Edit)
// =============================================
function openAddUserModal(editUsername = null) {
    const modal     = document.getElementById('add-user-modal');
    const titleEl   = document.getElementById('um-modal-title');
    const submitBtn = document.getElementById('um-submit-btn');
    const pwReqEl   = document.getElementById('um-pw-req');
    const pwHintEl  = document.getElementById('um-pw-hint');
    const errEl     = document.getElementById('um-error');
    if (!modal) return;

    // Reset form
    document.getElementById('um-form').reset();
    document.getElementById('um-edit-username').value = '';
    document.getElementById('um-username').readOnly = false;
    document.getElementById('um-username').style.opacity = '1';
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    resetPwStrength();

    if (editUsername) {
        const user = cachedUsers.find(u => u.username === editUsername);
        if (!user) { showToast('⚠ USER NOT FOUND', true); return; }
        document.getElementById('um-edit-username').value = editUsername;
        document.getElementById('um-username').value      = user.username || '';
        document.getElementById('um-username').readOnly   = true;
        document.getElementById('um-username').style.opacity = '0.65';
        document.getElementById('um-role').value   = (user.role   || 'ENCODER').toUpperCase();
        document.getElementById('um-status').value = (user.status || 'ACTIVE').toUpperCase();
        document.getElementById('um-branch').value = user.branch  || '';
        if (titleEl)    titleEl.textContent  = 'EDIT USER';
        if (submitBtn)  submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> UPDATE USER';
        if (pwReqEl)    pwReqEl.style.display  = 'none';
        if (pwHintEl)   pwHintEl.textContent   = 'Leave blank to keep existing password.';
    } else {
        if (titleEl)    titleEl.textContent  = 'ADD NEW USER';
        if (submitBtn)  submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE USER';
        if (pwReqEl)    pwReqEl.style.display  = 'inline';
        if (pwHintEl)   pwHintEl.textContent   = 'Minimum 6 characters required.';
    }
    modal.classList.add('open');
}

function closeAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) modal.classList.remove('open');
    resetPwStrength();
}

function toggleUmPassword() {
    const inp = document.getElementById('um-password');
    const svg = document.getElementById('um-eye-svg');
    if (!inp) return;
    const isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    if (svg) svg.innerHTML = isPass
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function checkPwStrength(val) {
    const wrap = document.getElementById('um-pw-strength');
    const lbl  = document.getElementById('um-pw-lbl');
    const bars = [1,2,3,4].map(i => document.getElementById('pb' + i));
    if (!wrap) return;
    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;
    const lvl = ['','weak','weak','medium','strong'];
    const txt = ['','WEAK','WEAK','MEDIUM','STRONG'];
    bars.forEach((b, i) => { if (b) b.className = 'pw-bar ' + (i < score ? lvl[score] : ''); });
    if (lbl) { lbl.textContent = txt[score]; lbl.style.color = score <= 1 ? 'var(--red)' : score <= 2 ? 'var(--orange)' : 'var(--accent)'; }
}

function resetPwStrength() {
    const w = document.getElementById('um-pw-strength');
    if (w) w.style.display = 'none';
    [1,2,3,4].forEach(i => { const b = document.getElementById('pb'+i); if (b) b.className = 'pw-bar'; });
}

async function submitUserForm(e) {
    e.preventDefault();
    const btn      = document.getElementById('um-submit-btn');
    const errEl    = document.getElementById('um-error');
    const editOrig = document.getElementById('um-edit-username').value;
    const isEdit   = !!editOrig;

    const username = (document.getElementById('um-username').value  || '').trim().toUpperCase();
    const password = (document.getElementById('um-password').value  || '').trim();
    const role     = document.getElementById('um-role').value;
    const status   = document.getElementById('um-status').value;
    const branch   = (document.getElementById('um-branch').value    || '').trim().toUpperCase();

    // Validation
    const errors = [];
    if (!username || username.length < 3)     errors.push('Username must be ≥ 3 characters');
    if (!/^[A-Z0-9_]+$/.test(username))       errors.push('Username: letters, numbers, underscores only');
    if (!isEdit && (!password || password.length < 6)) errors.push('Password must be ≥ 6 characters');
    if (isEdit && password && password.length < 6)     errors.push('New password must be ≥ 6 characters');
    if (!role)   errors.push('Role is required');
    if (!status) errors.push('Status is required');

    if (errors.length > 0) {
        if (errEl) { errEl.textContent = errors.join(' · '); errEl.style.display = 'block'; }
        return;
    }
    if (errEl) errEl.style.display = 'none';

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:13px;height:13px;border-width:2px;border-top-color:var(--bg);border-color:rgba(0,0,0,0.2);"></div> SAVING...';

    try {
        if (isEdit) {
            const updatePayload = { role, status, branch: branch || null };
            if (password) updatePayload.password = password;
            const { error } = await db.from('users').update(updatePayload).eq('username', editOrig);
            if (error) throw new Error(error.message);
            showToast('✓ USER ' + username + ' UPDATED');
            await writeAuditLog('USER_UPDATED', 'User ' + username + ' updated (role: ' + role + ', status: ' + status + ')');
        } else {
            // Check for duplicate
            const { data: dup } = await db.from('users').select('username').eq('username', username).maybeSingle();
            if (dup) throw new Error('Username "' + username + '" already exists');
            const { error } = await db.from('users').insert([{ username, password, role, status, branch: branch || null }]);
            if (error) throw new Error(error.message);
            showToast('✓ USER ' + username + ' CREATED');
            await writeAuditLog('USER_CREATED', 'New user ' + username + ' created (role: ' + role + ')');
        }
        closeAddUserModal();
        await renderUserTable();
    } catch (err) {
        console.error('User save error:', err);
        if (errEl) { errEl.textContent = '✗ ' + err.message; errEl.style.display = 'block'; }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE USER';
    }
}

function renderAuditLog(filtered) {
    const container = document.getElementById('audit-log-container');
    if (!container) return;
    const entries = filtered || auditLog;
    if (entries.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:32px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">NO AUDIT EVENTS</div>';
        return;
    }
    const iconMap = { ticket:'📋', status:'🔄', user:'👤', export:'📊', login:'🔐', system:'⚙️' };
    const classMap = { ticket:'', status:'orange', user:'blue', export:'', login:'', system:'red' };
    container.innerHTML = entries.map(e => `
        <div class="audit-entry" data-type="${e.type}" id="ae-${e.id}">
            <div class="audit-icon ${classMap[e.type] || ''}">${iconMap[e.type] || '📌'}</div>
            <div class="audit-body">
                <div class="audit-action">${escapeHtml(e.action)}</div>
                <div class="audit-detail">${escapeHtml(e.detail)}</div>
                <div class="audit-timestamp">[${e.tsDisplay}] · USER: ${escapeHtml(e.user)}</div>
            </div>
        </div>`).join('');
}

function filterAuditLog() {
    const typeFilter = document.getElementById('audit-filter-type')?.value || 'all';
    const searchVal  = (document.getElementById('audit-search')?.value || '').toLowerCase();
    let filtered = auditLog;
    if (typeFilter !== 'all') filtered = filtered.filter(e => e.type === typeFilter);
    if (searchVal) filtered = filtered.filter(e =>
        e.action.toLowerCase().includes(searchVal) || e.detail.toLowerCase().includes(searchVal)
    );
    renderAuditLog(filtered);
    updateAuditCount(filtered.length);
}

function updateAuditCount(count) {
    const el = document.getElementById('audit-total-count');
    if (el) el.textContent = (count !== undefined ? count : auditLog.length);
    const sessionEl = document.getElementById('audit-session-user');
    if (sessionEl) sessionEl.textContent = localStorage.getItem('username') || '--';
}

function clearAuditLog() {
    // Clear in-memory only — does not delete DB records
    auditLog = [];
    renderAuditLog();
    updateAuditCount();
}

function exportAuditLog() {
    if (auditLog.length === 0) { showToast('⚠ AUDIT LOG EMPTY', true); return; }
    const wsData = [['Timestamp','Action','Detail','User','Type']];
    auditLog.forEach(e => wsData.push([e.tsDisplay, e.action, e.detail, e.user, e.type]));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch:22 },{ wch:30 },{ wch:50 },{ wch:18 },{ wch:12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, `AUDIT_LOG_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✓ AUDIT LOG EXPORTED');
    writeAuditLog('EXPORT_AUDIT_LOG', `In-memory audit log exported — ${auditLog.length} events by ${localStorage.getItem('username')||'UNKNOWN'}`);
}

// =============================================
// ADMIN — Tab Switcher
// =============================================
function switchAdminTab(tab) {
    const usersPanel = document.getElementById('admin-panel-users');
    const auditPanel = document.getElementById('admin-panel-audit');
    const usersTab   = document.getElementById('admin-tab-users');
    const auditTab   = document.getElementById('admin-tab-audit');
    if (tab === 'users') {
        if (usersPanel) usersPanel.classList.remove('hidden');
        if (auditPanel) auditPanel.classList.add('hidden');
        if (usersTab)   usersTab.classList.add('active');
        if (auditTab)   auditTab.classList.remove('active');
    } else {
        if (usersPanel) usersPanel.classList.add('hidden');
        if (auditPanel) auditPanel.classList.remove('hidden');
        if (usersTab)   usersTab.classList.remove('active');
        if (auditTab)   auditTab.classList.add('active');
        loadAdminAuditLog();
    }
}

async function loadAdminAuditLog() {
    const container = document.getElementById('admin-audit-container');
    const sessionEl = document.getElementById('admin-audit-session-user');
    if (sessionEl) sessionEl.textContent = localStorage.getItem('username') || '--';
    if (!container) return;
    container.innerHTML = '<div style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto 8px;"></div><div class="label">LOADING AUDIT TRAIL...</div></div>';
    try {
        const { data, error } = await db
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        adminAuditData = data || [];
        renderAdminAuditLog(adminAuditData);
        const cntEl = document.getElementById('admin-audit-count');
        if (cntEl) cntEl.textContent = adminAuditData.length;
    } catch (err) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--red);font-family:var(--font-mono);font-size:11px;">LOAD FAILED: ' + escapeHtml(err.message) + '<button onclick="loadAdminAuditLog()" class="btn btn-ghost btn-sm" style="margin-left:8px;">RETRY</button></div>';
    }
}

function renderAdminAuditLog(entries) {
    const container = document.getElementById('admin-audit-container');
    if (!container) return;
    if (!entries || entries.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:32px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">NO AUDIT EVENTS FOUND</div>';
        return;
    }
    const iconMap = {
        'USER_LOGIN':'🔐','SESSION_END':'🔒','SESSION_START':'🔐',
        'CREATE_KIOSK_MONITORING':'➕','UPDATE_KIOSK_MONITORING':'✏️','DELETE_KIOSK_MONITORING':'🗑️',
        'EXPORT_KIOSK_MONITORING':'📊','EXPORT_EXCEL':'📊','EXPORT_AUDIT_LOG':'📄',
        'STATUS_CHANGED':'🔄','TICKET_CREATED':'📋','NOTE_ADDED':'💬',
        'USER_CREATED':'👤','USER_UPDATED':'✏️','USER_STATUS_CHANGED':'🔄',
        'FILTER_APPLIED':'🔍',
    };
    const badgeClass = action => {
        if (action.includes('CREATE') || action.includes('LOGIN')) return 'audit-badge-create';
        if (action.includes('UPDATE')) return 'audit-badge-update';
        if (action.includes('DELETE')) return 'audit-badge-delete';
        if (action.includes('EXPORT')) return 'audit-badge-export';
        if (action.includes('SESSION') || action.includes('AUTH')) return 'audit-badge-login';
        return 'audit-badge-default';
    };
    container.innerHTML = entries.map(e => {
        const ts = e.created_at ? new Date(e.created_at).toLocaleString('en-PH', { hour12:false }) : '---';
        return '<div class="audit-entry">' +
            '<div class="audit-icon">' + (iconMap[e.action] || '📌') + '</div>' +
            '<div class="audit-body">' +
                '<div class="audit-action"><span class="audit-action-badge ' + badgeClass(e.action||'') + '">' + escapeHtml((e.action||'').replace(/_/g,' ')) + '</span></div>' +
                '<div class="audit-detail">' + escapeHtml(e.details||'') + '</div>' +
                '<div class="audit-timestamp">[' + ts + '] · ACTOR: <strong>' + escapeHtml(e.actor||'SYSTEM') + '</strong></div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function filterAdminAuditLog() {
    const search   = (document.getElementById('admin-audit-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('admin-audit-type')?.value || 'all';
    const typeMap  = {
        'login':  ['USER_LOGIN','SESSION'],
        'ticket': ['TICKET','STATUS_CHANGED','NOTE'],
        'kiosk':  ['KIOSK_MONITORING'],
        'user':   ['USER_CREATED','USER_UPDATED','USER_STATUS'],
        'export': ['EXPORT'],
    };
    let filtered = adminAuditData;
    if (typeFilter !== 'all') {
        const prefixes = typeMap[typeFilter] || [];
        filtered = filtered.filter(e => prefixes.some(p => (e.action||'').toUpperCase().includes(p)));
    }
    if (search) {
        filtered = filtered.filter(e =>
            (e.action||'').toLowerCase().includes(search) ||
            (e.details||'').toLowerCase().includes(search) ||
            (e.actor||'').toLowerCase().includes(search)
        );
    }
    renderAdminAuditLog(filtered);
    const cntEl = document.getElementById('admin-audit-count');
    if (cntEl) cntEl.textContent = filtered.length;
}

function exportAdminAuditLog() {
    const data = adminAuditData;
    if (data.length === 0) { showToast('⚠ LOAD AUDIT TRAIL FIRST', true); return; }
    const wsData = [['Timestamp','Actor','Action','Details']];
    data.forEach(e => wsData.push([
        e.created_at ? new Date(e.created_at).toLocaleString('en-PH',{hour12:false}) : '',
        e.actor||'', e.action||'', e.details||''
    ]));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{wch:22},{wch:18},{wch:30},{wch:60}];
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, 'AUDIT_LOG_' + new Date().toISOString().split('T')[0] + '.xlsx');
    showToast('✓ AUDIT LOG EXPORTED — ' + data.length + ' EVENTS');
}
