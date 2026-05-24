from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def create_db_pool() -> None:
    async with engine.begin():
        pass


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session
