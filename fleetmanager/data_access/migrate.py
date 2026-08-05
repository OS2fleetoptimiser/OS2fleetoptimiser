"""
Adoption + migration entrypoint. Run by the migrate service on every deploy:

    python -m fleetmanager.data_access.migrate

Adopts pre-Alembic customer databases (repair + stamp) and upgrades to head.
"""
import logging
import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory

from .db_engine import build_dsn, create_defaults
from .dbschema import Base

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
        version = conn.execute(
            sa.text("SELECT version_num FROM alembic_version")
        ).scalar()
        if version is None:
            return None
        if version in our_revisions:
            return version
        if version in KNOWN_STALE_REVISIONS:
            logger.info("Deleting known stale alembic_version stamp '%s'", version)
            conn.execute(sa.text("DELETE FROM alembic_version"))
            return None
    sys.exit(
        f"Unknown alembic_version '{version}' - refusing to touch this database."
    )


def repair(engine) -> None:
    """Create missing tables and add missing columns on a pre-Alembic database."""
    Base.metadata.create_all(engine, checkfirst=True)

    insp = sa.inspect(engine)
    with engine.begin() as conn:
        ops = Operations(MigrationContext.configure(conn))
        for table in Base.metadata.sorted_tables:
            existing = {col["name"] for col in insp.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                logger.info("Adding missing column %s.%s", table.name, column.name)
                ops.add_column(
                    table.name,
                    sa.Column(column.name, column.type, nullable=True),
                )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    dsn = build_dsn()
    if dsn is None:
        sys.exit("DB_* environment variables are not set - refusing to run.")

    config = Config(str(ALEMBIC_INI))
    script = ScriptDirectory.from_config(config)
    our_revisions = {rev.revision for rev in script.walk_revisions()}
    baseline = script.get_bases()[0]
    engine = sa.create_engine(dsn)

    stamped = resolve_stamped_revision(engine, our_revisions)
    if stamped is None and sa.inspect(engine).has_table("cars"):
        logger.info("Existing unstamped database - adopting (repair + stamp)")
        repair(engine)
        command.stamp(config, baseline)

    command.upgrade(config, "head")
    create_defaults(engine)
    logger.info("Database is at head.")


if __name__ == "__main__":
    main()