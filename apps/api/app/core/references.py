"""Insertion d'entités à référence séquentielle, robuste à la concurrence.

Les références métier (`PAY-2026-000042`, `INS-2026-…`) sont calculées par un
`count(...) + 1` par (société, année). Deux créations simultanées lisent le même
compteur et produisent la même référence : sur une table protégée par un unique
composite `(company_id, reference)`, la 2ᵉ écriture lève `IntegrityError` (→ 500),
voire un doublon sur une table sans cette contrainte.

`commit_with_reference_retry` régénère la référence et réessaie sur collision,
rendant la création idempotente vis-à-vis des courses concurrentes — sans
séquence Postgres dédiée ni migration.
"""

from collections.abc import Awaitable, Callable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def commit_with_reference_retry[T](
    db: AsyncSession,
    next_reference: Callable[[], Awaitable[str]],
    build: Callable[[str], T],
    *,
    attempts: int = 5,
) -> T:
    """Insère et commit un objet portant une `reference` unique par tenant.

    `next_reference` recalcule la prochaine référence (rappelé à chaque essai pour
    repartir du compteur à jour après rollback) ; `build` construit l'objet ORM à
    partir de la référence fournie. Sur `IntegrityError` (collision de référence
    sous concurrence), on rollback et on réessaie jusqu'à `attempts` fois ; la
    dernière erreur est propagée si toutes les tentatives échouent.
    """
    for attempt in range(attempts):
        reference = await next_reference()
        obj = build(reference)
        db.add(obj)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            if attempt == attempts - 1:
                raise
            continue
        await db.refresh(obj)
        return obj
    # Inatteignable : la boucle return ou raise toujours. Pour mypy.
    raise AssertionError("commit_with_reference_retry: boucle épuisée sans résultat")
