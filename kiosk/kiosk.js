// =============================================
// KIOSK TAB SWITCHER
// =============================================
function switchKioskTab(tab) {
    const tabs    = { terminals: 'ktab-terminals', monitoring: 'ktab-monitoring' };
    const panels  = { terminals: 'kiosk-panel-terminals', monitoring: 'kiosk-panel-monitoring' };
    const actions = document.getElementById('kiosk-tab-actions');

    // Toggle tab buttons
    Object.keys(tabs).forEach(k => {
        document.getElementById(tabs[k])?.classList.toggle('active', k === tab);
    });
    // Toggle panels
    Object.keys(panels).forEach(k => {
        const el = document.getElementById(panels[k]);
        if (el) el.style.display = k === tab ? 'block' : 'none';
    });

    // Swap action buttons contextually
    if (actions) {
        if (tab === 'terminals') {
            actions.innerHTML = `
                <button onclick="openAddKioskModal()" class="btn btn-primary btn-sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ADD KIOSK
                </button>`;
        } else {
            actions.innerHTML = `
                <button onclick="openMonitoringModal()" class="btn btn-primary btn-sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ADD MAINTENANCE
                </button>
                <button onclick="exportMonitoringExcel()" class="btn btn-excel btn-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    EXPORT
                </button>`;
        }
    }

    // Load data for the active tab
    if (tab === 'monitoring') loadKioskMonitoring();
    sessionStorage.setItem('kioskTab', tab);
}

// =============================================
// LOAD KIOSKS
// =============================================
async function loadKioskData() {
    const table        = document.getElementById('kioskTable');
    const loader       = document.getElementById('loader');
    const tbody        = document.getElementById('tableBody');
    const countDisplay = document.getElementById('kiosk-count');

    if (!tbody) return;
    if (loader) loader.style.display = 'block';
    if (table)  table.style.display  = 'none';

    try {
        const { data: kiosks, error } = await db
            .from('kiosks')
            .select('*')
            .order('terminal_id');

        if (error) throw error;

        allKiosks = kiosks || [];  // Store kiosks for editing
        tbody.innerHTML = '';
        let activeCount = 0;
        const rows = [];

        kiosks.forEach(k => {
            const statusStr  = (k.status || 'OFFLINE').toUpperCase();
            const isActive   = statusStr === 'ACTIVE';
            if (isActive) activeCount++;

            const cleanDate  = k.go_live ? k.go_live.split('T')[0] : '---';
            const badgeClass = isActive ? 'badge-active' : 'badge-inactive';
            const location   = k.location || '---';
            const address    = k.address  || '---';
            const threshold  = k.kiosk_threshold;
            const thresholdTxt = (threshold !== null && threshold !== '' && !isNaN(parseFloat(threshold)))
                ? '₱' + parseFloat(threshold).toLocaleString('en-PH')
                : '---';
            const locationSafe = escapeHtml(location);
            const addressSafe  = escapeHtml(address);

            rows.push(`
                <tr>
                    <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:12px;">#${escapeHtml(String(k.terminal_id || '---'))}</td>
                    <td style="font-weight:500;" title="${locationSafe}">${locationSafe}</td>
                    <td style="color:var(--text-dim);font-size:12px;">${cleanDate}</td>
                    <td style="color:var(--text-dim);font-size:12px;">${escapeHtml(k.hours || '---')}</td>
                    <td style="color:var(--text-dim);font-size:12px;" title="${addressSafe}">${addressSafe}</td>
                    <td style="color:var(--text-dim);font-size:12px;">${thresholdTxt}</td>
                    <td style="color:var(--text-dim);font-size:12px;">${k.pullout_date ? String(k.pullout_date).split('T')[0] : '---'}</td>
                    <td style="text-align:right;"><span class="badge ${badgeClass}" style="cursor:pointer;" onclick="openChangeStatusModal('${k.id}', '${escapeHtml(String(k.terminal_id || ''))}', '${locationSafe}')" title="Click to change status">${statusStr}</span></td>
                    <td style="text-align:right;white-space:nowrap;padding:8px 12px;">
                        <button onclick="openEditKioskModal('${k.id}')" class="btn btn-ghost" style="padding:8px 12px;min-height:32px;font-size:10px;display:inline-flex;align-items:center;gap:4px;" title="Edit Kiosk">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            EDIT
                        </button>
                    </td>
                </tr>`);
        });
        tbody.innerHTML = rows.join('');

        if (countDisplay) countDisplay.innerText = activeCount.toString().padStart(2, '0');
        if (loader) loader.style.display = 'none';
        if (table)  table.style.display  = 'table';

    } catch (e) {
        console.error('Kiosk Error:', e);
        if (loader) loader.innerHTML = `
            <div style="padding:20px;color:var(--red);font-family:var(--font-mono);font-size:11px;text-align:center;">
                CONNECTION FAILED — <button onclick="loadKioskData()" class="btn btn-ghost btn-sm" style="display:inline-flex;">RETRY</button>
            </div>`;
    }
}

