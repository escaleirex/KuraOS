from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from axis.core.config import settings
from axis.core.router import router as inference_router
from axis.mcp.tools import router as mcp_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: detect hardware capabilities
    from axis.inference.hardware_detect import detect_and_cache
    await detect_and_cache()
    yield
    # Shutdown: clean up resources if needed


app = FastAPI(
    title="Axis Engine",
    version="0.1.0",
    description="KuraOS AI engine — local inference + cloud fallback",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inference_router, prefix="/axis")
app.include_router(mcp_router, prefix="/axis/mcp")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
