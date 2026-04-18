import os
import sys
from pathlib import Path


def main():
    try:
        import psycopg2
        from psycopg2 import sql
    except Exception as e:
        print("Missing dependency: psycopg2. Install with: pip install psycopg2-binary")
        raise

    project_root = Path(__file__).resolve().parents[1]
    schema_file = project_root / "database" / "schema.sql"
    if not schema_file.exists():
        print(f"Schema file not found: {schema_file}")
        sys.exit(1)

    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("DB_PORT", 5432))
    DB_ADMIN = os.environ.get("DB_ADMIN", "bzladmin")
    DB_ADMIN_PW = os.environ.get("DB_ADMIN_PW", "bzl623")
    TARGET_DB = os.environ.get("TARGET_DB", "plc")

    # Connect to default 'postgres' database as admin
    conn = None
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname="postgres", user=DB_ADMIN, password=DB_ADMIN_PW)
        conn.autocommit = True
        cur = conn.cursor()

        # Create role if not exists
        cur.execute("SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = %s", (DB_ADMIN,))
        if not cur.fetchone():
            cur.execute(sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(sql.Identifier(DB_ADMIN)), (DB_ADMIN_PW,))

        # Create database if not exists
        cur.execute(
            sql.SQL("SELECT 1 FROM pg_database WHERE datname = {dbname}").format(dbname=sql.Literal(TARGET_DB))
        )
        exists = cur.fetchone()
        if not exists:
            print(f"Creating database {TARGET_DB}...")
            cur.execute(sql.SQL("CREATE DATABASE {dbname} OWNER {owner}").format(dbname=sql.Identifier(TARGET_DB), owner=sql.Identifier(DB_ADMIN)))
        else:
            print(f"Database {TARGET_DB} already exists.")

        cur.close()
        conn.close()

        # Apply schema
        print(f"Applying schema from {schema_file} to database {TARGET_DB}...")
        conn2 = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=TARGET_DB, user=DB_ADMIN, password=DB_ADMIN_PW)
        conn2.autocommit = True
        cur2 = conn2.cursor()
        schema_sql = schema_file.read_text(encoding="utf-8")
        cur2.execute(schema_sql)
        cur2.close()
        conn2.close()

        print("Schema applied successfully")

    except Exception as e:
        print("Error while applying schema:", e)
        raise


if __name__ == "__main__":
    main()
