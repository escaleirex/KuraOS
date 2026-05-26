# Redesign da Storage App — Estilo ZimaOS

## Contexto

Refazer a aplicação de gestão de armazenamento do KuraOS para seguir o padrão visual e de UX do ZimaOS.

**Ficheiro atual:** `frontend/src/pages/storage/StoragePage.tsx` (851 linhas, componente monolítico)

---

## Análise das Screenshots ZimaOS

### Padrões Visuais Identificados

1. **Sidebar de navegação** com ícones (General, Storage, Network, Apps)
2. **Visualização de discos em formato visual** — slots numerados 1-6 + A-D para HDD/SSD
3. **Wizard step-by-step** para criar storage: Combine → Selecionar discos → Configurar
4. **Tabela comparativa de RAID levels** com métricas visuais:
   - Backup disks, Min disks, Speed (dots visuais), Capacity, Expand, Application
5. **Cards de storage pools** com barras de utilização coloridas (System/Data/Files)
6. **Design clean** — fundo branco/cinza claro, cards com bordas suaves

### Screenshots de Referência

| Screenshot | Descrição |
|---|---|
| `zima-storage-overview.png` | Visão geral com storage pools e "Create storage" banner |
| `zima-combine-raid.png` | Tabela comparativa RAID5/RAID6/RAID1/RAID0/JBOD |
| `zima-select-disks.png` | Seletor visual de discos em slots numerados |
| `zima-create-raid5.png` | Wizard de criação RAID5 com discos selecionados |
| `zima-storage-manager.png` | Storage Manager com visualização de slots HDD/SSD |

---

## Estrutura Proposta

### 1. Novo Layout Principal (`StoragePage.tsx`)

- **Sidebar esquerda** com navegação:
  - Storage Overview
  - Disks
  - Storage Pools
  - Shares
- **Área principal** com conteúdo dinâmico baseado na seleção
- Manter compatibilidade com o sistema de janelas existente (`windowStore.ts`)

### 2. Componentes a Criar (separar do monolito atual)

| Componente | Descrição |
|---|---|
| `StorageSidebar` | Navegação lateral com ícones |
| `StorageOverview` | Visão geral com storage pools e barra de utilização |
| `DiskBay` | Visualização dos discos em slots (estilo ZimaCube) |
| `DiskCard` | Card individual de disco com status e capacidade |
| `CreateStorageWizard` | Wizard multi-step para criar storage |
| `RaidLevelSelector` | Tabela comparativa de RAID levels |
| `DiskSelector` | Seletor visual de discos para RAID (slots numerados) |
| `StoragePoolCard` | Card de storage pool com breakdown System/Data/Files |
| `ShareCard` | Card de partilha de rede |

### 3. Wizard "Create Storage" (3 Steps)

#### Step 1 — Combine (RAID Level Selection)

Tabela comparativa estilo ZimaOS:

| RAID Level | Backup Disks | Min Disks | Speed | Capacity | Expand | Application |
|---|---|---|---|---|---|---|
| RAID5 (Balanced) | 1 | 3 | ●●●●○ | ≥66% | ✓ | General data storage |
| RAID6 (Stability) | 2 | 4 | ●●●○○ | ≥50% | ✓ | Large-scale enterprise data |
| RAID1 (Safe) | N-1 | 2 | ●○○○○ | ≤50% | — | Critical, small but important files |
| RAID0 (Fast) | 0 | 2 | ●●●●● | =100% | — | High-speed caching files |
| JBOD (Flexible) | 0 | 1 | Unoptimized | 100% | ✓ | Cold storage for large files |

#### Step 2 — Select Disks

- Grid visual de slots de disco (numerados 1-6 + A-D)
- Discos disponíveis mostrados com capacidade e tipo (HDD/SSD)
- Clique para selecionar/deselecionar
- Barra inferior mostrando capacidade estimada vs redundância
- Botão "Use the recommended option"

#### Step 3 — Confirm & Create

- Resumo da configuração
- Botão para criar

### 4. Alterações na API Client

Adicionar endpoints se necessário:

```typescript
export const storageApi = {
  // ... existentes
  createStoragePool: (body: object) => api.post('/storage/pools', body),
  getStorageOverview: () => api.get('/storage/overview'),
}
```

### 5. Tipos TypeScript

Criar `frontend/src/types/storage.ts`:

```typescript
// Tipos existentes (extrair do StoragePage.tsx)
export interface Disk { ... }
export interface Raid { ... }
export interface VG { ... }
export interface LV { ... }
export interface Share { ... }

// Novos tipos
export interface RaidLevelInfo {
  id: string
  label: string
  category: 'balanced' | 'stability' | 'safe' | 'fast' | 'flexible'
  backupDisks: string
  minDisks: number
  speed: number // 1-5 dots
  capacity: string
  expandable: boolean
  application: string
}

export interface StoragePool {
  name: string
  type: 'raid' | 'lvm' | 'jbod'
  totalBytes: number
  usedBytes: number
  breakdown: {
    system: number
    data: number
    files: number
  }
  status: 'healthy' | 'degraded' | 'checking' | 'error'
  devices: string[]
}

export interface DiskSlot {
  index: number | string // 1-6 or A-D
  disk?: Disk
  type: 'hdd' | 'ssd' | 'empty'
}
```

---

## Ficheiros a Modificar/Criar

### Criar

