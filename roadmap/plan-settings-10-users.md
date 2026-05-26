# Phase 10: Users & Accounts

**Status**: Not started
**Complexity**: Hard
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock users
- No user management API exists
- PAM verification exists in helper ops but not user CRUD

## What to Build

### Backend (`backend/internal/api/users.go` — new file)

```go
type usersHandler struct {
    helper *helper.Client
}

// GET /api/users
// Returns: [{ username, role, email, samba, lastLogin }]
func (h *usersHandler) listUsers(w http.ResponseWriter, r *http.Request)

// POST /api/users
// Body: { username, password, role, email, samba }
func (h *usersHandler) createUser(w http.ResponseWriter, r *http.Request)

// DELETE /api/users/{username}
func (h *usersHandler) deleteUser(w http.ResponseWriter, r *http.Request)

// PUT /api/users/{username}/password
// Body: { password }
func (h *usersHandler) setPassword(w http.ResponseWriter, r *http.Request)

// PUT /api/users/{username}/role
// Body: { role: "admin" | "user" }
func (h *usersHandler) setRole(w http.ResponseWriter, r *http.Request)

// PUT /api/users/{username}/samba
// Body: { samba: bool }
func (h *usersHandler) setSamba(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/users.go` — new file)

```go
type UserCreate struct {
    Username string
    Password string  // never logged
    Role     string  // "admin" | "user"
}

type UserDelete struct {
    Username string
}

type UserSetPassword struct {
    Username string
    Password string
}

type UserSetRole struct {
    Username string
    Role     string
}

type UserSetSamba struct {
    Username string
    Enabled  bool
}

type UserLastLogin struct {
    Username string
}
```

Implementation:
- Create: `useradd -m -s /bin/bash -G <group> <username>` + `chpasswd`
- Delete: `userdel -r <username>`
- Password: `echo "user:pass" | chpasswd`
- Role: `usermod -aG sudo <username>` (admin) or `gpasswd -d <username> sudo` (user)
- Samba: `smbpasswd -a -s <username>` or `smbpasswd -x <username>`
- Last login: `lastlog -u <username>` or `last -n 1 <username>`

### Routes (`backend/internal/api/routes.go`)

```go
uh := &usersHandler{helper: helperClient}
r.Get("/api/users", uh.listUsers)
r.Post("/api/users", uh.createUser)
r.Delete("/api/users/{username}", uh.deleteUser)
r.Put("/api/users/{username}/password", uh.setPassword)
r.Put("/api/users/{username}/role", uh.setRole)
r.Put("/api/users/{username}/samba", uh.setSamba)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
usersApi: {
    list(),
    create(data),
    delete(username),
    setPassword(username, password),
    setRole(username, role),
    setSamba(username, samba),
}
```

### Frontend Panel

1. Replace mock `users` with `useQuery` + `usersApi.list()`
2. Connect "Create Account" modal to `usersApi.create()`
3. Connect delete button to `usersApi.delete()`
4. Connect Samba toggle to `usersApi.setSamba()`
5. Add password change modal
6. Add role change dropdown
7. Prevent deleting `admin` user (backend validation + frontend guard)

## Files to Create/Modify
- `backend/internal/api/users.go` (new)
- `backend/internal/helper/ops/users.go` (new)
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (UsersPanel)

## Security Considerations
- Passwords must never be logged
- Only admins can manage users (JWT role check)
- Cannot delete last admin user
- Username validation: `^[a-zA-Z0-9_\-\.]{1,64}$`
- Password strength validation

## Testing
- [ ] User list shows real system users
- [ ] Create user works (system + Samba)
- [ ] Delete user removes system account
- [ ] Samba toggle works
- [ ] Role change adds/removes from sudo group
- [ ] Cannot delete admin user
- [ ] Password validation works
