# Job-Based Sync Implementation

## Overview
Implemented a job-based sync system for points balance sync with real-time progress tracking using `jobId` pattern.

## Architecture

### Backend (Node.js/Express)

#### 1. Sync Job Service (`server/src/services/syncJobService.ts`)
- **In-memory job store** (can be migrated to DB later)
- Job lifecycle: `pending` → `running` → `completed`/`failed`/`cancelled`
- Auto-cleanup of old jobs (1 hour after completion)
- Progress tracking: `progress` (0-100%), `processed`, `total`, `stepMessage`

#### 2. API Endpoints (`server/src/routes/artly.ts`)

**POST `/artly/sync/points-balances/start`**
- Creates a sync job with unique `jobId`
- Starts async processing (non-blocking)
- Returns `jobId` immediately to frontend
- **Request body**: Array of balance objects
- **Response**: `{ success: true, jobId: string, message: string }`

**GET `/artly/sync/points-balances/status?jobId=...`**
- Returns current job status and progress
- **Response**: `{ success: true, job: { jobId, status, progress, processed, total, stepMessage, error, result, ... } }`

**POST `/artly/sync/points-balances/cancel`**
- Cancels a running job
- **Request body**: `{ jobId: string }`
- **Response**: `{ success: true, message: string, jobId: string }`

#### 3. Refactored Service (`server/src/services/artlyService.ts`)
- `processPointsBalances()` now accepts optional `jobId` parameter
- Updates job progress every 50 records
- Marks job as completed/failed on finish

### Frontend (WordPress Plugin)

#### 1. PHP Functions (`wp-content/plugins/artly-reminder-bridge/artly-reminder-bridge.php`)

**`artly_reminder_bridge_start_balance_sync()`**
- Calls `/artly/sync/points-balances/start` endpoint
- Returns jobId to JavaScript

**`artly_reminder_bridge_get_sync_status()`**
- Calls `/artly/sync/points-balances/status?jobId=...` endpoint
- Returns job status for polling

**`artly_start_sync_points()` (AJAX handler)**
- Collects all balances from WordPress
- Calls start endpoint to get jobId
- Returns jobId to frontend

**`artly_get_sync_job_status()` (AJAX handler)**
- Proxies status requests to backend
- Maps backend job format to frontend format

#### 2. JavaScript (`wp-content/plugins/artly-reminder-bridge/artly-reminder-bridge.php`)

**Flow:**
1. User clicks "Sync Points Balances"
2. Frontend calls `artly_start_sync_points` → gets `jobId`
3. Stores `jobId` in `currentJobId` variable
4. Starts polling `artly_get_sync_job_status` every 1.5 seconds
5. Updates UI with real-time progress
6. Stops polling when status is `completed`, `failed`, or `cancelled`

**Progress Display:**
- Shows: `processed / total` users, `updated` balances, `progress %`
- Updates: Progress bar, percentage, status message
- States: `pending`, `running`, `completed`, `failed`, `cancelled`

## Key Features

✅ **Decoupled sync**: Frontend doesn't wait for sync completion  
✅ **Real-time progress**: Updates every 1.5 seconds  
✅ **Job tracking**: Each sync has unique `jobId`  
✅ **Cancellation support**: Can cancel running jobs  
✅ **Error handling**: Proper error states and messages  
✅ **Backward compatible**: Legacy endpoint still works  

## Data Flow

```
WordPress UI
    ↓ (click sync)
WordPress AJAX Handler
    ↓ (collect balances)
Backend API /start
    ↓ (create job, return jobId)
WordPress JavaScript
    ↓ (store jobId, start polling)
Backend API /status
    ↓ (poll every 1.5s)
Backend Sync Worker
    ↓ (update job progress every 50 records)
WordPress UI
    ↓ (display live progress)
```

## Job Status States

- **pending**: Job created, not started yet
- **running**: Sync in progress
- **completed**: Sync finished successfully
- **failed**: Sync failed with error
- **cancelled**: User cancelled the sync

## Future Enhancements

1. **Database storage**: Migrate job store from in-memory to DB table
2. **Job history**: Keep completed jobs for audit trail
3. **Retry logic**: Auto-retry failed jobs
4. **WebSocket support**: Real-time updates without polling
5. **Batch processing**: Process multiple job types in queue

## Testing

To test the implementation:

1. Click "Sync Points Balances" in WordPress admin
2. Observe progress bar updating in real-time
3. Check browser console for polling requests
4. Verify backend logs show job creation and progress updates
5. Test cancellation by clicking "Cancel Sync" during sync

## Files Modified

- `server/src/services/syncJobService.ts` (NEW)
- `server/src/services/artlyService.ts` (MODIFIED)
- `server/src/routes/artly.ts` (MODIFIED)
- `wp-content/plugins/artly-reminder-bridge/artly-reminder-bridge.php` (MODIFIED)