function filterKioskTable() {
    const input = document.getElementById('kioskSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase();
    document.querySelectorAll('#tableBody tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

// ── Setup event listeners for kiosk table action buttons ──
function setupKioskTableEvents() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    // Status button handler
    tbody.querySelectorAll('button[data-action="status"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const kioskId = this.getAttribute('data-kiosk-id');
            const terminalId = this.getAttribute('data-terminal-id');
            const location = this.getAttribute('data-location');
            openChangeStatusModal(kioskId, terminalId, location);
        });
    });

    // Edit button handler
    tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const kioskId = this.getAttribute('data-kiosk-id');
            openEditKioskModal(kioskId);
        });
    });
}

// ── Parse numbers safely (handles comma-formatted strings) ──
function parseNumberSafe(s) {
    if (!s) return 0;
    if (typeof s === 'number') return s;
    return parseFloat(s.toString().replace(/,/g, '')) || 0;
}

// ── Reset all filter inputs ──
function resetFilters() {
    ['km-search','km-filter-terminal','km-filter-date-from','km-filter-date-to','km-filter-type']
        .forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.value = ''; 
        });
}

// ── LOAD — fetch from Supabase ──
async function loadKioskMonitoring() {
    const tbody = document.getElementById('km-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto 8px;"></div><div class="label">LOADING RECORDS...</div></td></tr>';
    }
    try {
        const { data, error } = await db
            .from('kiosk_monitoring')
            .select('*')
            .is('deleted_at', null) // Only show records that haven't been deleted
            .order('maintenance_date', { ascending: false });

        if (error) throw error;
        kmAllRecords = data || [];
        applyKioskMonitoringFilters();
        updateKioskMonitoringStats();
        console.log('[KM] Loaded', kmAllRecords.length, 'records');
    } catch (err) {
        console.error('[KM] Load failed:', err);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" style="padding:24px;text-align:center;color:var(--red);font-family:var(--font-mono);font-size:11px;">LOAD FAILED: ' + escapeHtml(err.message) + '<br><button onclick="loadKioskMonitoring()" class="btn btn-ghost btn-sm" style="margin-top:8px;">RETRY</button></td></tr>';
        }
        showToast('⚠ Failed to load kiosk monitoring data', true);
    }
}

// ── FILTERS ──
function applyKioskMonitoringFilters() {
    const search   = (document.getElementById('km-search')?.value || '').toLowerCase();
    const terminal = (document.getElementById('km-filter-terminal')?.value || '').toLowerCase();
    const dateFrom = document.getElementById('km-filter-date-from')?.value || '';
    const dateTo   = document.getElementById('km-filter-date-to')?.value || '';
    const typeVal  = (document.getElementById('km-filter-type')?.value || '').toLowerCase();

    kmFiltered = kmAllRecords.filter(r => {
        if (!r) return false;
        const loc  = (r.kiosk_location  || '').toLowerCase();
        const term = (r.terminal_no     || '').toLowerCase();
        const type = (r.maintenance_type|| '').toLowerCase();
        const rem  = (r.remarks         || '').toLowerCase();
        const date =  r.maintenance_date || '';
        if (search   && !loc.includes(search) && !term.includes(search) && !type.includes(search) && !rem.includes(search)) return false;
        if (terminal && !term.includes(terminal)) return false;
        if (typeVal  && type !== typeVal) return false;
        if (dateFrom && date < dateFrom) return false;
        if (dateTo   && date > dateTo)   return false;
        return true;
    });
    kmCurrentPage = 1;
    renderKioskMonitoringTable();
    updateKioskMonitoringStats();
}

function clearKioskMonitoringFilters() {
    resetFilters();
    applyKioskMonitoringFilters();
}

