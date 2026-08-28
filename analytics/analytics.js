// =============================================
// ANALYTICS PAGE
// =============================================
function renderAnalytics() {
    if (!cachedTickets.length) return;
    const periodVal = document.getElementById('analytics-period')?.value || '30';
    let filtered = cachedTickets;
    if (periodVal !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(periodVal));
        filtered = cachedTickets.filter(t => t.DateIssued && new Date(t.DateIssued) >= cutoff);
    }

    // Resolution rate
    const total    = filtered.length;
    const resolved = filtered.filter(t => (t.Status||'').toLowerCase() === 'resolved').length;
    const pending  = filtered.filter(t => (t.Status||'').toLowerCase() === 'pending').length;
    const critical = filtered.filter(t => (t.SeverityLevel||'').toUpperCase() === 'CRITICAL' && (t.Status||'').toLowerCase() !== 'resolved').length;
    const resRate  = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0';
    const escalatedCount = filtered.filter(t => (t.Action||'').toUpperCase() === 'ESCALATED').length;

    const anResEl   = document.getElementById('an-res-rate');
    const anReopenEl = document.getElementById('an-reopen');
    if (anResEl)    animateValue(anResEl,   parseFloat(anResEl.textContent)   || 0, parseFloat(resRate));
    if (anReopenEl) animateValue(anReopenEl, parseFloat(anReopenEl.textContent) || 0, total > 0 ? parseFloat(((escalatedCount/total)*100).toFixed(1)) : 0);
    if (anResEl) setTimeout(() => { anResEl.textContent = resRate + '%'; }, 720);
    if (anReopenEl) setTimeout(() => { anReopenEl.textContent = ((escalatedCount/total)*100).toFixed(1) + '%'; }, 720);

    // AHT
    const resolvedWithTime = filtered.filter(t => (t.Status||'').toLowerCase() === 'resolved' && t.DateIssued && t.DateReplied);
    const totalMins = resolvedWithTime.reduce((sum, t) => {
        const d = (new Date(t.DateReplied) - new Date(t.DateIssued)) / 60000;
        return sum + (d > 0 ? d : 0);
    }, 0);
    const avgMins = resolvedWithTime.length ? totalMins / resolvedWithTime.length : 0;
    const ahtEl = document.getElementById('an-aht');
    if (ahtEl) ahtEl.textContent = avgMins >= 60 ? (avgMins/60).toFixed(1) + 'h' : Math.round(avgMins) + 'm';

    // Peak hour
    const hourCounts = {};
    filtered.forEach(t => {
        if (t.DateIssued) { const h = new Date(t.DateIssued).getHours(); hourCounts[h] = (hourCounts[h]||0)+1; }
    });
    const peakH = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0];
    const peakEl = document.getElementById('an-peak');
    if (peakEl) peakEl.textContent = peakH ? `${String(peakH[0]).padStart(2,'0')}:00` : '--:--';

    // Escalation banner
    const banner = document.getElementById('escalation-banner');
    const msg    = document.getElementById('escalation-msg');
    if (banner && msg) {
        if (critical > 0) { banner.classList.remove('hidden'); msg.textContent = `${critical} CRITICAL TICKET${critical>1?'S':''} REQUIRE IMMEDIATE ATTENTION`; }
        else banner.classList.add('hidden');
    }

    // SLA alert chip in topbar
    const slaChip  = document.getElementById('sla-alert-chip');
    const slaCount = document.getElementById('sla-count');
    if (slaChip && slaCount) {
        if (critical > 0) { slaChip.classList.remove('hidden'); slaCount.textContent = critical; }
        else slaChip.classList.add('hidden');
    }

    // Charts
    buildTrendChart(filtered);
    buildTatDistChart(filtered);
    buildSeverityChart(filtered);
    buildChannelChart(filtered);
    buildSlaTable(filtered);
}

