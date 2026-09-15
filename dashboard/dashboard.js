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
    const engCounts    = data.reduce((acc, t) => { const k = t.Engagement || ENGAGEMENT_UNSET;  acc[k] = (acc[k] || 0) + 1; return acc; }, {});

    updateChart(catCounts);
    updateBranchChart(branchCounts);
    updateEngagementChart(engCounts);

    // v2.0 extras
    updateExtendedKPIs(data);
    // Update analytics page if visible
    const analyticsPage = document.getElementById('page-analytics');
    if (analyticsPage && !analyticsPage.classList.contains('hidden')) renderAnalytics();
}

function viewPendingTickets() {
    showPage('dashboard');
    const pendingFilter = document.querySelector('.filter-chip[data-filter="pending"]');
    applyFilter('pending', pendingFilter);
    document.querySelector('.live-database-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showAllTickets() {
    showPage('dashboard');
    const allFilter = document.querySelector('.filter-chip[data-filter="all"]');
    applyFilter('all', allFilter);
    document.querySelector('.live-database-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

        const sevClass = severityClass(tSeverity);

        const colorClass = tStatus === 'RESOLVED' ? 'select-resolved' :
                           tStatus === 'BLOCKED'  ? 'select-blocked'  : 'select-pending';

        // FIX: handleStatusChange is now defined above
        const statusDropdown = `
            <select class="status-select ${colorClass}" onchange="handleStatusChange(this, '${t.TicketNo}')" onclick="event.stopPropagation()">
                ${['PENDING','RESOLVED','BLOCKED'].map(opt =>
                    `<option value="${opt}" ${tStatus === opt ? 'selected' : ''}>${opt}</option>`
                ).join('')}
            </select>`;

        // Enhanced: long client / branch names wrap + hover tooltips so nothing is hidden
        return `
            <tr class="ticket-row" onclick="openTicketModal('${t.TicketNo}')">
                <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:11px;" title="#${t.TicketNo || '---'}">#${t.TicketNo || '---'}</td>
                <td class="cell-wrap" style="font-weight:600;text-transform:uppercase;" title="${safeName}">${safeName}</td>
                <td class="cell-wrap" style="color:var(--text-dim);font-size:12px;" title="${safeBranch}">${safeBranch}</td>
                <td class="${sevClass}" style="font-family:var(--font-mono);font-size:11px;" title="${tSeverity}">${tSeverity}</td>
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
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const total = values.reduce((sum, value) => sum + value, 0);
    const formatPercentage = value => total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';

    if (engagementChart && patchChart(engagementChart, labels, values)) return;
    if (engagementChart) engagementChart.destroy();
    engagementChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ['#00ff9d','#00e5c8','#ff6b35','#ffc53d','#b47aff','#5a6478'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: tickColor,
                        font: { size: 10, family: "'JetBrains Mono'" },
                        padding: 16,
                        generateLabels: chart => chart.data.labels.map((label, index) => ({
                            text: `${label} (${formatPercentage(chart.data.datasets[0].data[index])})`,
                            fillStyle: chart.data.datasets[0].backgroundColor[index],
                            hidden: false,
                            index
                        }))
                    }
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.label}: ${context.raw} (${formatPercentage(context.raw)})`
                    }
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
        // Build worksheet data with human-readable headers (shared constant)
        const headers = REPORT_EXPORT_COLUMNS;

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

// =============================================
// CHART OVERVIEW MODAL — full-screen data overview
// =============================================
let chartOverviewChart = null;

const CHART_OVERVIEW_COLORS = ['#00ff9d', '#ff6b35', '#00e5c8', '#ffc53d', '#b47aff', '#3d9eff', '#ff4444', '#27c93f', '#ffbd2e', '#5a6478'];

function openChartOverview(kind) {
    let title = '';
    let chartType = 'bar';
    let labels = [];
    let values = [];

    if (kind === 'engagement' && engagementChart) {
        title     = 'TYPE OF ENGAGEMENT';
        chartType = 'doughnut';
        labels    = engagementChart.data.labels || [];
        values    = (engagementChart.data.datasets[0]?.data || []).slice();
    } else if (kind === 'ticket-type' && myChart) {
        title     = 'TICKET TYPE BREAKDOWN';
        chartType = 'bar';
        labels    = myChart.data.labels || [];
        values    = (myChart.data.datasets[0]?.data || []).slice();
    } else if (kind === 'branch') {
        // Full breakdown of every branch (the dashboard card only shows top 10)
        title     = 'BRANCH VOLUME';
        chartType = 'horizontal';
        const counts = (cachedTickets || []).reduce((acc, t) => {
            const k = t.Branch || 'Unknown';
            acc[k]  = (acc[k] || 0) + 1;
            return acc;
        }, {});
        labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        values = labels.map(k => counts[k]);
    }

    if (labels.length === 0) { showToast('⚠ NO DATA TO DISPLAY', true); return; }

    const colors = labels.map((_, i) => CHART_OVERVIEW_COLORS[i % CHART_OVERVIEW_COLORS.length]);
    const total  = values.reduce((sum, v) => sum + (Number(v) || 0), 0);

    const titleEl = document.getElementById('chart-overview-title');
    if (titleEl) titleEl.textContent = title;
    const totalEl = document.getElementById('chart-overview-total');
    if (totalEl) totalEl.textContent = `TOTAL: ${total} TICKET${total === 1 ? '' : 'S'}`;

    buildChartOverviewTable(labels, values, colors, total);
    buildChartOverviewChart(chartType, labels, values, colors);

    document.getElementById('chart-overview-modal')?.classList.add('open');
    document.body.classList.add('chart-overview-open');
    writeAuditLog('CHART_OVERVIEW', `${title} full-screen overview opened by ${localStorage.getItem('username')||'UNKNOWN'}`);
}

function chartOverviewPct(value, values) {
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
    return total ? `${((Number(value) / total) * 100).toFixed(1)}%` : '0.0%';
}

function buildChartOverviewTable(labels, values, colors, total) {
    const body = document.getElementById('chart-overview-body');
    if (!body) return;
    body.innerHTML = labels.map((label, i) => {
        const count = Number(values[i]) || 0;
        const share = total ? ((count / total) * 100).toFixed(1) : '0.0';
        return `<tr>
            <td style="font-weight:600;">
                <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${colors[i]};margin-right:8px;vertical-align:middle;"></span>
                <span style="vertical-align:middle;">${escapeHtml(String(label))}</span>
            </td>
            <td style="text-align:right;font-family:var(--font-mono);">${count}</td>
            <td style="text-align:right;font-family:var(--font-mono);color:var(--text-dim);">${share}%</td>
        </tr>`;
    }).join('');
}

function buildChartOverviewChart(type, labels, values, colors) {
    const ctx = document.getElementById('chart-overview-canvas');
    if (!ctx) return;
    if (chartOverviewChart) chartOverviewChart.destroy();
    chartOverviewChart = null;

    const { gridColor, tickColor } = getChartDefaults();
    const isDoughnut     = type === 'doughnut';
    const isHorizontal   = type === 'horizontal';

    // Horizontal bars grow with the number of branches; reset for other types.
    const wrap = ctx.closest('.chart-overview-canvas-wrap');
    if (wrap) {
        if (isHorizontal) {
            wrap.style.height = 'auto';
            wrap.style.minHeight = Math.max(360, labels.length * 28 + 70) + 'px';
        } else {
            wrap.style.height = '';
            wrap.style.minHeight = '360px';
        }
    }

    const dataset = isDoughnut
        ? { data: values, backgroundColor: colors, borderWidth: 0 }
        : { label: 'VOLUME', data: values, backgroundColor: colors, borderRadius: 6 };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isHorizontal ? 'y' : undefined,
        cutout: isDoughnut ? '62%' : undefined,
        scales: isDoughnut ? undefined : (isHorizontal ? {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'" } } },
            y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, family: "'JetBrains Mono'" } } }
        } : {
            y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'" } } },
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11, family: "'JetBrains Mono'" } } }
        }),
        plugins: {
            legend: isDoughnut ? {
                position: 'bottom',
                labels: {
                    color: tickColor,
                    font: { size: 11, family: "'JetBrains Mono'" },
                    padding: 14,
                    generateLabels: chart => chart.data.labels.map((label, index) => ({
                        text: `${label} (${values[index]} · ${chartOverviewPct(values[index], values)})`,
                        fillStyle: colors[index],
                        hidden: false,
                        index
                    }))
                }
            } : { display: false },
            tooltip: isDoughnut
                ? { callbacks: { label: context => `${context.label}: ${context.raw} (${chartOverviewPct(context.raw, values)})` } }
                : { callbacks: { label: context => `  ${context.raw}` } }
        }
    };

    chartOverviewChart = new Chart(ctx.getContext('2d'), {
        type: isDoughnut ? 'doughnut' : 'bar',
        data: { labels, datasets: [dataset] },
        options
    });
}

function closeChartOverview() {
    document.getElementById('chart-overview-modal')?.classList.remove('open');
    document.body.classList.remove('chart-overview-open');
    if (chartOverviewChart) { chartOverviewChart.destroy(); chartOverviewChart = null; }
}
