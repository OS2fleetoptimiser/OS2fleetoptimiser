import sqlalchemy as sa


def existing_column_type(bind, table: str, column: str):
    inspector = sa.inspect(bind)
    if not inspector.has_table(table):
        return None
    for col in inspector.get_columns(table):
        if col["name"] == column:
            return col["type"]
    return None


def referenced_type(bind, table: str, column: str = "id", default=None):
    found = existing_column_type(bind, table, column)
    if found is not None:
        return found
    return default if default is not None else sa.Integer()


def match_foreign_key_types(bind, metadata: sa.MetaData) -> None:
    for table in metadata.tables.values():
        for column in table.columns:
            for fk in column.foreign_keys:
                target = fk.column
                found = existing_column_type(bind, target.table.name, target.name)
                if found is not None:
                    column.type = found
