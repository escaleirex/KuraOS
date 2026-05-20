"""MCP Tool definitions exposed to the Axis inference engine.

Each tool calls kura-daemon's REST API. kura-daemon handles
privilege escalation to kura-helper where needed.
No tool ever calls kura-helper directly.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import httpx

from axis.core.config import settings

router = APIRouter(tags=["mcp"])


class ToolCall(BaseModel):
    tool: str
    params: dict = {}


class ToolResult(BaseModel):
    ok: bool
    data: dict | list | str | None = None
    error: str | None = None


# Registry of available tools (name → description for LLM system prompt)
TOOL_REGISTRY = {
    "disk_smart_check": "Check SMART health status of a disk. Params: device (e.g. 'sda')",
    "list_disks": "List all block devices with model, size, and transport type.",
    "list_docker_containers": "List running Docker containers.",
    "get_system_metrics": "Get current CPU, RAM, and temperature metrics.",
    "manage_firewall_rule": "Add or remove a UFW firewall rule. Params: action ('allow'|'deny'), port",
    "list_shares": "List all configured network shares (SMB, NFS).",
    "create_share": "Create a new network share. Params: name, path, protocol, read_only",
    "list_raid_arrays": "List all mdadm RAID arrays and their status.",
    "get_raid_status": "Get detailed status of a RAID array. Params: device (e.g. 'md0')",
    "list_vgs": "List all LVM volume groups.",
}


@router.get("/tools")
async def list_tools():
    """Returns the tool registry for LLM system prompt injection."""
    return TOOL_REGISTRY


@router.post("/call", response_model=ToolResult)
async def call_tool(req: ToolCall):
    handler = _handlers.get(req.tool)
    if not handler:
        return ToolResult(ok=False, error=f"Unknown tool: {req.tool}")
    return await handler(req.params)


async def _daemon_get(path: str) -> dict:
    async with httpx.AsyncClient(base_url=settings.kura_daemon_url, timeout=30) as client:
        headers = {}
        if settings.kura_daemon_token:
            headers["Authorization"] = f"Bearer {settings.kura_daemon_token}"
        resp = await client.get(path, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _daemon_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(base_url=settings.kura_daemon_url, timeout=30) as client:
        headers = {"Content-Type": "application/json"}
        if settings.kura_daemon_token:
            headers["Authorization"] = f"Bearer {settings.kura_daemon_token}"
        resp = await client.post(path, headers=headers, json=body)
        resp.raise_for_status()
        return resp.json() if resp.content else {}


async def _tool_disk_smart(params: dict) -> ToolResult:
    device = params.get("device", "")
    if not device:
        return ToolResult(ok=False, error="device param required")
    try:
        data = await _daemon_get(f"/api/storage/disks/{device}/smart")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_list_disks(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/storage/disks")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_list_docker(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/docker/containers")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_system_metrics(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/system/metrics")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_firewall(params: dict) -> ToolResult:
    action = params.get("action")
    port = params.get("port")
    if action not in ("allow", "deny") or not port:
        return ToolResult(ok=False, error="action ('allow'|'deny') and port required")
    try:
        data = await _daemon_post("/api/network/firewall/rules", {"action": action, "port": port})
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_list_shares(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/storage/shares")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_list_raids(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/storage/raids")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


async def _tool_list_vgs(params: dict) -> ToolResult:
    try:
        data = await _daemon_get("/api/storage/vgs")
        return ToolResult(ok=True, data=data)
    except Exception as e:
        return ToolResult(ok=False, error=str(e))


_handlers = {
    "disk_smart_check": _tool_disk_smart,
    "list_disks": _tool_list_disks,
    "list_docker_containers": _tool_list_docker,
    "get_system_metrics": _tool_system_metrics,
    "manage_firewall_rule": _tool_firewall,
    "list_shares": _tool_list_shares,
    "list_raid_arrays": _tool_list_raids,
    "list_vgs": _tool_list_vgs,
}
