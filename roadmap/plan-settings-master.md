# Settings Implementation — Master Plan

## Overview
The Settings app has **17 panels**, all currently using **mock/local state**. This plan breaks implementation into **phases** that can be done incrementally. Each phase produces working functionality independently.

## Architecture Pattern
- **Backend**: Go handlers in `backend/internal/api/` + config store (SQLite at `/var/lib/kura/config.db`)
- **Privileged ops**: `kura-helper` via Unix socket JSON-RPC (root, Linux capabilities)
- **Frontend**: React panels in `frontend/src/pages/settings/SettingsPage.tsx` + API client in `frontend/src/api/client.ts`

## Existing Backend Support
| Panel | Backend Status | Notes |
|-------|---------------|-------|
| About | ✅ Done | `GET /api/system/resources` returns CPU/mem/GPU/disk |
| SMB Shares | ⚠️ Partial | `GET/POST /api/storage/shares` exist; `updateShare`/`deleteShare` return 501 |
| Apps & Services | ⚠️ Partial | App store endpoints exist but no generic systemd service management |
| Axis AI | ⚠️ Partial | `axisApi` exists but bypasses daemon; no inference mode config endpoint |
| Security (2FA) | ⚠️ Partial | `POST /api/auth/totp/verify` exists but no enable/disable endpoint |
| All others | ❌ Not started | No endpoints exist |

## Phase Breakdown

| Phase | File | Panels | Complexity |
|-------|------|--------|------------|
| 1 | `plan-settings-01-appearance.md` | Appearance | Easy — frontend-only + config store |
| 2 | `plan-settings-02-network.md` | Network | Hard — helper ops, nmcli, netplan |
| 3 | `plan-settings-03-smb-shares.md` | SMB Shares | Medium — fix 501 endpoints, connect frontend |
| 4 | `plan-settings-04-online-accounts.md` | Online Accounts | Medium — new storage module |
| 5 | `plan-settings-05-power.md` | Power | Medium — systemd, hdparm, ethtool |
| 6 | `plan-settings-06-apps-services.md` | Apps & Services | Medium — systemd service manager |
| 7 | `plan-settings-07-search.md` | Search | Easy — connect to existing Axis API |
| 8 | `plan-settings-08-notifications.md` | Notifications | Medium — event system |
| 9 | `plan-settings-09-axis-ai.md` | Axis AI | Medium — inference config, Ollama API |
| 10 | `plan-settings-10-users.md` | Users | Hard — PAM, user management, Samba |
| 11 | `plan-settings-11-security.md` | Security | Medium — TOTP enable/disable |
| 12 | `plan-settings-12-ssh.md` | SSH Access | Easy-Medium — sshd config |
| 13 | `plan-settings-13-region-lang.md` | Region & Language | Easy — locale config |
| 14 | `plan-settings-14-datetime.md` | Date & Time | Easy — timedatectl, NTP |
| 15 | `plan-settings-15-remote-desktop.md` | Remote Desktop | Medium — VNC/RDP setup |
| 16 | `plan-settings-16-updates.md` | Updates | Medium — apt, version check |

## Implementation Order for Each Phase
1. **Backend**: Add handler + routes + config store keys
2. **Helper ops** (if privileged): Add to `helper/ops/` + whitelist
3. **API client**: Add methods to `frontend/src/api/client.ts`
4. **Frontend panel**: Replace mock state with `useQuery`/`useMutation`
5. **Test**: Verify end-to-end

## Config Store Key Convention
```
settings:{panel}:{field}
e.g. settings:appearance:theme, settings:network:eth:eth0:mode
```