// ── RENDER TABLE ──
function renderKioskMonitoringTable() {
    const tbody   = document.getElementById('km-table-body');
    const countEl = document.getElementById('km-record-count');
    if (!tbody) return;

    const total      = kmFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / kmPerPage));
    if (kmCurrentPage > totalPages) kmCurrentPage = totalPages;
    const start    = (kmCurrentPage - 1) * kmPerPage;
    const pageData = kmFiltered.slice(start, start + kmPerPage);

    if (countEl) countEl.textContent = total + ' RECORD' + (total !== 1 ? 'S' : '');

    if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">📭 NO RECORDS FOUND<br><span style="opacity:0.6;">Add your first maintenance record using the button above</span></td></tr>';
        renderKioskPagination(1);
        return;
    }

    const typeColorMap = { 
        'thermal paper':'var(--blue)', 
        'repair':'var(--orange)', 
        'replacement':'var(--red)', 
        'cleaning':'var(--accent)', 
        'others':'var(--text-muted)' 
    };

    tbody.innerHTML = pageData.map(r => {
        const qty      = parseInt(r.quantity) || 1;
        const cost     = parseNumberSafe(r.maintenance_cost);
        const shipping = parseNumberSafe(r.shipping_fee);
        const total    = parseNumberSafe(r.total) || (qty * cost + shipping);
        const isHigh   = total > HIGH_COST_THRESHOLD;
        const dateStr  = r.maintenance_date ? new Date(r.maintenance_date + 'T00:00:00').toLocaleDateString('en-PH') : '---';
        const typeColor = typeColorMap[(r.maintenance_type||'').toLowerCase()] || 'var(--text-muted)';

        return '<tr class="' + (isHigh ? 'row-high-cost' : '') + '" style="cursor:default;">' +
            '<td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;" title="' + escapeHtml(r.kiosk_location||'') + '">' + escapeHtml((r.kiosk_location||'---').toUpperCase()) + '</td>' +
            '<td style="font-family:var(--font-mono);font-size:11px;color:var(--teal);">' + escapeHtml(r.terminal_no||'---') + '</td>' +
            '<td style="font-family:var(--font-mono);font-size:11px;white-space:nowrap;">' + dateStr + '</td>' +
            '<td><span style="font-family:var(--font-mono);font-size:10px;font-weight:700;color:' + typeColor + ';">' + escapeHtml(r.maintenance_type||'---') + '</span></td>' +
            '<td style="text-align:right;font-family:var(--font-mono);font-size:12px;">' + qty + '</td>' +
            '<td style="text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text-dim);">' + phpFormat(shipping) + '</td>' +
            '<td style="text-align:right;font-family:var(--font-mono);font-size:11px;">' + phpFormat(cost) + '</td>' +
            '<td style="text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;color:' + (isHigh?'var(--red)':'var(--accent)') + ';">' + phpFormat(total) + (isHigh?' <span title="High Cost" style="font-size:10px;">⚠</span>':'') + '</td>' +
            '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--text-dim);" title="' + escapeHtml(r.remarks||'') + '">' + escapeHtml(r.remarks||'—') + '</td>' +
            '<td style="text-align:right;white-space:nowrap;">' +
                '<button onclick="openEditMonitoring(\'' + r.id + '\')" class="btn btn-ghost btn-sm" style="padding:4px 8px;min-height:28px;font-size:9px;">EDIT</button>' +
                ' <button onclick="confirmKioskDelete(\'' + r.id + '\',\'' + escapeHtml(r.terminal_no||'') + '\',\'' + escapeHtml(r.kiosk_location||'') + '\',\'' + escapeHtml(r.maintenance_type||'') + '\')" class="btn btn-danger btn-sm" style="padding:4px 8px;min-height:28px;font-size:9px;">DEL</button>' +
            '</td>' +
        '</tr>';
    }).join('');

    renderKioskPagination(totalPages);
}

// ── PAGINATION ──
function renderKioskPagination(totalPages) {
    const pageInfo = document.getElementById('km-page-info');
    const pageNums = document.getElementById('km-page-numbers');
    const prevBtn  = document.getElementById('km-prev-btn');
    const nextBtn  = document.getElementById('km-next-btn');
    if (pageInfo) pageInfo.textContent = 'Page ' + kmCurrentPage + ' of ' + totalPages;
    if (prevBtn)  prevBtn.disabled = kmCurrentPage <= 1;
    if (nextBtn)  nextBtn.disabled = kmCurrentPage >= totalPages;
    if (!pageNums) return;
    const start = Math.max(1, kmCurrentPage - 2);
    const end   = Math.min(totalPages, start + 4);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    pageNums.innerHTML = pages.map(p => '<button class="page-btn ' + (p === kmCurrentPage ? 'active' : '') + '" onclick="kmGoToPage(' + p + ')">' + p + '</button>').join('');
}

