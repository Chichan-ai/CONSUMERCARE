// =============================================
// SUBMIT TICKET
// =============================================

// Populate the Type of Engagement dropdown from the shared constant so the
// form can never drift out of sync with charts/exports.
document.addEventListener('modulesReady', () => {
    const engagementEl = document.getElementById('engagementInput');
    if (engagementEl) {
        ENGAGEMENT_TYPES.forEach(type => {
            const opt = document.createElement('option');
            opt.textContent = type;
            opt.value = type;
            engagementEl.appendChild(opt);
        });
    }
});

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
    const attachments = Array.from(formData.getAll('attachments')).filter(file => file instanceof File && file.size > 0);
    const oversizedFile = attachments.find(file => file.size > 10 * 1024 * 1024);
    if (oversizedFile) {
        showToast(`⚠ FILE TOO LARGE: ${oversizedFile.name} (10 MB MAX)`, true);
        return;
    }

    // Dropdown values are uppercase in the form but stored Title Case to match
    // the legacy records already in the database.
    const legacyValue = value => titleCase(formData.get(value) || '');

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
            branch:         legacyValue('branch'),
            type:           legacyValue('type'),
            engagement:     legacyValue('engagement'),
            concerns:       formData.get('concerns'),
            assistance:     formData.get('assistance'),
            action:         legacyValue('action'),
            status:         formData.get('status'),
            channel:        legacyValue('channel'),
            severity_level: legacyValue('severity'),
        }]);

        if (error) throw new Error(error.message);

        let uploadedPaths = [];
        let attachmentUploadFailed = false;
        if (attachments.length > 0) {
            const ticketNo = String(formData.get('ticketNo')).replace(/[^a-zA-Z0-9_-]/g, '_');
            try {
                const uploadResults = await Promise.all(attachments.map(async file => {
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${ticketNo}/${Date.now()}-${safeName}`;
                    const { error: uploadError } = await db.storage
                        .from('ticket-attachments')
                        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
                    if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);
                    return { path, file };
                }));
                const { error: metadataError } = await db.from('ticket_attachments').insert(uploadResults.map(({ path, file }) => ({
                    ticket_no: Number(formData.get('ticketNo')),
                    storage_path: path,
                    original_name: file.name,
                    content_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                })));
                if (metadataError) throw new Error(`Attachment record: ${metadataError.message}`);
                uploadedPaths = uploadResults.map(({ path }) => path);
            } catch (uploadError) {
                attachmentUploadFailed = true;
                console.error('Attachment Upload Error:', uploadError.message);
            }
        }

        showToast(attachmentUploadFailed ? '✓ TICKET SAVED; ATTACHMENT UPLOAD FAILED' : '✓ UPLOAD COMPLETE', attachmentUploadFailed);
        const attachmentNote = uploadedPaths.length > 0 ? ` Attachments: ${uploadedPaths.join(', ')}` : '';
        writeAuditLog('TICKET_CREATED', `New ticket #${formData.get('ticketNo')} created for ${(formData.get('name')||'UNKNOWN').toUpperCase()} — Branch: ${formData.get('branch')||'N/A'}, Status: ${formData.get('status')||'PENDING'}.${attachmentNote}`);
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
