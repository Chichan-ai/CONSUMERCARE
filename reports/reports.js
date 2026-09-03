const REPORT_EXPORT_COLUMNS = {
    ticket_no: 'Ticket No',
    ticket_tagging: 'Ticket Tagging',
    date_issued: 'Date Issued',
    date_picked_up: 'Date Picked Up',
    date_replied: 'Date Replied',
    name: 'Customer Name',
    branch: 'Branch',
    type: 'Ticket Type',
    engagement: 'Engagement Type',
    concerns: 'Client Concern',
    assistance: 'Assistance Provided',
    action: 'Action Taken',
    status: 'Status',
    channel: 'Channel',
    severity_level: 'Severity Level'
};

let lastGeneratedTickets = [];

function getFilteredTickets() {
    const type = document.getElementById('report-ticket-type')?.value || '';
    const status = document.getElementById('report-status')?.value || '';
    const start = document.getElementById('report-start-date')?.value || '';
    const end = document.getElementById('report-end-date')?.value || '';

    let tickets = [...currentDashboardData];

    if (start && end) {
        const startTime = new Date(`${start}T00:00:00`).getTime();
        const endTime = new Date(`${end}T23:59:59.999`).getTime();
        tickets = tickets.filter(ticket => {
            if (!ticket.date_issued) return false;
            const issuedTime = new Date(ticket.date_issued).getTime();
            return issuedTime >= startTime && issuedTime <= endTime;
        });
    }

    if (type) {
        tickets = tickets.filter(ticket => (ticket.type || '').toUpperCase() === type.toUpperCase());
    }

    if (status) {
        tickets = tickets.filter(ticket => (ticket.status || '').toUpperCase() === status.toUpperCase());
    }

    return tickets;
}

function generateReport() {
    const start = document.getElementById('report-start-date')?.value;
    const end = document.getElementById('report-end-date')?.value;
    if (start && end && start > end) {
        showToast('START DATE MUST BE BEFORE END DATE', true);
        return;
    }
    lastGeneratedTickets = getFilteredTickets();
    renderReportTable(lastGeneratedTickets);
    showToast('✓ REPORT GENERATED');
}

function resetReportFilters() {
    const start = document.getElementById('report-start-date');
    const end = document.getElementById('report-end-date');
    if (start) start.value = '';
    if (end) end.value = '';

    const type = document.getElementById('report-ticket-type');
    const status = document.getElementById('report-status');
    if (type) type.value = '';
    if (status) status.value = '';

    lastGeneratedTickets = [];
    renderReportTable(lastGeneratedTickets);
    showToast('✓ FILTERS RESET');
}

function renderReportTable(tickets) {
    const body = document.getElementById('reports-preview-body');
    const count = document.getElementById('reports-count');
    if (!body || !count) return;

    count.textContent = `${tickets.length} TICKET${tickets.length === 1 ? '' : 'S'}`;

    if (tickets.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="reports-empty">NO TICKETS FOUND. SET FILTERS AND CLICK GENERATE REPORT.</td></tr>';
        return;
    }

    body.innerHTML = tickets.slice(0, 100).map(ticket => {
        const status = (ticket.status || 'PENDING').toUpperCase();
        const badgeClass = status === 'RESOLVED' ? 'badge-resolved' : status === 'BLOCKED' ? 'badge-blocked' : 'badge-pending';
        return `<tr>
            <td style="font-family:var(--font-mono);">#${escapeHtml(String(ticket.ticket_no ?? '---'))}</td>
            <td>${ticket.date_issued ? new Date(ticket.date_issued).toLocaleString('en-PH', { hour12: false }) : '---'}</td>
            <td>${escapeHtml(ticket.name || '---')}</td>
            <td>${escapeHtml(ticket.branch || '---')}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(status)}</span></td>
            <td>${escapeHtml(ticket.severity_level || '---')}</td>
        </tr>`;
    }).join('');
}

function exportFilteredTickets() {
    const start = document.getElementById('report-start-date')?.value;
    const end = document.getElementById('report-end-date')?.value;
    if (start && end && start > end) {
        showToast('START DATE MUST BE BEFORE END DATE', true);
        return;
    }

    const tickets = getFilteredTickets();
    if (!tickets.length) {
        showToast('NO TICKETS TO EXPORT', true);
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast('EXPORT LIBRARY UNAVAILABLE', true);
        return;
    }

    const keys = Object.keys(REPORT_EXPORT_COLUMNS);
    const rows = [Object.values(REPORT_EXPORT_COLUMNS), ...tickets.map(ticket => keys.map(key => ticket[key] ?? ''))];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = keys.map(key => ({ wch: Math.max(REPORT_EXPORT_COLUMNS[key].length + 4, 18) }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Tickets');
    const suffix = start && end ? `${start}_TO_${end}` : 'ALL';
    const filename = `CONSUMERCARE_REPORT_${suffix}.xlsx`;
    XLSX.writeFile(book, filename);
    showToast(`✓ EXPORTED ${tickets.length} TICKETS`);
    writeAuditLog('REPORT_EXPORTED', `${tickets.length} tickets exported (${suffix}) by ${localStorage.getItem('username') || 'UNKNOWN'}`);
}

document.addEventListener('modulesReady', () => {});
