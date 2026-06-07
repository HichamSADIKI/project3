# Skill : multi-tenant-guard
# Isolation Multi-Tenant — RLS & company_id Enforcement

## Quand charger ce skill

- Création d'une nouvelle table métier
- Écriture ou révision d'un endpoint FastAPI
- Audit d'un module existant (`/project:check-tenant`)
- Debug d'une fuite de données inter-tenant

---

## Loi fondamentale

Toute table métier possède `company_id UUID NOT NULL`.
Toute requête filtre sur `company_id`.
Le RLS PostgreSQL est la dernière ligne de défense.

Tables exemptées (globales) : `companies` · `users` · `audit_logs` · `countries`

---

## Migration obligatoire après chaque CREATE TABLE métier

```sql
-- 1. Activer RLS
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

-- 2. Politique d'isolation
CREATE POLICY tenant_isolation ON {table}
  USING (company_id = current_setting('app.current_company_id')::UUID);

-- 3. Index performance
CREATE INDEX idx_{table}_company ON {table}(company_id);

-- 4. Soft delete index (si applicable)
CREATE INDEX idx_{table}_company_active
  ON {table}(company_id) WHERE deleted_at IS NULL;
```

---

## Middleware FastAPI — Injection company_id

```python
# app/middleware/tenant.py
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.auth import decode_jwt

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if token:
            payload = decode_jwt(token)
            company_id = payload.get("company_id")
            if company_id:
                request.state.company_id = company_id
        return await call_next(request)
```

```python
# app/core/deps.py
from fastapi import Depends, Request, HTTPException

async def get_company_id(request: Request) -> str:
    company_id = getattr(request.state, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=401, detail="tenant_required")
    return company_id

async def get_db_session(
    db: AsyncSession = Depends(get_db),
    company_id: str = Depends(get_company_id),
):
    await db.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": company_id},
    )
    yield db
```

---

## Pattern service — toujours filtrer company_id

```python
# app/routers/{module}/service.py
from sqlalchemy import select
from app.models import MyModel

async def list_items(db: AsyncSession, company_id: str, page: int, limit: int):
    stmt = (
        select(MyModel)
        .where(MyModel.company_id == company_id)
        .where(MyModel.deleted_at.is_(None))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_item(db: AsyncSession, company_id: str, item_id: str):
    stmt = (
        select(MyModel)
        .where(MyModel.id == item_id)
        .where(MyModel.company_id == company_id)  # ← JAMAIS omettre
        .where(MyModel.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404)
    return item
```

---

## Checklist d'audit `/project:check-tenant`

Pour chaque table métier, vérifier :

```sql
-- 1. Colonne company_id présente ?
SELECT column_name FROM information_schema.columns
WHERE table_name = '{table}' AND column_name = 'company_id';

-- 2. RLS activé ?
SELECT relrowsecurity FROM pg_class WHERE relname = '{table}';

-- 3. Politique existante ?
SELECT policyname FROM pg_policies WHERE tablename = '{table}';

-- 4. Index présent ?
SELECT indexname FROM pg_indexes
WHERE tablename = '{table}' AND indexname LIKE '%company%';
```

Pour chaque endpoint, vérifier :
- [ ] `company_id: str = Depends(get_company_id)` dans la signature
- [ ] Filtre `company_id` dans chaque `SELECT`
- [ ] Filtre `company_id` dans chaque `UPDATE`
- [ ] Soft delete (`deleted_at = now()`) au lieu de `DELETE`
- [ ] Pas de boucle avec requêtes individuelles (N+1)

---

## Anti-patterns à refuser systématiquement

```python
# ❌ SELECT sans company_id
result = await db.execute(select(Property))

# ❌ Confiance aveugle sur l'ID fourni par le client
item = await db.get(Contract, request_body.contract_id)
# → un tenant peut accéder aux données d'un autre

# ❌ UPDATE sans filtre tenant
await db.execute(
    update(Prospect).where(Prospect.id == prospect_id)
)

# ❌ DELETE physique
await db.delete(item)
```

```python
# ✅ Toujours filtrer
result = await db.execute(
    select(Property)
    .where(Property.company_id == company_id)
    .where(Property.deleted_at.is_(None))
)

# ✅ Soft delete
item.deleted_at = datetime.utcnow()
await db.commit()
```

---

## Test isolation multi-tenant

```python
# tests/conftest.py
@pytest.fixture
async def tenant_a_db(db_session):
    await db_session.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": "company-a-uuid"},
    )
    return db_session

@pytest.fixture
async def tenant_b_db(db_session):
    await db_session.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": "company-b-uuid"},
    )
    return db_session

# Test d'isolation
async def test_tenant_isolation(tenant_a_db, tenant_b_db):
    # Créer une propriété pour tenant A
    prop = Property(company_id="company-a-uuid", title_en="Villa A")
    tenant_a_db.add(prop)
    await tenant_a_db.commit()

    # Vérifier que tenant B ne la voit pas
    result = await tenant_b_db.execute(select(Property))
    assert len(result.scalars().all()) == 0
```
