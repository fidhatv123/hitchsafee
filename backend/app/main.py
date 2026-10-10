import os
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routers import auth, spots, trips, simulator, guidance, experiences

app = FastAPI(
    title="HitchSafe API",
    description="Safety and Intelligence Platform for Hitchhikers - Hackathon MVP",
    version="1.0.0"
)

# Enable CORS for web client and live tracking page
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(spots.router, prefix=settings.API_PREFIX)
app.include_router(trips.router, prefix=settings.API_PREFIX)
app.include_router(simulator.router, prefix=settings.API_PREFIX)
app.include_router(guidance.router, prefix=settings.API_PREFIX)
app.include_router(experiences.router, prefix=settings.API_PREFIX)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "db": "CONNECTED",
        "offline_queue_active": True
    }

# Frontend SPA Static Assets Mount
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        # Don't intercept API routes or Docs
        if full_path.startswith("api/") or full_path in ["docs", "openapi.json", "redoc"]:
            return {"error": "Not Found"}
        target_file = os.path.join(frontend_dist, full_path)
        if os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        # SPA index.html fallback for client-side routing
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"app": "HitchSafe", "status": "ONLINE"}
else:
    @app.get("/")
    def root():
        return {
            "app": "HitchSafe API",
            "version": "1.0.0",
            "status": "ONLINE",
            "docs": "/docs",
            "disclaimer": "HitchSafe is a safety risk-reduction aid and cannot guarantee safety."
        }