function buildTrendChart(data) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    const { gridColor, tickColor } = getChartDefaults();
    // Group by date
    const dateCounts = {};
    data.forEach(t => {
        if (t.DateIssued) {
            const d = t.DateIssued.split('T')[0];
            dateCounts[d] = (dateCounts[d]||0)+1;
        }
    });
    const sorted = Object.entries(dateCounts).sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: sorted.map(([d]) => d.slice(5)),
            datasets: [{
                label: 'Tickets',
                data: sorted.map(([,v]) => v),
                borderColor: '#00ff9d',
                backgroundColor: 'rgba(0,255,157,0.07)',
                tension: 0.4, fill: true,
                pointBackgroundColor: '#00ff9d', pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid:{ color:gridColor }, ticks:{ color:tickColor, font:{ family:"'JetBrains Mono'", size:10 } } },
                x: { grid:{ display:false }, ticks:{ color:tickColor, font:{ size:9, family:"'JetBrains Mono'" }, maxRotation:45 } }
            },
            plugins: { legend:{ display:false } }
        }
    });
}

function buildTatDistChart(data) {
    const ctx = document.getElementById('tatDistChart');
    if (!ctx) return;
    const { gridColor, tickColor } = getChartDefaults();
    const buckets = { '<1h':0, '1-4h':0, '4-8h':0, '8-24h':0, '>24h':0 };
    data.filter(t => t.DateIssued && t.DateReplied).forEach(t => {
        const h = (new Date(t.DateReplied) - new Date(t.DateIssued)) / 3600000;
        if (h < 1) buckets['<1h']++;
        else if (h < 4) buckets['1-4h']++;
        else if (h < 8) buckets['4-8h']++;
        else if (h < 24) buckets['8-24h']++;
        else buckets['>24h']++;
    });
    if (tatDistChart) tatDistChart.destroy();
    tatDistChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(buckets),
            datasets: [{ label:'Tickets', data: Object.values(buckets), backgroundColor:['#00ff9d','#00e5c8','#ffc53d','#ff6b35','#ff4444'], borderRadius:5 }]
        },
        options: { responsive:true, maintainAspectRatio:false, scales:{ y:{grid:{color:gridColor},ticks:{color:tickColor,font:{family:"'JetBrains Mono'"}}}, x:{grid:{display:false},ticks:{color:tickColor,font:{family:"'JetBrains Mono'",size:10}}} }, plugins:{legend:{display:false}} }
    });
}

function buildSeverityChart(data) {
    const ctx = document.getElementById('severityChart');
    if (!ctx) return;
    const { tickColor } = getChartDefaults();
    const counts = { CRITICAL:0, HIGH:0, MODERATE:0, LOW:0 };
    data.forEach(t => { const s=(t.SeverityLevel||'LOW').toUpperCase(); if(counts[s]!==undefined) counts[s]++; });
    if (severityChart) severityChart.destroy();
    severityChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { labels:Object.keys(counts), datasets:[{ data:Object.values(counts), backgroundColor:['#ff4444','#ff6b35','#ffc53d','#3d9eff'], borderWidth:0 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:tickColor, font:{ size:10, family:"'JetBrains Mono'" }, padding:12 } } }, cutout:'65%' }
    });
}

function buildChannelChart(data) {
    const ctx = document.getElementById('channelChart');
    if (!ctx) return;
    const { gridColor, tickColor } = getChartDefaults();
    const counts = {};
    data.forEach(t => { const c=t.Channel||'UNKNOWN'; counts[c]=(counts[c]||0)+1; });
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    if (channelChart) channelChart.destroy();
    channelChart = new Chart(ctx.getContext('2d'), {
        type:'bar',
        data:{ labels:sorted.map(([k])=>k), datasets:[{ label:'Volume', data:sorted.map(([,v])=>v), backgroundColor:'#b47aff', borderRadius:5 }] },
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{grid:{color:gridColor},ticks:{color:tickColor,font:{family:"'JetBrains Mono'"}}}, y:{grid:{display:false},ticks:{color:tickColor,font:{size:10,family:"'JetBrains Mono'"}}} }, plugins:{legend:{display:false}} }
    });
}