function kmChangePage(delta) {
    const totalPages = Math.max(1, Math.ceil(kmFiltered.length / kmPerPage));
    kmCurrentPage = Math.min(Math.max(1, kmCurrentPage + delta), totalPages);
    renderKioskMonitoringTable();
}

function kmGoToPage(p) { 
    kmCurrentPage = p; 
    renderKioskMonitoringTable(); 
}

function kmSetPerPage() { 
    kmPerPage = parseInt(document.getElementById('km-per-page')?.value || '25'); 
    kmCurrentPage = 1; 
    renderKioskMonitoringTable(); 
}

// ── STATS STRIP ──
function updateKioskMonitoringStats() {
    const now       = new Date();
    const thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const totalCost = kmAllRecords.reduce((s,r) => s + (parseNumberSafe(r.total) || (parseInt(r.quantity||1)*parseNumberSafe(r.maintenance_cost)+parseNumberSafe(r.shipping_fee))), 0);
    const monthCnt  = kmAllRecords.filter(r => (r.maintenance_date||'').startsWith(thisMonth)).length;
    const highCnt   = kmAllRecords.filter(r => (parseNumberSafe(r.total)||(parseInt(r.quantity||1)*parseNumberSafe(r.maintenance_cost)+parseNumberSafe(r.shipping_fee))) > HIGH_COST_THRESHOLD).length;
    
    const totalEl   = document.getElementById('km-stat-total');
    const costEl    = document.getElementById('km-stat-cost');
    const monthEl   = document.getElementById('km-stat-month');
    const highEl    = document.getElementById('km-stat-highcost');
    
    if (totalEl) animateValue(totalEl, parseInt(totalEl.textContent)||0, kmAllRecords.length);
    if (costEl)  costEl.textContent = phpFormat(totalCost);
    if (monthEl) animateValue(monthEl, parseInt(monthEl.textContent)||0, monthCnt);
    if (highEl)  animateValue(highEl,  parseInt(highEl.textContent)||0,  highCnt);
}

// ── OPEN MODAL ──
function openEditMonitoring(id) { 
    openMonitoringModal(id); 
}

// ── DELETE ──
function confirmKioskDelete(id, terminal, location, type) {
    kmDeletePending = { id, terminal, location, type };
    console.log('Delete pending:', kmDeletePending); // 🔍 ADD THIS
    const modal = document.getElementById('delete-confirm-modal');
    const msg   = document.getElementById('delete-confirm-msg');
    if (msg) msg.innerHTML = 'Terminal: <strong style="color:var(--text);">' + escapeHtml(terminal) + '</strong><br>Location: ' + escapeHtml(location) + '<br>Type: ' + escapeHtml(type) + '<br><br>This action cannot be undone.';
    if (modal) modal.classList.add('open');
}

function closeDeleteConfirm() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) modal.classList.remove('open');
    kmDeletePending = null;
}

async function executeKioskDelete() {
    if (!kmDeletePending) return;
    const { id, terminal } = kmDeletePending;
    const btn = document.getElementById('confirm-delete-btn');
    
    if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;"></div> SOFT DELETING...'; 
    }
    
    try {
        // Change: Update deleted_at instead of deleting the row
        const { error } = await db.from('kiosk_monitoring')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        
        showToast('✓ RECORD ARCHIVED — ' + terminal);
        
        // Audit log logic remains the same
        if (typeof writeAuditLog === 'function') {
            await writeAuditLog('DELETE_KIOSK_MONITORING', `Maintenance record for terminal ${terminal} soft-deleted by ${localStorage.getItem('username')||'UNKNOWN'}`);
        }
        
        closeDeleteConfirm();
        await loadKioskMonitoring();
        
    } catch (err) {
        console.error('KM Delete Error:', err);
        showToast('✗ DELETE FAILED: ' + (err.message || 'Check Console'), true);
    } finally {
        if (btn) { 
            btn.disabled = false; 
            btn.textContent = 'YES, DELETE';
        }
    }
}

