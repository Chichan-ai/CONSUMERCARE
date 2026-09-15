// =============================================
// SHARED CONSTANTS & HELPERS — single source of truth
// Loaded before every other script in index.html.
// =============================================
'use strict';

// ── Type of Engagement ──
// Canonical list. Populates the NEW ENTRY dropdown, charts, exports and
// fallbacks so they can never drift out of sync.
const ENGAGEMENT_TYPES = [
    'CONCERN', 'REQUEST', 'QUERY', 'COMPLAINT', 'ISSUE', 'OTHERS'
];

const ENGAGEMENT_LABEL = 'Type of Engagement';

const ENGAGEMENT_UNSET = 'Not Set';   // chart fallback for missing values

// Convert an uppercase dropdown value into Title Case so new entries match
// the legacy DB format (e.g. "DEPOSIT CONCERNS" → "Deposit Concerns").
// Values that are themselves acronyms (e.g. "SOA") are kept as-is.
const TITLE_CASE_EXCEPTIONS = ['SOA'];

function titleCase(value) {
    if (TITLE_CASE_EXCEPTIONS.includes(String(value || '').trim().toUpperCase())) {
        return String(value).trim();
    }
    return String(value || '')
        .trim()
        .replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// ── Severity helpers ──
// CSS class used by the dashboard / SLA table severity column
const SEVERITY_CLASS = {
    CRITICAL: 'sev-critical',
    HIGH:     'sev-high',
    MODERATE: 'sev-moderate',
    LOW:      'sev-low',
};

function severityClass(level) {
    return SEVERITY_CLASS[(level || 'LOW').toUpperCase()] || SEVERITY_CLASS.LOW;
}

// CSS color value (var) used by search results + ticket modal severity badge
const SEVERITY_COLOR = {
    CRITICAL: 'var(--red)',
    HIGH:     'var(--orange)',
    MODERATE: 'var(--yellow)',
    LOW:      'var(--blue)',
};

function severityColor(level) {
    return SEVERITY_COLOR[(level || 'LOW').toUpperCase()] || SEVERITY_COLOR.LOW;
}

// ── SLA resolution targets (minutes) per severity ──
const SLA_TARGET = { CRITICAL: 120, HIGH: 240, MODERATE: 480, LOW: 1440 };

function slaTargetFor(level) {
    return SLA_TARGET[(level || 'LOW').toUpperCase()] || SLA_TARGET.MODERATE;
}

// ── Status → badge CSS class ──
function statusBadgeClass(status) {
    const s = (status || 'PENDING').toUpperCase();
    return s === 'RESOLVED' ? 'badge-resolved' : s === 'BLOCKED' ? 'badge-blocked' : 'badge-pending';
}

// ── Excel export column map (DB key → human header) ──
// Shared by the dashboard and reports exports.
const REPORT_EXPORT_COLUMNS = {
    ticket_no:      'Ticket No',
    ticket_tagging: 'Ticket Tagging',
    date_issued:    'Date Issued',
    date_picked_up: 'Date Picked Up',
    date_replied:   'Date Replied',
    name:           'Customer Name',
    branch:         'Branch',
    type:           'Ticket Type',
    engagement:     ENGAGEMENT_LABEL,
    concerns:       'Client Concern',
    assistance:     'Assistance Provided',
    action:         'Action Taken',
    status:         'Status',
    channel:        'Channel',
    severity_level: 'Severity Level',
};