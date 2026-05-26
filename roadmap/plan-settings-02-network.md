# Phase 2: Network Settings

**Status**: Not started
**Complexity**: Hard
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses mock data for Wi-Fi networks and Ethernet interfaces
- Ethernet config form has no backend connection
- Wi-Fi scan/connect not implemented

## What to Build

### Backend (`backend/internal/api/network.go` — new file)

```go
type networkHandler struct {
    helper *helper.Client  // IPC to kura-helper
}

// GET /api/network/interfaces
// Returns: { wifi: { enabled, adapter, networks[] }, eth: [{ name, speed, status, config }] }
func (h *networkHandler) getInterfaces(w http.ResponseWriter, r *http.Request)

// PUT /api/network/wifi
// Body: { enabled: bool }
func (h *networkHandler) setWifi(w http.ResponseWriter, r *http.Request)

// POST /api/network/wifi/scan
// Returns: [{ ssid, signal, secured, connected }]
func (h *networkHandler) scanWifi(w http.ResponseWriter, r *http.Request)

// POST /api/network/wifi/connect
// Body: { ssid, password? }
func (h *networkHandler) connectWifi(w http.ResponseWriter, r *http.Request)

// GET /api/network/eth/{iface}
// Returns: { mode, ip, subnet, gateway, dns1, dns2 }
func (h *networkHandler) getEthConfig(w http.ResponseWriter, r *http.Request)

// PUT /api/network/eth/{iface}
// Body: { mode: "dhcp"|"static", ip, subnet, gateway, dns1, dns2 }
func (h *networkHandler) setEthConfig(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/network.go` — extend existing)

```go
// Existing: UFWAllow, UFWDeny, TailscaleUp, TailscaleDown

// New ops to add:
type WifiSetEnabled struct { Enabled bool }
type WifiScan struct {}
type WifiConnect struct { SSID, Password string }
type EthSetConfig struct { Iface, Mode, IP, Subnet, Gateway, DNS1, DNS2 string }
type EthGetConfig struct { Iface string }
```

Implementation uses `nmcli` or `netplan` (prefer `nmcli` for NetworkManager-based systems):
- `nmcli radio wifi on/off`
- `nmcli device wifi list`
- `nmcli device wifi connect <ssid> password <pass>`
- `nmcli connection modify <iface> ipv4.method manual/auto ipv4.addresses ...`
- `nmcli connection up <iface>`

### Routes (`backend/internal/api/routes.go`)

```go
nh := &networkHandler{helper: helperClient}
r.Get("/api/network/interfaces", nh.getInterfaces)
r.Put("/api/network/wifi", nh.setWifi)
r.Post("/api/network/wifi/scan", nh.scanWifi)
r.Post("/api/network/wifi/connect", nh.connectWifi)
r.Get("/api/network/eth/{iface}", nh.getEthConfig)
r.Put("/api/network/eth/{iface}", nh.setEthConfig)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
networkApi: {
    getInterfaces(),
    setWifi(enabled),
    scanWifi(),
    connectWifi(ssid, password?),
    getEthConfig(iface),
    setEthConfig(iface, config),
}
```

### Frontend Panel

1. Replace mock `wifiNets` with `useQuery` + `scanWifi`
2. Replace mock `ethIfaces` with `useQuery` + `getInterfaces`
3. Connect Wi-Fi toggle to `setWifi`
4. Connect "Connect" button to `connectWifi`
5. Connect Ethernet config form to `getEthConfig`/`setEthConfig`
6. Add auto-refresh for Wi-Fi scan (every 10s when tab open)

## Files to Create/Modify
- `backend/internal/api/network.go` (new)
- `backend/internal/helper/ops/network.go` (extend)
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (NetworkPanel)

## Security Considerations
- Wi-Fi passwords must never be logged
- Network config changes should be validated (IP format, CIDR, etc.)
- Only allow modifying real interfaces (validate against `ip link`)

## Testing
- [ ] Wi-Fi toggle enables/disables radio
- [ ] Scan returns real networks
- [ ] Connect works with correct password
- [ ] Ethernet static IP applies and persists
- [ ] DHCP switch works
- [ ] DNS changes apply
