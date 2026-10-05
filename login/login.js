// =============================================
// LOGIN
// =============================================
const LOGIN_AD_FALLBACKS = [
    {
        image_url: 'https://chichan-ai.github.io/CBAMS2.0/assets/Untitled%20design%20(10).png',
        alt_text: 'Agribank announcement 1'
    },
    {
        image_url: 'https://chichan-ai.github.io/CBAMS2.0/assets/ChatGPT%20Image%20Jul%2023,%202026,%2005_33_12%20PM.png',
        alt_text: 'Agribank announcement 2'
    },
    {
        image_url: 'https://chichan-ai.github.io/CBAMS2.0/assets/ChatGPT%20Image%20Jul%2023,%202026,%2005_24_35%20PM.png',
        alt_text: 'Agribank announcement 3'
    }
];

let loginAdIndex = 0;
let loginAdTimer = null;

function validLoginAdUrl(value) {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function renderLoginAds(ads) {
    const carousel = document.getElementById('login-ad-carousel');
    if (!carousel) return;

    clearInterval(loginAdTimer);
    carousel.replaceChildren();

    const validAds = ads.filter(ad => validLoginAdUrl(ad.image_url));
    if (validAds.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'login-ad-loading';
        emptyMessage.textContent = 'No announcements available';
        carousel.append(emptyMessage);
        return;
    }

    const slides = document.createElement('div');
    slides.className = 'login-ad-slides';

    validAds.forEach((ad, index) => {
        const slide = document.createElement('div');
        slide.className = 'login-ad-slide';
        slide.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.src = validLoginAdUrl(ad.image_url);
        image.alt = ad.alt_text || `Agribank announcement ${index + 1}`;
        image.decoding = 'async';
        image.loading = index === 0 ? 'eager' : 'lazy';

        const backdrop = document.createElement('div');
        backdrop.className = 'login-ad-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.style.backgroundImage = `url("${image.src}")`;
        slide.append(backdrop);

        const linkUrl = validLoginAdUrl(ad.link_url || '');
        if (linkUrl) {
            const link = document.createElement('a');
            link.href = linkUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.append(image);
            slide.append(link);
        } else {
            slide.append(image);
        }
        slides.append(slide);
    });
    carousel.append(slides);
    carousel._loginAdCount = validAds.length;
    loginAdIndex = 0;
    showLoginAd(0);
    if (validAds.length > 1) loginAdTimer = setInterval(() => showLoginAd(loginAdIndex + 1), 6500);
}

function showLoginAd(index) {
    const carousel = document.getElementById('login-ad-carousel');
    if (!carousel || !carousel._loginAdCount) return;
    loginAdIndex = (index + carousel._loginAdCount) % carousel._loginAdCount;
    carousel.querySelectorAll('.login-ad-slide').forEach((slide, slideIndex) => {
        const isActive = slideIndex === loginAdIndex;
        slide.classList.toggle('active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
    });
}

async function loadLoginAds() {
    const carousel = document.getElementById('login-ad-carousel');
    if (!carousel) return;

    try {
        const { data, error } = await db
            .from('login_ads')
            .select('image_url, alt_text, link_url')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        renderLoginAds(data || []);
    } catch (error) {
        console.warn('[LoginAds] Backend unavailable; using default announcements:', error.message);
        renderLoginAds(LOGIN_AD_FALLBACKS);
    }
}

document.addEventListener('modulesReady', loadLoginAds, { once: true });

async function loadLoginNotificationSummary() {
    const pendingEl = document.getElementById('login-pending-count');
    const criticalEl = document.getElementById('login-critical-count');
    if (!pendingEl || !criticalEl) return;

    const [pending, critical] = await Promise.all([
        db.from('tickets')
            .select('ticket_no', { count: 'exact', head: true })
            .eq('status', 'PENDING'),
        db.from('tickets')
            .select('ticket_no', { count: 'exact', head: true })
            .eq('severity_level', 'CRITICAL')
            .neq('status', 'RESOLVED')
    ]);

    pendingEl.textContent = pending.error ? '--' : String(pending.count ?? 0);
    criticalEl.textContent = critical.error ? '--' : String(critical.count ?? 0);
}

document.addEventListener('modulesReady', loadLoginNotificationSummary, { once: true });

async function handleLogin() {
    const user     = (document.getElementById('username').value || '').trim().toUpperCase();
    const pass     = document.getElementById('password').value || '';
    const errorMsg = document.getElementById('login-error');
    const btn      = document.getElementById('loginBtn');

    errorMsg.classList.add('hidden');

    if (!user || !pass) {
        errorMsg.innerText = 'CREDENTIALS REQUIRED';
        errorMsg.classList.remove('hidden');
        return;
    }

    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#ffffff;border-color:rgba(255,255,255,0.3);"></div> LOGGING IN...';
    btn.disabled  = true;

    try {
        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('username', user)
            .eq('password', pass)
            .eq('status', 'ACTIVE')
            .single();

        if (error || !data) throw new Error('Invalid Credentials');

        // Determine role from DB record strictly
        const dbRole       = (data.role || '').toUpperCase();
        const resolvedRole = dbRole === 'ADMIN' ? 'ADMIN' : 'ENCODER';

        // ✅ Write ALL session values to localStorage FIRST — before any access check
        localStorage.setItem('isLoggedIn',     'true');
        localStorage.setItem('loginTimestamp', Date.now());
        localStorage.setItem('username',       data.username);
        localStorage.setItem('branch',         data.branch || '');
        localStorage.setItem('userRole',       resolvedRole);
        sessionStorage.setItem('isLoggedIn',   'true');

        showDashboard();
        checkAdminAccess();   // now runs with role already in localStorage
        initializeAppData();
        setTimeout(startRealtimeSync, 800);

        // Write USER_LOGIN to Supabase (once, on actual login)
        // Only send the 3 writable columns — id and created_at are auto-generated by Supabase
        try {
            const { error: loginLogErr } = await db.from('audit_logs').insert([{
                actor:   data.username,
                action:  'USER_LOGIN',
                details: `User "${data.username}" logged in successfully (role: ${resolvedRole})`
            }]);
            if (loginLogErr) console.error('[AuditLog] USER_LOGIN write failed:', loginLogErr.message);
        } catch(e) { console.error('[AuditLog] USER_LOGIN exception:', e.message); }

        setTimeout(() => pushNotif('🔐 Logged in as ' + data.username, 'info'), 1500);

    } catch (err) {
        const msg = err.message === 'Invalid Credentials' ? 'INVALID CREDENTIALS' : 'CONNECTION ERROR — RETRY';
        errorMsg.innerText = msg;
        errorMsg.classList.remove('hidden');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> SIGN IN';
        btn.disabled  = false;
    }
}
