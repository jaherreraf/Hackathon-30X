import os

# Debe ir ANTES de importar core.database o la app para aislar los tests de blinka.db
os.environ["DATABASE_URL"] = "sqlite:///./test_blinka.db"
os.environ["EXTRACTOR"] = "stub"

import pytest

from core.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def fresh_database():
    import main  # noqa: F401 (registra modelos y routers)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from seed import seed_database

    seed_database()
    yield

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_blinka.db"):
        try:
            os.remove("test_blinka.db")
        except OSError:
            pass
