import atexit
import os
import shutil
import tempfile

# Isolation from the real database: this MUST run before any `app.*` import,
# because app.core.database builds its engine from settings.DATABASE_URL at import
# time and the app lifespan (create_all + migrations + seeding) runs against it.
# Environment variables take precedence over `.env` in pydantic-settings, so
# forcing the variable here also overrides a real URL set in `.env` or the shell.
_TEST_DB_DIR = tempfile.mkdtemp(prefix="menu-design-tests-")
atexit.register(shutil.rmtree, _TEST_DB_DIR, ignore_errors=True)
_TEST_DB_URL = f"sqlite:///{os.path.join(_TEST_DB_DIR, 'lifespan.db')}"
os.environ["DATABASE_URL"] = _TEST_DB_URL

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, engine as app_engine, get_db
from app.main import app
from app.services.seed_defaults import seed_system_lookups

# Safety net: never run the suite if the app engine is not the throwaway test DB.
assert str(app_engine.url) == _TEST_DB_URL, (
    "Test isolation failed: app engine points to a non-test database"
)

# Use in-memory SQLite for fast, isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    seed_system_lookups(session)
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Helper fixture to create a test household and return auth headers."""
    register_payload = {
        "name": "Famiglia Rossi",
        "email": "rossi@example.com",
        "password": "Password123!"
    }
    res = client.post("/api/v1/auth/register", json=register_payload)
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
