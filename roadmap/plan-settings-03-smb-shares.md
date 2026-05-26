# Phase 3: SMB Shares

**Status**: Partial — backend has 501 endpoints
**Complexity**: Medium
**Scope**: Fix backend + connect frontend

## Current State
- Backend: `GET/POST /api/storage/shares` work; `PUT/DELETE` return 501
- Frontend: Uses local state with mock data
- Storage module `shares.go` has `ApplySMBConfig` which writes config and reloads smbd

## What to Build

### Backend (`backend/internal/api/storage.go`)

Fix the two 501 handlers:

```go
// PUT /api/storage/shares/{name}
// Body: { comment, writable, guest, browseable }
func (h *storageHandler) updateShare(w http.ResponseWriter, r *http.Request) {
    // 1. Load current shares from config
    // 2. Find share by name
    // 3. Update fields
    // 4. Call ApplySMBConfig(ctx, updatedShares)
    // 5. Return updated share
}

// DELETE /api/storage/shares/{name}
func (h *storageHandler) deleteShare(w http.ResponseWriter, r *http.Request) {
    // 1. Load current shares from config
    // 2. Remove share by name
    // 3. Call ApplySMBConfig(ctx, remainingShares)
    // 4. Optionally remove directory (via helper)
}
```

Need a config store to persist share definitions:
```go
const sharesKey = "storage:shares"
// Store []ShareConfig in SQLite
```

### API Client (`frontend/src/api/client.ts`)

Add missing methods:

```typescript
storageApi: {
    // ...existing
    updateShare(name, body)  // PUT /storage/shares/{name}
    deleteShare(name)        // DELETE /storage/shares/{name}
}
```

### Frontend Panel

1. Replace mock `shares` state with `useQuery({ queryKey: ['shares'], queryFn: storageApi.listShares })`
2. Connect "Nova Partilha" button to `storageApi.createShare` + invalidate query
3. Connect edit button to `storageApi.updateShare` + invalidate query
4. Connect delete button to `storageApi.deleteShare` + invalidate query
5. Add optimistic updates for better UX

## Files to Modify
- `backend/internal/api/storage.go` (fix 2 handlers)
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (SmbPanel)

## Testing
- [ ] Create share → appears in list, smb.conf updated
- [ ] Edit share → changes persist, smbd reloaded
- [ ] Delete share → removed from list, smb.conf updated
- [ ] Global Samba config displays correctly
- [ ] Guest/read-only badges render correctly
