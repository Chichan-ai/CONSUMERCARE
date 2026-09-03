# AGRIBANK PAY KIOSK - NEW FEATURES SUMMARY

## Changes Implemented

### 1. **Terminal Status Tab - ADD KIOSK Button**
- **Location**: `kiosk/kiosk.js` - `switchKioskTab()` function
- **Action**: When "TERMINAL STATUS" tab is active, an "ADD KIOSK" button appears in the action bar
- **Function**: Opens the "Add Kiosk" modal

### 2. **Kiosk Table - Action Buttons**
- **Location**: `kiosk/kiosk.html` & `kiosk/kiosk.js` - `loadKioskData()` function
- **Changes**:
  - Added "Actions" column header to the kiosk table
  - Each kiosk row now has two action buttons:
    - **STATUS**: Opens the "Change Status" modal
    - **EDIT**: Opens the "Edit Kiosk" modal for updating kiosk details

### 3. **Add/Edit Kiosk Modal**
- **Location**: `kiosk/kiosk-modals.html`
- **Modal ID**: `add-kiosk-modal`
- **Features**:
  - Terminal ID (required)
  - Location (required)
  - Address (required)
  - Go Live Date (required)
  - Operating Hours (required)
  - Kiosk Threshold (optional, in PHP currency)
  - **Kiosk Tag Radio Buttons** (required):
    - **NEW**: For newly installed kiosks
    - **RELOCATION**: For kiosks that have been relocated
  - Submit button to save/update kiosk
  - Cancel button to close modal

### 4. **Change Status Modal**
- **Location**: `kiosk/kiosk-modals.html`
- **Modal ID**: `change-status-modal`
- **Features**:
  - Displays Terminal ID and Location (read-only)
  - **Status Options** (radio buttons):
    - **ACTIVE**: Kiosk is operating normally (blue)
    - **PULL OUT**: Kiosk has been removed (orange)
    - **RELOCATED**: Kiosk has been moved to a different location (blue)
    - **DAMAGED**: Kiosk is damaged and non-functional (red)
  - Remarks/Notes textarea (optional) for additional context
  - Submit button to update status
  - Cancel button to close modal

### 5. **JavaScript Functions Added**
- **`openAddKioskModal(editId = null)`**: Opens add/edit kiosk modal
- **`closeAddKioskModal()`**: Closes add kiosk modal
- **`openEditKioskModal(kioskId)`**: Opens edit modal for specific kiosk
- **`submitKioskForm(e)`**: Handles form submission for adding/updating kiosks
- **`openChangeStatusModal(kioskId, terminalId, location)`**: Opens status change modal
- **`closeChangeStatusModal()`**: Closes status change modal
- **`submitChangeStatusForm(e)`**: Handles status change form submission

### 6. **Database Operations**
All new features integrate with Supabase:
- **Add Kiosk**: Inserts new record into `kiosks` table with tag information
- **Edit Kiosk**: Updates existing kiosk record with all fields
- **Change Status**: Updates only the status field with optional remarks and timestamp
- **Audit Logging**: All operations are logged through `writeAuditLog()` function

## Field Specifications

### Kiosk Table Schema
```
- id: unique identifier
- terminal_id: Terminal number (e.g., T-001)
- location: Location name (e.g., SM PASIG)
- address: Full address
- go_live: Date when kiosk went live
- hours: Operating hours (e.g., 10AM-10PM)
- kiosk_threshold: Threshold amount in PHP (optional)
- tag: NEW or RELOCATION
- status: ACTIVE, PULL OUT, RELOCATED, or DAMAGED
- status_remarks: Optional notes on status change
- status_change_date: Timestamp of last status change
```

## User Experience Flow

### Adding a New Kiosk:
1. Click "ADD KIOSK" button in Terminal Status tab
2. Fill in required fields (Terminal ID, Location, Address, Go Live Date, Hours)
3. Optional: Enter Kiosk Threshold amount
4. Select tag: NEW or RELOCATION
5. Click "SAVE KIOSK"

### Editing Existing Kiosk:
1. Click "EDIT" button in the kiosk row
2. Modal opens with existing kiosk data
3. Modify any fields
4. Click "UPDATE KIOSK"

### Changing Kiosk Status:
1. Click "STATUS" button in the kiosk row
2. Terminal ID and Location are displayed (read-only)
3. Select new status from radio buttons
4. Optional: Add remarks about the status change
5. Click "UPDATE STATUS"

## Color Coding
- **NEW Tag**: Teal (#00A86B)
- **RELOCATION Tag**: Orange (#FF9500)
- **ACTIVE Status**: Teal (#00A86B)
- **PULL OUT Status**: Orange (#FF9500)
- **RELOCATED Status**: Blue (#2E5FFF)
- **DAMAGED Status**: Red (#FF4444)

## Notes
- All required fields are marked with red asterisk (*)
- Forms validate before submission
- Success/error messages displayed as toasts
- Audit logs track all changes for compliance
- Table is responsive with action buttons in dedicated column
