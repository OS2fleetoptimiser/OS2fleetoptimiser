"""baseline

Revision ID: 99445ea7335e
Revises:
Create Date: 2026-08-05 07:49:20.819779

Idempotent by design. This migration is the entry point both for empty databases
and for the databases that were created by the pre-Alembic `create_all`, which may
be missing tables and columns added over the years. Anything that already exists is
left untouched, so a legacy database ends up at the baseline schema and the later
migrations can take it from there.

The schema below is frozen at this revision. It must never be updated to follow
`dbschema.py` - later changes belong in later migrations.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '99445ea7335e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


metadata = sa.MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)

sa.Table(
    "allowed_starts",
    metadata,
    sa.Column("address", sa.String(length=128), nullable=True),
    sa.Column("latitude", sa.Float(), nullable=True),
    sa.Column("longitude", sa.Float(), nullable=True),
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("addition_date", sa.DateTime(), nullable=True),
)

sa.Table(
    "fuel_types",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("name", sa.String(length=128), nullable=False),
    sa.Column("refers_to", sa.Integer(), nullable=True),
)

sa.Table(
    "leasing_types",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("name", sa.String(length=128), nullable=False),
)

sa.Table(
    "simulation_settings",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("name", sa.String(length=128), nullable=False),
    sa.Column("value", sa.String(length=500), nullable=False),
    sa.Column("type", sa.String(length=128), nullable=False),
)

sa.Table(
    "user_login",
    metadata,
    sa.Column("user_id", sa.String(length=128), primary_key=True, nullable=False),
    sa.Column("last_seen_date", sa.DateTime(), nullable=False),
)

sa.Table(
    "vehicle_types",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("name", sa.String(length=128), nullable=False),
    sa.Column("refers_to", sa.Integer(), nullable=True),
)

sa.Table(
    "workshops",
    metadata,
    sa.Column("name", sa.String(length=128), nullable=True),
    sa.Column("address", sa.String(length=128), nullable=True),
    sa.Column("latitude", sa.Float(), nullable=True),
    sa.Column("longitude", sa.Float(), nullable=True),
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("addition_date", sa.DateTime(), nullable=True),
)

sa.Table(
    "allowed_start_additions",
    metadata,
    sa.Column("latitude", sa.Float(), nullable=False),
    sa.Column("longitude", sa.Float(), nullable=False),
    sa.Column(
        "allowed_start_id",
        sa.Integer(),
        sa.ForeignKey("allowed_starts.id"),
        nullable=False,
        index=True,
    ),
    sa.Column("addition_date", sa.DateTime(), nullable=False),
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
)

sa.Table(
    "cars",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
    sa.Column("external_id", sa.String(length=64), nullable=True),
    sa.Column("source", sa.String(length=64), nullable=True),
    sa.Column("imei", sa.String(length=20), nullable=True),
    sa.Column("plate", sa.String(length=128), nullable=True),
    sa.Column("make", sa.String(length=128), nullable=True),
    sa.Column("model", sa.String(length=128), nullable=True),
    sa.Column("type", sa.Integer(), sa.ForeignKey("vehicle_types.id"), nullable=True),
    sa.Column("fuel", sa.Integer(), sa.ForeignKey("fuel_types.id"), nullable=True),
    sa.Column("wltp_fossil", sa.Float(), nullable=True),
    sa.Column("wltp_el", sa.Float(), nullable=True),
    sa.Column("capacity_decrease", sa.Float(), nullable=True),
    sa.Column("co2_pr_km", sa.Float(), nullable=True),
    sa.Column("range", sa.Float(), nullable=True),
    sa.Column("omkostning_aar", sa.Float(), nullable=True),
    sa.Column("location", sa.Integer(), sa.ForeignKey("allowed_starts.id"), nullable=True),
    sa.Column("start_leasing", sa.DateTime(), nullable=True),
    sa.Column("end_leasing", sa.DateTime(), nullable=True),
    sa.Column(
        "leasing_type", sa.Integer(), sa.ForeignKey("leasing_types.id"), nullable=True
    ),
    sa.Column("km_aar", sa.Float(), nullable=True),
    sa.Column("sleep", sa.Integer(), nullable=True),
    sa.Column("department", sa.String(length=128), nullable=True),
    sa.Column("deleted", sa.Boolean(), nullable=True),
    sa.Column("disabled", sa.Boolean(), nullable=True),
    sa.Column("forvaltning", sa.String(length=128), nullable=True),
    sa.Column("description", sa.String(length=128), nullable=True),
    sa.Column("test_vehicle", sa.Boolean(), nullable=True),
)

sa.Table(
    "roundtrips",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("start_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("end_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("start_latitude", sa.Float(), nullable=True),
    sa.Column("start_longitude", sa.Float(), nullable=True),
    sa.Column("end_latitude", sa.Float(), nullable=True),
    sa.Column("end_longitude", sa.Float(), nullable=True),
    sa.Column("distance", sa.Float(), nullable=True),
    sa.Column("aggregation_type", sa.String(length=128), nullable=True),
    sa.Column("driver_name", sa.String(length=128), nullable=True),
    sa.Column(
        "start_location_id",
        sa.Integer(),
        sa.ForeignKey("allowed_starts.id"),
        nullable=True,
    ),
    sa.Column(
        "car_id", sa.Integer(), sa.ForeignKey("cars.id"), nullable=False, index=True
    ),
)

sa.Table(
    "trips",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column(
        "car_id", sa.Integer(), sa.ForeignKey("cars.id"), nullable=False, index=True
    ),
    sa.Column("distance", sa.Float(), nullable=True),
    sa.Column("start_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("end_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("start_latitude", sa.Float(), nullable=True),
    sa.Column("start_longitude", sa.Float(), nullable=True),
    sa.Column("end_latitude", sa.Float(), nullable=True),
    sa.Column("end_longitude", sa.Float(), nullable=True),
    sa.Column("driver_name", sa.String(length=128), nullable=True),
    sa.Column("department", sa.String(length=128), nullable=True),
    sa.Column(
        "start_location",
        sa.Integer(),
        sa.ForeignKey("allowed_starts.id"),
        nullable=False,
    ),
)

sa.Table(
    "workshop_visits",
    metadata,
    sa.Column(
        "car_id", sa.Integer(), sa.ForeignKey("cars.id"), nullable=False, index=True
    ),
    sa.Column(
        "workshop_id",
        sa.Integer(),
        sa.ForeignKey("workshops.id"),
        nullable=False,
        index=True,
    ),
    sa.Column("start_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("end_time", sa.DateTime(), nullable=True, index=True),
    sa.Column("duration", sa.Float(), nullable=True),
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
)

sa.Table(
    "roundtripsegments",
    metadata,
    sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
    sa.Column("distance", sa.Float(), nullable=True),
    sa.Column("start_time", sa.DateTime(), nullable=True),
    sa.Column("end_time", sa.DateTime(), nullable=True),
    sa.Column(
        "round_trip_id",
        sa.Integer(),
        sa.ForeignKey("roundtrips.id"),
        nullable=True,
        index=True,
    ),
)


def upgrade() -> None:
    """Create whatever part of the baseline schema the database is missing."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    metadata.create_all(bind, checkfirst=True)

    for table in metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        existing_columns = {col["name"] for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_columns:
                continue
            # Nullable regardless of the definition above: existing rows have no
            # value for a column that was missing.
            op.add_column(
                table.name, sa.Column(column.name, column.type, nullable=True)
            )

        existing_indexes = {ix["name"] for ix in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name in existing_indexes:
                continue
            op.create_index(
                index.name, table.name, [col.name for col in index.columns]
            )


def downgrade() -> None:
    """Drop the baseline schema."""
    metadata.drop_all(op.get_bind())
