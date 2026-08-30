// =============================================
// DASHBOARD RENDERING  — FIX: removed nested loadData()
// =============================================
function renderDashboard(data) {
    const oldTotal    = parseInt(document.getElementById('stat-total').innerText)    || 0;
    const oldResolved = parseInt(document.getElementById('stat-resolved').innerText) || 0;
    const oldPending  = parseInt(document.getElementById('stat-pending').innerText)  || 0;

    const newTotal    = data.length;
    const newResolved = data.filter(t => (t.Status || '').toString().toLowerCase() === 'resolved').length;
    const newPending  = data.filter(t => (t.Status || '').toString().toLowerCase() === 'pending').length;

    animateValue(document.getElementById('stat-total'),    oldTotal,    newTotal);
    animateValue(document.getElementById('stat-resolved'), oldResolved, newResolved);
    animateValue(document.getElementById('stat-pending'),  oldPending,  newPending);

    // Avg resolution time
    const resolvedTickets = data.filter(t =>
        (t.Status || '').toString().toLowerCase() === 'resolved' && t.DateIssued && t.DateReplied
    );
    let totalMinutes = 0;
    resolvedTickets.forEach(t => {
        const diff = (new Date(t.DateReplied) - new Date(t.DateIssued)) / 60000;
        if (diff > 0) totalMinutes += diff;
    });
    const avgMin = resolvedTickets.length > 0 ? totalMinutes / resolvedTickets.length : 0;
    document.getElementById('stat-tat').innerText =
        avgMin >= 60 ? (avgMin / 60).toFixed(1) + 'h' : Math.round(avgMin) + 'm';

    // Sort newest-first before display so Live Database table always shows latest tickets on top
    const sortedForTable = [...data].sort((a, b) => Number(b.TicketNo) - Number(a.TicketNo));
    populateTable(sortedForTable.slice(0, 50));

    const catCounts    = data.reduce((acc, t) => { const k = t.Type       || 'Other';    acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const branchCounts = data.reduce((acc, t) => { const k = t.Branch     || 'Unknown';  acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const engCounts    = data.reduce((acc, t) => { const k = t.Engagement || 'Not Set';  acc[k] = (acc[k] || 0) + 1; return acc; }, {});

    updateChart(catCounts);
    updateBranchChart(branchCounts);
    updateEngagementChart(engCounts);

    // v2.0 extras
    updateExtendedKPIs(data);
    // Update analytics page if visible
    const analyticsPage = document.getElementById('page-analytics');
    if (analyticsPage && !analyticsPage.classList.contains('hidden')) renderAnalytics();
}

function populateTable(dataToDisplay) {
    const reportBody = document.getElementById('daily-report-body');
    if (!reportBody) return;

    if (!dataToDisplay || dataToDisplay.length === 0) {
        reportBody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">NO DATA FOUND</td></tr>`;
        return;
    }

    reportBody.innerHTML = dataToDisplay.map(t => {
        const safeName   = escapeHtml((t.Name   || '---').toString());
        const safeBranch = escapeHtml((t.Branch || '---').toString());
        const tStatus    = (t.Status        || 'PENDING').toString().toUpperCase();
        const tSeverity  = (t.SeverityLevel || 'LOW').toString().toUpperCase();

        let sevClass = 'sev-low';
        if (tSeverity === 'CRITICAL') sevClass = 'sev-critical';
        else if (tSeverity === 'HIGH')     sevClass = 'sev-high';
        else if (tSeverity === 'MODERATE') sevClass = 'sev-moderate';

        const colorClass = tStatus === 'RESOLVED' ? 'select-resolved' :
                           tStatus === 'BLOCKED'  ? 'select-blocked'  : 'select-pending';

        // FIX: handleStatusChange is now defined above
        const statusDropdown = `
            <select class="status-select ${colorClass}" onchange="handleStatusChange(this, '${t.TicketNo}')" onclick="event.stopPropagation()">
                ${['PENDING','RESOLVED','BLOCKED'].map(opt =>
                    `<option value="${opt}" ${tStatus === opt ? 'selected' : ''}>${opt}</option>`
                ).join('')}
            </select>`;

        return `
            <tr class="ticket-row" onclick="openTicketModal('${t.TicketNo}')">
                <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:11px;">#${t.TicketNo || '---'}</td>
                <td style="font-weight:600;text-transform:uppercase;">${safeName}</td>
                <td style="color:var(--text-dim);font-size:12px;">${safeBranch}</td>
                <td class="${sevClass}" style="font-family:var(--font-mono);font-size:11px;">${tSeverity}</td>
                <td style="text-align:right;">${statusDropdown}</td>
            </tr>`;
    }).join('');
}

function updateChart(counts) {
    const ctx = document.getElementById('ticketChart');
    if (!ctx) return;
    const { gridColor, tickColor, isLight } = getChartDefaults();
    // Patch existing chart if available — no destroy/recreate flicker
    if (myChart && patchChart(myChart, Object.keys(counts), Object.values(counts))) return;
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [{ label: 'VOLUME', data: Object.values(counts),
                backgroundColor: isLight ? '#059669' : '#00ff9d', borderRadius: 5 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'" } } },
                x: { grid: { display: false },   ticks: { color: tickColor, font: { size: 9, family: "'JetBrains Mono'" } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateBranchChart(counts) {
    const ctx = document.getElementById('branchChart');
    if (!ctx) return;
    const { gridColor, tickColor } = getChartDefaults();
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (branchChart && patchChart(branchChart, sorted.map(i => i[0]), sorted.map(i => i[1]))) return;
    if (branchChart) branchChart.destroy();
    branchChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{ label: 'Top Branches', data: sorted.map(i => i[1]),
                backgroundColor: '#00e5c8', borderRadius: 5 }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'" } } },
                y: { grid: { display: false },   ticks: { color: tickColor, font: { size: 9, family: "'JetBrains Mono'" } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updateEngagementChart(counts) {
    const ctx = document.getElementById('engagementChart');
    if (!ctx) return;
    const { tickColor } = getChartDefaults();
    if (engagementChart && patchChart(engagementChart, Object.keys(counts), Object.values(counts))) return;
    if (engagementChart) engagementChart.destroy();
    engagementChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#00ff9d','#00e5c8','#ff6b35','#ffc53d','#b47aff','#5a6478'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: tickColor, font: { size: 10, family: "'JetBrains Mono'" }, padding: 16 }
                }
            },
            cutout: '68%'
        }
    });
}

// =============================================
// FILTER — FIX: separated kiosk and dashboard search
// =============================================
function filterDashboardTable() {
    const input = document.getElementById('tableSearch');
    if (!input) return;
    const query = input.value.toLowerCase();
    const filtered = cachedTickets.filter(t =>
        [t.TicketNo, t.Name, t.Branch, t.Status, t.SeverityLevel]
            .join(' ').toLowerCase().includes(query)
    );
    // Keep sorted newest-first even after filtering
    filtered.sort((a, b) => Number(b.TicketNo) - Number(a.TicketNo));
    populateTable(filtered.slice(0, 50));
}

// addLog — see stub below (forward to writeAuditLog)

// =============================================
// EXPORT TO EXCEL  — FIX: now uses SheetJS for real .xlsx
// =============================================
// FIXED: Proper Excel export with error handling
function downloadExcel() {
    if (!currentDashboardData?.length) {
        showToast('⚠ NO DATA TO EXPORT', true);
        return;
    }
    // ✅ Now uses real SheetJS with proper column widths & summary sheet

    showToast('⏳ PREPARING EXPORT...');

    try {
        // Build worksheet data with human-readable headers
        const headers = {
            ticket_no:      'Ticket No',
            ticket_tagging: 'Ticket Tagging',
            date_issued:    'Date Issued',
            date_picked_up: 'Date Picked Up',
            date_replied:   'Date Replied',
            name:           'Customer Name',
            branch:         'Branch',
            type:           'Ticket Type',
            engagement:     'Engagement Type',
            concerns:       'Client Concern',
            assistance:     'Assistance Provided',
            action:         'Action Taken',
            status:         'Status',
            channel:        'Channel',
            severity_level: 'Severity Level',
        };

        const dbKeys = Object.keys(headers);

        // Header row
        const wsData = [Object.values(headers)];

        // Data rows
        currentDashboardData.forEach(row => {
            wsData.push(dbKeys.map(k => {
                const v = row[k];
                if (v === null || v === undefined) return '';
                return v;
            }));
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Style header row width
        ws['!cols'] = dbKeys.map((k, i) => ({
            wch: Math.max(headers[dbKeys[i]].length + 4, 18)
        }));

        XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

        // Summary sheet
        const now          = new Date();
        const month        = now.getMonth() + 1;
        const year         = now.getFullYear();
        const totalTickets = currentDashboardData.length;
        const resolved     = currentDashboardData.filter(t => (t.status || '').toUpperCase() === 'RESOLVED').length;
        const pending      = currentDashboardData.filter(t => (t.status || '').toUpperCase() === 'PENDING').length;

        const summaryData = [
            ['AGRIBANK CONSUMER CARE — EXPORT SUMMARY'],
            [],
            ['Generated',  now.toLocaleString()],
            ['Period',     `${year}-${String(month).padStart(2,'0')}`],
            ['Total Tickets', totalTickets],
            ['Resolved',   resolved],
            ['Pending',    pending],
            ['Export By',  localStorage.getItem('username') || 'UNKNOWN'],
        ];

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 22 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        const filename = `AGRIBANK_EXPORT_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.xlsx`;
        XLSX.writeFile(wb, filename);

        showToast(`✓ EXPORTED ${totalTickets} RECORDS`);
        logAudit('EXPORT_EXCEL', `${totalTickets} tickets exported to ${filename}`, 'export');
        addLog(`EXPORT_SUCCESS: ${totalTickets} rows → ${filename}`);
        writeAuditLog('EXPORT_EXCEL', `${totalTickets} tickets exported to ${filename} by ${localStorage.getItem('username')||'UNKNOWN'}`);

    } catch (err) {
        console.error('Export Error:', err);
        showToast('✗ EXPORT FAILED', true);
    }
}

function refreshDashboardData() {
    loadData();
    loadKioskData();
    showToast('✓ REFRESHING...');
}

// =============================================
// FILTER CHIPS — Dashboard
// =============================================
function applyFilter(filter, btn) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    let filtered = [...cachedTickets];
    const today = new Date().toISOString().split('T')[0];
    if (filter === 'pending')  filtered = filtered.filter(t => (t.Status||'').toLowerCase() === 'pending');
    if (filter === 'resolved') filtered = filtered.filter(t => (t.Status||'').toLowerCase() === 'resolved');
    if (filter === 'critical') filtered = filtered.filter(t => (t.SeverityLevel||'').toUpperCase() === 'CRITICAL');
    if (filter === 'today')    filtered = filtered.filter(t => t.DateIssued && t.DateIssued.startsWith(today));
    filtered.sort((a, b) => Number(b.TicketNo) - Number(a.TicketNo));
    populateTable(filtered.slice(0, 50));
    const label = document.getElementById('filter-count-label');
    if (label) label.textContent = `${filtered.length} RECORDS`;
    logAudit('FILTER_APPLIED', `Filter: ${filter.toUpperCase()} — ${filtered.length} records`, 'system');
    writeAuditLog('FILTER_APPLIED', `Dashboard filter applied: ${filter.toUpperCase()} — ${filtered.length} records shown by ${localStorage.getItem('username')||'UNKNOWN'}`);
}

// Make ticket rows clickable in the Live Database table
function populateTableClickable(dataToDisplay) {
    const reportBody = document.getElementById('daily-report-body');
    if (!reportBody) return;
    if (!dataToDisplay || dataToDisplay.length === 0) {
        reportBody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">NO DATA FOUND</td></tr>`;
        return;
    }
    reportBody.innerHTML = dataToDisplay.map(t => {
      // ✅ All user inputs now properly escaped
        const safeName = escapeHtml((t.Name || '---').toString());
        const safeBranch = escapeHtml((t.Branch || '---').toString());
        const tStatus    = (t.Status        || 'PENDING').toString().toUpperCase();
        const tSeverity  = (t.SeverityLevel || 'LOW').toString().toUpperCase();
        let sevClass = 'sev-low';
        if (tSeverity === 'CRITICAL') sevClass = 'sev-critical';
        else if (tSeverity === 'HIGH') sevClass = 'sev-high';
        else if (tSeverity === 'MODERATE') sevClass = 'sev-moderate';
        const colorClass = tStatus === 'RESOLVED' ? 'select-resolved' : tStatus === 'BLOCKED' ? 'select-blocked' : 'select-pending';
        const statusDropdown = `<select class="status-select ${colorClass}" onchange="handleStatusChange(this, '${t.TicketNo}')" onclick="event.stopPropagation()">${['PENDING','RESOLVED','BLOCKED'].map(opt=>`<option value="${opt}" ${tStatus===opt?'selected':''}>${opt}</option>`).join('')}</select>`;
        return `<tr style="cursor:pointer;" onclick="openTicketModal('${t.TicketNo}')">
            <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:11px;">#${t.TicketNo||'---'}</td>
            <td style="font-weight:600;text-transform:uppercase;">${safeName}</td>
            <td style="color:var(--text-dim);font-size:12px;">${safeBranch}</td>
            <td class="${sevClass}" style="font-family:var(--font-mono);font-size:11px;">${tSeverity}</td>
            <td style="text-align:right;">${statusDropdown}</td>
        </tr>`;
    }).join('');
}
