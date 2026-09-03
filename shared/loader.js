// =============================================
// MODULE LOADER
// Fetches each page module's HTML partial and injects it into its
// placeholder container. Must run (and finish) before the app's
// normal bootstrap logic (shared/app.js) executes, since that logic
// looks up elements that live inside these partials (e.g. #stat-total,
// #daily-report-body, form fields, etc).
//
// Requires the app to be served over http(s) — e.g. `npx serve`,
// GitHub Pages, or any static host. Opening index.html directly via
// file:// will fail here because browsers block fetch() of local
// files for security reasons.
// =============================================
const MODULE_PARTIALS = [
    { id: 'login-section',      url: 'login/login.html' },
    { id: 'page-dashboard',     url: 'dashboard/dashboard.html' },
    { id: 'page-summary',       url: 'summary/summary.html' },
    { id: 'page-reports',       url: 'reports/reports.html' },
    { id: 'page-report',        url: 'report/report.html' },
    { id: 'page-kiosk',         url: 'kiosk/kiosk.html' },
    { id: 'kiosk-modals-root',  url: 'kiosk/kiosk-modals.html' },
    { id: 'page-analytics',     url: 'analytics/analytics.html' },
    { id: 'page-admin',         url: 'admin/admin.html' },
    { id: 'admin-modals-root',  url: 'admin/admin-modals.html' },
];

async function loadPartial(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        el.innerHTML = await res.text();
    } catch (err) {
        console.error(`[loader] Failed to load module "${url}":`, err);
        el.innerHTML = `<div style="padding:24px;font-family:monospace;font-size:12px;color:#f44;">
            Failed to load module: ${url}<br>${err.message}
        </div>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all(MODULE_PARTIALS.map(m => loadPartial(m.id, m.url)));
    // shared/app.js listens for this instead of DOMContentLoaded, so it only
    // runs once every module's markup actually exists in the DOM.
    document.dispatchEvent(new Event('modulesReady'));
});
