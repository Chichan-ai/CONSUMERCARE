// =============================================
// SUBMIT TICKET
// =============================================
async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn  = document.getElementById('submitBtn');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('input-error');
            isValid = false;
        } else {
            field.classList.remove('input-error');
        }
        const eventType = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventType, function () {
            if (this.value.trim()) this.classList.remove('input-error');
        }, { once: true });
    });

    if (!isValid) { showToast('⚠ FILL ALL REQUIRED FIELDS', true); return; }

    const formData = new FormData(form);
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#040c0a;border-color:rgba(4,12,10,0.2);"></div> TRANSMITTING...';
    btn.disabled  = true;

    try {
        const { error } = await db.from('tickets').insert([{
            ticket_no:      formData.get('ticketNo'),
            ticket_tagging: formData.get('ticketTagging'),
            date_issued:    formData.get('dateIssued')   || null,
            date_picked_up: formData.get('datePickedUp') || null,
            date_replied:   formData.get('dateReplied')  || null,
            name:           (formData.get('name') || '').toUpperCase(),
            branch:         formData.get('branch'),
            type:           formData.get('type'),
            engagement:     formData.get('engagement'),
            concerns:       formData.get('concerns'),
            assistance:     formData.get('assistance'),
            action:         formData.get('action'),
            status:         formData.get('status'),
            channel:        formData.get('channel'),
            severity_level: formData.get('severity'),
        }]);

        if (error) throw new Error(error.message);

        showToast('✓ UPLOAD COMPLETE');
        logAudit('TICKET_CREATED', `New ticket submitted via form`, 'ticket');
        writeAuditLog('TICKET_CREATED', `New ticket #${formData.get('ticketNo')} created for ${(formData.get('name')||'UNKNOWN').toUpperCase()} — Branch: ${formData.get('branch')||'N/A'}, Status: ${formData.get('status')||'PENDING'}`);
        pushNotif('✓ New ticket uploaded successfully', 'info');
        form.reset();
        updateDateInput();
        loadData();

    } catch (err) {
        showToast('✗ UPLOAD FAILED', true);
        console.error('Submit Error:', err.message);
    } finally {
        btn.innerHTML = 'UPLOAD TICKET';
        btn.disabled  = false;
    }
}

// =============================================
// UTILITIES
// =============================================
function updateDateInput() {
    const el = document.getElementById('dateIssuedInput');
    if (el) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        el.value = now.toISOString().slice(0, 16);
    }
}