function buildSlaTable(data) {
    const tbody  = document.getElementById('sla-table-body');
    const cntEl  = document.getElementById('sla-table-count');
    if (!tbody) return;
    const now = new Date();
    // Show pending tickets sorted by age descending
    const pending = data
        .filter(t => (t.Status||'').toLowerCase() !== 'resolved' && t.DateIssued)
        .sort((a,b) => new Date(a.DateIssued) - new Date(b.DateIssued))
        .slice(0, 30);
    if (cntEl) cntEl.textContent = `${pending.length} TICKETS`;
    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">ALL TICKETS RESOLVED ✓</td></tr>';
        return;
    }
    const sevColor = { CRITICAL:'sev-critical', HIGH:'sev-high', MODERATE:'sev-moderate', LOW:'sev-low' };
    tbody.innerHTML = pending.map(t => {
        const issued = new Date(t.DateIssued);
        const ageMins = (now - issued) / 60000;
        const ageStr = ageMins >= 1440 ? (ageMins/1440).toFixed(1)+'d' : ageMins >= 60 ? (ageMins/60).toFixed(1)+'h' : Math.round(ageMins)+'m';
        const isUrgent = (t.SeverityLevel||'').toUpperCase() === 'CRITICAL' && ageMins > 120;
        return `<tr style="${isUrgent?'background:rgba(255,68,68,0.05);':''} cursor:pointer;" onclick="openTicketModal('${t.TicketNo}')">
            <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:11px;">#${t.TicketNo}</td>
            <td style="font-weight:600;">${escapeHtml((t.Name||'---').toUpperCase())}</td>
            <td style="color:var(--text-dim);font-size:12px;">${escapeHtml(t.Branch||'---')}</td>
            <td class="${sevColor[(t.SeverityLevel||'LOW').toUpperCase()]}" style="font-family:var(--font-mono);font-size:11px;">${(t.SeverityLevel||'LOW').toUpperCase()}</td>
            <td style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono);">${issued.toLocaleDateString('en-PH')}</td>
            <td style="font-family:var(--font-mono);font-size:11px;color:${isUrgent?'var(--red)':'var(--orange)'};">${ageStr}</td>
            <td style="text-align:right;"><span class="badge badge-pending">OPEN</span></td>
        </tr>`;
    }).join('');
}