| Ficheiro | Descrição |
|---|---|
| `frontend/src/types/storage.ts` | Tipos TypeScript partilhados |
| `frontend/src/pages/storage/components/StorageSidebar.tsx` | Sidebar de navegação |
| `frontend/src/pages/storage/components/StorageOverview.tsx` | Visão geral do storage |
| `frontend/src/pages/storage/components/DiskBay.tsx` | Visualização de slots de disco |
| `frontend/src/pages/storage/components/DiskCard.tsx` | Card de disco individual |
| `frontend/src/pages/storage/components/CreateStorageWizard.tsx` | Wizard multi-step |
| `frontend/src/pages/storage/components/RaidLevelSelector.tsx` | Seletor de RAID level |
| `frontend/src/pages/storage/components/DiskSelector.tsx` | Seletor visual de discos |
| `frontend/src/pages/storage/components/StoragePoolCard.tsx` | Card de storage pool |
| `frontend/src/pages/storage/components/ShareCard.tsx` | Card de partilha |

### Modificar

| Ficheiro | Alteração |
|---|---|
| `frontend/src/pages/storage/StoragePage.tsx` | Rewrite completo — orquestrar componentes |
| `frontend/src/api/client.ts` | Adicionar novos endpoints se necessário |

---

## Design System

### Decisão: Manter Dark Theme

O KuraOS utiliza dark theme. Manter consistência com o resto do sistema:

| Elemento | Token |
|---|---|
| Background | `bg-zinc-950` / manter atual |
| Cards | `bg-white/5` com `border-white/10` |
| Acentos | `sky-500` (consistência) |
| Texto | `text-white/90`, `text-white/50` |
| Sucesso | `emerald-500` |
| Perigo | `red-500` |
| Warning | `amber-500` |

### Adaptações do ZimaOS para Dark Theme

| ZimaOS (Light) | KuraOS (Dark) |
|---|---|
| Fundo branco `#fff` | `bg-zinc-950` |
| Cards `bg-gray-50` | `bg-white/5` |
| Bordas `border-gray-200` | `border-white/10` |
| Texto `text-gray-900` | `text-white/90` |
| Texto secundário `text-gray-500` | `text-white/50` |
| RAID dots verdes | `bg-emerald-500` |
| RAID dots azuis | `bg-sky-500` |

---

## Funcionalidades a Preservar

Do ficheiro atual (`StoragePage.tsx`):

1. **Discos Físicos** — listar discos com SMART diagnostics
2. **RAID Arrays** — criar, listar, parar arrays mdadm
3. **LVM** — Volume Groups e Logical Volumes
4. **Network Shares** — Samba (SMB) e NFS

### Decisões de Integração

- **LVM** — integrar nos "Storage Pools" em vez de tab separado
- **RAID + LVM** — unificar no wizard "Create Storage"
- **SMART** — manter como painel lateral ou modal de detalhes do disco

---

## Backend — Compatibilidade

### Endpoints Atuais (`backend/internal/api/routes.go`)

| Método | Endpoint | Handler |
|---|---|---|
| GET | `/api/storage/disks` | `listDisks` |
| GET | `/api/storage/disks/{device}/smart` | `diskSmart` |
| GET | `/api/storage/raids` | `listRAID` |
| POST | `/api/storage/raids` | `createRAID` |
| DELETE | `/api/storage/raids/{device}` | `stopRAID` |
| GET | `/api/storage/vgs` | `listVGs` |
| POST | `/api/storage/vgs` | `createVG` |
| GET | `/api/storage/vgs/{vg}/lvs` | `listLVs` |
| POST | `/api/storage/vgs/{vg}/lvs` | `createLV` |
| GET | `/api/storage/shares` | `listShares` |
| POST | `/api/storage/shares` | `createShare` |
| PUT | `/api/storage/shares/{name}` | `updateShare` |
| DELETE | `/api/storage/shares/{name}` | `deleteShare` |

### Notas

- Backend suporta RAID0/1/5/6/10/JBOD (`backend/internal/storage/mdadm.go`)
- LVM operations existem mas UI atual tem stubs simulados
- Btrfs module existe no backend mas sem UI

---

## Perguntas em Aberto

1. **Manter dark theme ou mudar para light theme como ZimaOS?**
   - Recomendação: manter dark theme para consistência com KuraOS

2. **Manter LVM separado ou integrar nos Storage Pools?**
   - Recomendação: integrar nos pools, abstrair complexidade do LVM

3. **Wizard unificado para RAID+LVM?**
   - Recomendação: sim, wizard único "Create Storage" com opção de tipo

4. **Visualização de slots (1-6, A-D) — hardware específico?**
   - Recomendação: tornar configurável, detectar hardware automaticamente

---

## Ordem de Implementação Sugerida

1. Criar `types/storage.ts` — extrair e expandir tipos
2. Criar `StorageSidebar` — navegação lateral
3. Criar `StorageOverview` — visão geral com cards de pools
4. Criar `DiskBay` + `DiskCard` — visualização de discos
5. Criar `RaidLevelSelector` — tabela comparativa
6. Criar `DiskSelector` — seletor visual de discos
7. Criar `CreateStorageWizard` — orquestrar steps
8. Criar `StoragePoolCard` + `ShareCard` — cards de conteúdo
9. Rewrite `StoragePage.tsx` — integrar todos os componentes
10. Atualizar `api/client.ts` — novos endpoints se necessário
11. Testar e ajustar responsividade

---

*Documento criado em 2026-05-21*
