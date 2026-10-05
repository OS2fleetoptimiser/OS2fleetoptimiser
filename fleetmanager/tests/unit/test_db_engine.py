from fleetmanager.data_access import build_dsn


def test_build_dsn_uses_configured_odbc_driver(monkeypatch):
    monkeypatch.setenv("DB_ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
    monkeypatch.setenv("DB_ODBC_OPTIONS", "Encrypt=yes&TrustServerCertificate=yes")

    dsn = build_dsn("mssql+pyodbc", "user", "secret", "dbhost", "fleetdb")

    assert dsn == (
        "mssql+pyodbc://user:secret@dbhost/fleetdb"
        "?driver=ODBC+Driver+18+for+SQL+Server"
        "&Encrypt=yes&TrustServerCertificate=yes"
    )
