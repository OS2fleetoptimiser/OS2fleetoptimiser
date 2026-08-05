"""
Migration entrypoint. Run by the migrate service on every deploy:

    python -m fleetmanager.data_access.migrate

The baseline migration is idempotent, so databases created by the pre-Alembic
`create_all` go through the same chain as empty ones - no adoption step needed.
"""
import logging
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from .db_engine import build_dsn, create_defaults

logger = logging.getLogger("fleetmanager.migrate")
logger.setLevel(logging.INFO)

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

KNOWN_STALE_REVISIONS = {"5f8e029896e3"}  # ad hoc-oprydningens levn, verificeret aug. 2026


def resolve_stamped_revision(engine, our_revisions) -> str | None:
    """
    Returns the stamped revision if it belongs to our migration chain,
    or None if the database is unstamped. Deletes known stale stamps.
    Exits with an error on unknown revisions - a human must look at those.
    """
    if not sa.inspect(engine).has_table("alembic_version"):
        return None
    with engine.begin() as conn:
        versions = conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalars().all()
        if len(versions) == 0:
            return None
        if len(versions) > 1:
            sys.exit(
                f"alembic_version holds several revisions {versions} - refusing to"
                " touch this database."
            )
        version = versions[0]
        if version in our_revisions:
            return version
        if version in KNOWN_STALE_REVISIONS:
            logger.info("Deleting known stale alembic_version stamp '%s'", version)
            conn.execute(sa.text("DELETE FROM alembic_version"))
            return None
    sys.exit(
        f"Unknown alembic_version '{version}' - refusing to touch this database."
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    dsn = build_dsn()
    if dsn is None:
        sys.exit("DB_* environment variables are not set - refusing to run.")

    config = Config(str(ALEMBIC_INI))
    script = ScriptDirectory.from_config(config)
    our_revisions = {rev.revision for rev in script.walk_revisions()}
    engine = sa.create_engine(dsn)

    resolve_stamped_revision(engine, our_revisions)

    command.upgrade(config, "head")
    create_defaults(engine)
    logger.info("Database is at head.")


if __name__ == "__main__":
    main()
