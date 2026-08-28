// =============================================
// SUMMARY
// =============================================
function updateSummary(tickets) {
    const now          = new Date();
    const todayStr     = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    const monthlyTickets = tickets.filter(t => {
        if (!t.DateIssued) return false;
        const d = new Date(t.DateIssued);
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
    });

    const todayTickets  = monthlyTickets.filter(t => t.DateIssued && t.DateIssued.startsWith(todayStr));
    const daysPassed    = now.getDate();
    const resolvedCount = monthlyTickets.filter(t =>
        (t.Status || '').toString().trim().toUpperCase() === 'RESOLVED'
    ).length;
    const avgDaily = daysPassed > 0 ? Math.round(monthlyTickets.length / daysPassed) : 0;

    const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    updateEl('global-monthly-total', monthlyTickets.length.toString().padStart(3, '0'));
    updateEl('ftd-ma',               todayTickets.length);
    updateEl('mt-ma',                avgDaily);
    updateEl('res-ma',               resolvedCount);
    updateEl('today-total-tag',      `${todayTickets.length} TOTAL`);

    const listBody = document.getElementById('summary-daily-list');
    const emptyMsg = document.getElementById('summary-empty-msg');

    if (listBody) {
        if (todayTickets.length === 0) {
            listBody.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
        } else {
            emptyMsg?.classList.add('hidden');
            listBody.innerHTML = todayTickets.slice().reverse().map(t => {
                const status = (t.Status || '').toString().trim().toUpperCase();
                const badge  = status === 'RESOLVED'
                    ? `<span class="badge badge-resolved">RESOLVED</span>`
                    : status === 'BLOCKED'
                    ? `<span class="badge badge-blocked">BLOCKED</span>`
                    : `<span class="badge badge-pending">PENDING</span>`;
                return `
                    <tr>
                        <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:11px;">#${t.TicketNo}</td>
                        <td style="font-weight:600;text-transform:uppercase;">${escapeHtml(t.Name || '---')}</td>
                        <td style="color:var(--text-dim);font-size:12px;">${escapeHtml(t.Type   || '---')}</td>
                        <td style="color:var(--text-dim);font-size:12px;">${escapeHtml(t.Branch || '---')}</td>
                        <td style="text-align:right;">${badge}</td>
                    </tr>`;
            }).join('');
        }
    }

    const dateDisplay = document.getElementById('summary-date-display');
    if (dateDisplay) dateDisplay.innerText = now.toLocaleString();
}