// PDF export (opens a printable window)
function downloadAnalyticsPDF() {
    showToast('⏳ GENERATING PDF...');
    const w   = window.open('', '_blank');
    const now = new Date().toLocaleString('en-PH', { hour12: false });
    const total = cachedTickets.length;
    const res   = cachedTickets.filter(t=>(t.Status||'').toLowerCase()==='resolved').length;
    const pend  = cachedTickets.filter(t=>(t.Status||'').toLowerCase()==='pending').length;
    const crit  = cachedTickets.filter(t=>(t.SeverityLevel||'').toUpperCase()==='CRITICAL').length;
    w.document.write(`<html><head><title>Analytics Report</title><style>
        body{font-family:monospace;padding:40px;background:#fff;color:#000;}
        h1{font-size:24px;letter-spacing:2px;border-bottom:3px solid #000;padding-bottom:10px;}
        h2{font-size:14px;letter-spacing:1px;margin-top:24px;color:#333;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th{background:#000;color:#fff;padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.1em;}
        td{padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;}
        .kpi{display:inline-block;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:14px 24px;margin:8px;min-width:140px;text-align:center;}
        .kpi-num{font-size:32px;font-weight:700;display:block;}
        .kpi-lbl{font-size:10px;letter-spacing:0.12em;color:#666;text-transform:uppercase;}
        @media print{body{padding:20px;}}
    </style></head><body class="dark">
        <h1>CONSUMER CARE — ANALYTICS REPORT</h1>
        <p style="font-size:11px;color:#666;margin-bottom:20px;">Generated: ${now} · User: ${localStorage.getItem('username')||'SYSTEM'}</p>
        <h2>KEY PERFORMANCE INDICATORS</h2>
        <div>
            <div class="kpi"><span class="kpi-num">${total}</span><span class="kpi-lbl">Total Tickets</span></div>
            <div class="kpi"><span class="kpi-num">${res}</span><span class="kpi-lbl">Resolved</span></div>
            <div class="kpi"><span class="kpi-num">${pend}</span><span class="kpi-lbl">Pending</span></div>
            <div class="kpi"><span class="kpi-num">${crit}</span><span class="kpi-lbl">Critical</span></div>
            <div class="kpi"><span class="kpi-num">${total>0?((res/total)*100).toFixed(1):'0.0'}%</span><span class="kpi-lbl">Resolution Rate</span></div>
        </div>
        <h2>TICKET STATUS BREAKDOWN</h2>
        <table><thead><tr><th>Ticket #</th><th>Client</th><th>Branch</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${cachedTickets.slice(0,100).map(t=>`<tr><td>#${t.TicketNo}</td><td>${(t.Name||'---').toUpperCase()}</td><td>${t.Branch||'---'}</td><td>${t.Type||'---'}</td><td>${t.SeverityLevel||'---'}</td><td>${t.Status||'---'}</td></tr>`).join('')}</tbody></table>
        <p style="font-size:10px;color:#aaa;margin-top:32px;">AGRIBANK CONSUMER CARE SYSTEM · CONFIDENTIAL</p>
        <script>setTimeout(()=>window.print(),600)</scr`+'ipt></body></html>');
    w.document.close();
    showToast('✓ PDF REPORT GENERATED');
    logAudit('EXPORT_PDF_REPORT', `Analytics report generated — ${total} tickets`, 'export');
}

// =============================================
// EXTENDED KPI — Extra dashboard stat cards
// =============================================
function updateExtendedKPIs(data) {
    // SLA compliance: resolved within target
    const slaTarget = { CRITICAL:120, HIGH:240, MODERATE:480, LOW:1440 };
    const resolvedWithTime = data.filter(t => (t.Status||'').toLowerCase()==='resolved' && t.DateIssued && t.DateReplied);
    const slaCompliant = resolvedWithTime.filter(t => {
        const mins    = (new Date(t.DateReplied)-new Date(t.DateIssued))/60000;
        const target  = slaTarget[(t.SeverityLevel||'LOW').toUpperCase()] || 480;
        return mins <= target;
    });
    const slaPct = resolvedWithTime.length > 0 ? ((slaCompliant.length/resolvedWithTime.length)*100).toFixed(1) : '--';
    const slaEl = document.getElementById('stat-sla');
    if (slaEl) slaEl.textContent = slaPct + '%';

    const critOpenCount = data.filter(t => (t.SeverityLevel||'').toUpperCase()==='CRITICAL' && (t.Status||'').toLowerCase()!=='resolved').length;
    const critEl = document.getElementById('stat-critical');
    if (critEl) animateValue(critEl, parseInt(critEl.innerText)||0, critOpenCount);

    const appCount = data.filter(t => (t.Channel||'').toUpperCase().includes('APP')).length;
    const appEl = document.getElementById('stat-app');
    if (appEl) animateValue(appEl, parseInt(appEl.innerText)||0, appCount);

    const escalatedCount = data.filter(t => (t.Action||'').toUpperCase()==='ESCALATED').length;
    const escEl = document.getElementById('stat-escalated');
    if (escEl) animateValue(escEl, parseInt(escEl.innerText)||0, escalatedCount);

    // Fire notifications for critical unresolved
    if (critOpenCount > 0) {
        const existing = notifications.find(n => n.type==='critical' && n.msg.includes('CRITICAL'));
        if (!existing) pushNotif(`⚠ ${critOpenCount} CRITICAL ticket${critOpenCount>1?'s':''} still unresolved`, 'critical');
    }

    // SLA chip
    const slaChip  = document.getElementById('sla-alert-chip');
    const slaCount = document.getElementById('sla-count');
    if (slaChip && slaCount) {
        if (critOpenCount > 0) { slaChip.classList.remove('hidden'); slaCount.textContent = critOpenCount; }
        else slaChip.classList.add('hidden');
    }
}
