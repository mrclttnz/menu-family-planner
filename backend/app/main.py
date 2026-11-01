from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.migrations import run_auto_migrations
from app.routers import auth, members, taxonomies, dishes, calendar, attendance
from app.services.seed_defaults import seed_system_lookups


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (safe for SQLite/dev)
    Base.metadata.create_all(bind=engine)
    run_auto_migrations(engine)
    
    # Seed default system master lookups
    db = SessionLocal()
    try:
        seed_system_lookups(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Menu Design API",
    description="Family meal planning and dish management backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    return response


# Include Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(taxonomies.router, prefix="/api/v1")
app.include_router(dishes.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Menu Design API", "version": "1.0.0"}


# Serve Frontend SPA if built
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        # Don't intercept API or docs routes
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return Response(status_code=404)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return Response(status_code=404)