// ── EXCEL EXPORT ──
function exportMonitoringExcel() {
    const data = kmFiltered.length > 0 ? kmFiltered : kmAllRecords;
    if (data.length === 0) { 
        showToast('⚠ NO DATA TO EXPORT', true); 
        return; 
    }
    showToast('⏳ PREPARING EXPORT...');
    
    const headers = ['Location','Terminal No.','Date','Type','Shipping Fee','Quantity','Unit Cost','Total','Remarks'];
    const rows = [headers, ...data.map(r => [
        r.kiosk_location||'', r.terminal_no||'', r.maintenance_date||'',
        r.maintenance_type||'', parseFloat(r.shipping_fee||0), r.quantity||0,
        parseFloat(r.maintenance_cost||0), parseFloat(r.total||0), r.remarks||''
    ])];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [20,14,12,16,14,10,14,14,28].map(w => ({ wch:w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Kiosk Monitoring');
    
    const totalCost = data.reduce((s,r) => s + parseFloat(r.total||0), 0);
    const sumWs = XLSX.utils.aoa_to_sheet([
        ['AGRIBANK KIOSK MONITORING — EXPORT'],
        [],
        ['Generated:', new Date().toLocaleString('en-PH')],
        ['By:', localStorage.getItem('username')||'UNKNOWN'],
        ['Records:', data.length],
        ['Total Cost:', totalCost]
    ]);
    sumWs['!cols'] = [{ wch:20 },{ wch:30 }];
    XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');
    
    const filename = 'KIOSK_MONITORING_' + new Date().toISOString().split('T')[0] + '.xlsx';
    XLSX.writeFile(wb, filename);
    showToast('✓ EXPORTED ' + data.length + ' RECORDS');
    
    // Safe audit logging
    writeAuditLog('EXPORT_KIOSK_MONITORING', `Kiosk monitoring exported — ${data.length} records by ${localStorage.getItem('username')||'UNKNOWN'}`);
}

// ── OPEN/CLOSE FORM MODAL ──
function openMonitoringModal(editId = null) {
    const modal     = document.getElementById('monitoring-modal');
    const title     = document.getElementById('km-modal-title');
    const submitBtn = document.getElementById('km-submit-btn');
    const editIdEl  = document.getElementById('km-edit-id');
    if (!modal) return;

    // Reset form
    document.getElementById('km-form').reset();
    document.getElementById('km-total-display').textContent = '₱0.00';
    document.getElementById('km-total-hidden').value = '0';

    // Set today's date
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const dateEl = document.getElementById('km-date');
    if (dateEl) dateEl.value = today.toISOString().split('T')[0];

    if (editId) {
        const rec = kmAllRecords.find(r => String(r.id) === String(editId));
        if (!rec) { 
            showToast('⚠ RECORD NOT FOUND', true); 
            return; 
        }
        document.getElementById('km-location').value  = rec.kiosk_location  || '';
        document.getElementById('km-terminal').value  = rec.terminal_no     || '';
        document.getElementById('km-date').value      = rec.maintenance_date|| '';
        document.getElementById('km-type').value      = rec.maintenance_type|| '';
        document.getElementById('km-shipping').value  = rec.shipping_fee    || 0;
        document.getElementById('km-quantity').value  = rec.quantity        || 1;
        document.getElementById('km-cost').value      = rec.maintenance_cost|| 0;
        document.getElementById('km-remarks').value   = rec.remarks         || '';
        editIdEl.value = editId;
        computeKioskTotal();
        
        if (title)     title.textContent    = 'EDIT MAINTENANCE RECORD';
        if (submitBtn) submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> UPDATE RECORD';
    } else {
        editIdEl.value = '';
        if (title)     title.textContent    = 'ADD MAINTENANCE RECORD';
        if (submitBtn) submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE RECORD';
    }
    modal.classList.add('open');
}

function closeMonitoringModal() {
    const modal = document.getElementById('monitoring-modal');
    if (modal) modal.classList.remove('open');
}

// ── AUTO-COMPUTE TOTAL ──
function computeKioskTotal() {
    const shipping = parseFloat(document.getElementById('km-shipping')?.value||0)||0;
    const qty      = parseFloat(document.getElementById('km-quantity')?.value||0)||0;
    const cost     = parseFloat(document.getElementById('km-cost')?.value||0)||0;
    const total    = (qty * cost) + shipping;
    const displayEl= document.getElementById('km-total-display');
    const hiddenEl = document.getElementById('km-total-hidden');
    if (displayEl) { 
        displayEl.textContent = phpFormat(total); 
        displayEl.style.color = total > HIGH_COST_THRESHOLD ? 'var(--red)' : 'var(--accent)'; 
    }
    if (hiddenEl)  hiddenEl.value = total.toFixed(2);
}

// ── SUBMIT (CREATE / UPDATE) ──
async function submitKioskMonitoringForm(e) {
    e.preventDefault();
    const btn    = document.getElementById('km-submit-btn');
    const editId = document.getElementById('km-edit-id').value;
    const location = (document.getElementById('km-location').value||'').trim().toUpperCase();
    const terminal = (document.getElementById('km-terminal').value||'').trim().toUpperCase();
    const date     = document.getElementById('km-date').value;
    const type     = document.getElementById('km-type').value;
    const shipping = parseFloat(document.getElementById('km-shipping').value||0)||0;
    const qty      = parseInt(document.getElementById('km-quantity').value||1);
    const cost     = parseFloat(document.getElementById('km-cost').value||0);
    const remarks  = (document.getElementById('km-remarks').value||'').trim();
    const total    = parseFloat(((qty * cost) + shipping).toFixed(2));

    const errors = [];
    if (!location) errors.push('Kiosk Location');
    if (!terminal) errors.push('Terminal No.');
    if (!date)     errors.push('Date');
    if (!type)     errors.push('Type of Maintenance');
    if (qty < 1)   errors.push('Quantity (min 1)');
    if (cost < 0)  errors.push('Maintenance Cost');
    if (errors.length > 0) { 
        showToast('⚠ REQUIRED: ' + errors.join(', '), true); 
        return; 
    }

    const payload = { 
        kiosk_location: location, 
        terminal_no: terminal, 
        maintenance_date: date, 
        maintenance_type: type, 
        shipping_fee: shipping, 
        quantity: qty, 
        maintenance_cost: cost, 
        total, 
        remarks: remarks || null 
    };

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:13px;height:13px;border-width:2px;border-top-color:var(--bg);border-color:rgba(0,0,0,0.2);"></div> SAVING...';

    try {
        if (editId) {
            const { error } = await db.from('kiosk_monitoring').update(payload).eq('id', editId);
            if (error) throw error;
            showToast('✓ RECORD UPDATED — ' + terminal);
            if (typeof writeAuditLog === 'function') {
                await writeAuditLog('UPDATE_KIOSK_MONITORING', `Maintenance record updated for terminal ${terminal} (${location}) — type: ${type}, cost: ₱${cost}, qty: ${qty}`);
            }
        } else {
            const { error } = await db.from('kiosk_monitoring').insert([payload]);
            if (error) throw error;
            showToast('✓ RECORD SAVED — ' + terminal);
            if (typeof writeAuditLog === 'function') {
                await writeAuditLog('CREATE_KIOSK_MONITORING', `New maintenance record added for terminal ${terminal} at ${location} — type: ${type}, cost: ₱${cost}, qty: ${qty}, total: ₱${total}`);
            }
        }
        closeMonitoringModal();
        await loadKioskMonitoring();
    } catch (err) {
        console.error('KM Save Error:', err);
        const errMsg = err.message || err.details || JSON.stringify(err);
        showToast('✗ SAVE FAILED: ' + errMsg, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE RECORD';
    }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// KIOSK MANAGEMENT FUNCTIONS — ADD/EDIT KIOSK & CHANGE STATUS
// ════════════════════════════════════════════════════════════════════════════════════════════

// ── Store for kiosk data ──
let allKiosks = [];

// ── OPEN ADD KIOSK MODAL ──
function openAddKioskModal(editId = null) {
    const modal     = document.getElementById('add-kiosk-modal');
    const title     = document.getElementById('add-kiosk-modal-title');
    const submitBtn = document.getElementById('kiosk-submit-btn');
    const editIdEl  = document.getElementById('kiosk-edit-id');
    if (!modal) return;

    // Reset form
    document.getElementById('add-kiosk-form').reset();
    document.getElementById('kiosk-tag-new').checked = true;

    // Set today's date for go-live
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const dateEl = document.getElementById('kiosk-go-live');
    if (dateEl) dateEl.value = today.toISOString().split('T')[0];

    if (editId) {
        const kiosk = allKiosks.find(k => String(k.id) === String(editId));
        if (!kiosk) {
            showToast('⚠ KIOSK NOT FOUND', true);
            return;
        }
        document.getElementById('kiosk-terminal-id').value = kiosk.terminal_id || '';
        document.getElementById('kiosk-location').value = kiosk.location || '';
        document.getElementById('kiosk-address').value = kiosk.address || '';
        document.getElementById('kiosk-go-live').value = kiosk.go_live ? kiosk.go_live.split('T')[0] : '';
        document.getElementById('kiosk-hours').value = kiosk.hours || '';
        document.getElementById('kiosk-threshold').value = kiosk.kiosk_threshold || '';
        
        // Set tag
        const tag = (kiosk.tag || 'new').toLowerCase();
        if (tag === 'relocation') {
            document.getElementById('kiosk-tag-relocation').checked = true;
        } else {
            document.getElementById('kiosk-tag-new').checked = true;
        }
        
        editIdEl.value = editId;
        if (title)     title.textContent    = 'EDIT KIOSK';
        if (submitBtn) submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> UPDATE KIOSK';
    } else {
        editIdEl.value = '';
        if (title)     title.textContent    = 'ADD NEW KIOSK';
        if (submitBtn) submitBtn.innerHTML  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE KIOSK';
    }
    modal.classList.add('open');
}

function closeAddKioskModal() {
    const modal = document.getElementById('add-kiosk-modal');
    if (modal) modal.classList.remove('open');
}

// ── OPEN EDIT KIOSK MODAL ──
function openEditKioskModal(kioskId) {
    openAddKioskModal(kioskId);
}

// ── SUBMIT ADD/EDIT KIOSK ──
async function submitKioskForm(e) {
    e.preventDefault();
    const btn     = document.getElementById('kiosk-submit-btn');
    const editId  = document.getElementById('kiosk-edit-id').value;
    const terminalId = (document.getElementById('kiosk-terminal-id').value || '').trim().toUpperCase();
    const location   = (document.getElementById('kiosk-location').value || '').trim().toUpperCase();
    const address    = (document.getElementById('kiosk-address').value || '').trim();
    const goLive     = document.getElementById('kiosk-go-live').value;
    const hours      = (document.getElementById('kiosk-hours').value || '').trim();
    const threshold  = document.getElementById('kiosk-threshold').value;
    const tag        = document.querySelector('input[name="kiosk-tag"]:checked')?.value || 'new';

    const errors = [];
    if (!terminalId) errors.push('Terminal ID');
    if (!location) errors.push('Location');
    if (!address) errors.push('Address');
    if (!goLive) errors.push('Go Live Date');
    if (!hours) errors.push('Operating Hours');
    
    if (errors.length > 0) {
        showToast('⚠ REQUIRED: ' + errors.join(', '), true);
        return;
    }

    const payload = {
        terminal_id: terminalId,
        location: location,
        address: address,
        go_live: goLive,
        hours: hours,
        kiosk_threshold: threshold || null,
        tag: tag,
        status: 'ACTIVE'  // Default status for new kiosks
    };

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:13px;height:13px;border-width:2px;border-top-color:var(--bg);border-color:rgba(0,0,0,0.2);"></div> SAVING...';

    try {
        if (editId) {
            const { error } = await db.from('kiosks').update(payload).eq('id', editId);
            if (error) throw error;
            showToast('✓ KIOSK UPDATED — ' + terminalId);
            if (typeof writeAuditLog === 'function') {
                await writeAuditLog('UPDATE_KIOSK', `Kiosk updated — Terminal: ${terminalId}, Location: ${location}, Tag: ${tag}`);
            }
        } else {
            const { error } = await db.from('kiosks').insert([payload]);
            if (error) throw error;
            showToast('✓ KIOSK SAVED — ' + terminalId);
            if (typeof writeAuditLog === 'function') {
                await writeAuditLog('CREATE_KIOSK', `New kiosk added — Terminal: ${terminalId}, Location: ${location}, Tag: ${tag}`);
            }
        }
        closeAddKioskModal();
        await loadKioskData();
    } catch (err) {
        console.error('Kiosk Save Error:', err);
        const errMsg = err.message || err.details || JSON.stringify(err);
        showToast('✗ SAVE FAILED: ' + errMsg, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> SAVE KIOSK';
    }
}

// ── OPEN CHANGE STATUS MODAL ──
function openChangeStatusModal(kioskId, terminalId, location) {
    console.log('Opening change status modal for:', kioskId, terminalId, location);
    const modal = document.getElementById('change-status-modal');
    if (!modal) {
        console.error('change-status-modal not found');
        showToast('⚠ Modal not found. Please refresh page.', true);
        return;
    }

    // Reset form
    const form = document.getElementById('change-status-form');
    if (form) form.reset();
    
    const remarksField = document.getElementById('status-remarks');
    if (remarksField) remarksField.value = '';

    // Populate read-only fields
    const idField = document.getElementById('status-kiosk-id');
    const terminalField = document.getElementById('status-terminal-id');
    const locationField = document.getElementById('status-location');
    
    if (idField) idField.value = kioskId;
    if (terminalField) terminalField.innerText = terminalId || '---';
    if (locationField) locationField.innerText = location || '---';

    // Pre-check current status if it is PULL OUT and pre-fill its pullout date
    const current = allKiosks.find(k => String(k.id) === String(kioskId));
    const pulloutRadio = document.getElementById('status-pullout');
    const pulloutDateEl = document.getElementById('status-pullout-date');
    if (current && String(current.status || '').toUpperCase() === 'PULL OUT') {
        if (pulloutRadio) pulloutRadio.checked = true;
        if (pulloutDateEl && current.pullout_date) pulloutDateEl.value = String(current.pullout_date).split('T')[0];
    }
    if (typeof togglePulloutDate === 'function') togglePulloutDate();

    console.log('Modal found, opening...');
    modal.classList.add('open');
    console.log('Modal opened:', modal.classList.contains('open'));
}

// ── TOGGLE PULL OUT DATE FIELD (visible only when PULL OUT is selected) ──
function togglePulloutDate() {
    const section = document.getElementById('status-pullout-section');
    const pulloutRadio = document.getElementById('status-pullout');
    if (!section) return;
    if (pulloutRadio && pulloutRadio.checked) {
        section.style.display = 'block';
        const dateEl = document.getElementById('status-pullout-date');
        if (dateEl && !dateEl.value) {
            const today = new Date();
            today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
            dateEl.value = today.toISOString().split('T')[0];
        }
    } else {
        section.style.display = 'none';
    }
}

function closeChangeStatusModal() {
    const modal = document.getElementById('change-status-modal');
    if (modal) modal.classList.remove('open');
}

// ── SUBMIT CHANGE STATUS ──
async function submitChangeStatusForm(e) {
    e.preventDefault();
    const btn     = document.getElementById('status-submit-btn');
    const kioskId = document.getElementById('status-kiosk-id').value;
    const newStatus = document.querySelector('input[name="status-change"]:checked')?.value;
    const remarks = (document.getElementById('status-remarks').value || '').trim();

    if (!newStatus) {
        showToast('⚠ SELECT A STATUS', true);
        return;
    }

    const pulloutDate = newStatus === 'PULL OUT' ? (document.getElementById('status-pullout-date').value || '') : '';
    if (newStatus === 'PULL OUT' && !pulloutDate) {
        showToast('⚠ PULL OUT DATE REQUIRED', true);
        return;
    }

    const terminalId = document.getElementById('status-terminal-id').innerText;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:13px;height:13px;border-width:2px;border-top-color:var(--bg);border-color:rgba(0,0,0,0.2);"></div> UPDATING...';

    try {
        const payload = {
            status: newStatus,
            status_remarks: remarks || null,
            status_change_date: new Date().toISOString(),
            pullout_date: newStatus === 'PULL OUT' ? pulloutDate : null
        };

        const { error } = await db.from('kiosks').update(payload).eq('id', kioskId);
        if (error) throw error;

        showToast('✓ STATUS UPDATED — ' + terminalId + ' is now ' + newStatus);
        
        if (typeof writeAuditLog === 'function') {
            await writeAuditLog('UPDATE_KIOSK_STATUS', `Kiosk status changed to ${newStatus} for terminal ${terminalId}${remarks ? ' — Notes: ' + remarks : ''}`);
        }
        
        closeChangeStatusModal();
        await loadKioskData();
    } catch (err) {
        console.error('Status Update Error:', err);
        const errMsg = err.message || err.details || JSON.stringify(err);
        showToast('✗ UPDATE FAILED: ' + errMsg, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> UPDATE STATUS';
    }
}
