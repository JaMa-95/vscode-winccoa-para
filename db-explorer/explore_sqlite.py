import sqlite3
import os

sqlite_dir = r"C:\Projects\NodeJsTest\db\wincc_oa\sqlite"
db_files = [f for f in os.listdir(sqlite_dir) if f.endswith('.sqlite')]

for db_file in sorted(db_files):
    db_path = os.path.join(sqlite_dir, db_file)
    size_kb = os.path.getsize(db_path) / 1024
    print(f"\n{'='*60}")
    print(f"DATABASE: {db_file} ({size_kb:.1f} KB)")
    print(f"{'='*60}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # List tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cur.fetchall()]
    print(f"Tables: {tables}")

    for table in tables:
        # Get schema
        cur.execute(f"PRAGMA table_info('{table}');")
        cols = cur.fetchall()
        print(f"\n  TABLE: {table}")
        for col in cols:
            print(f"    {col[1]}: {col[2]} {'PK' if col[5] else ''} {'NOT NULL' if col[3] else ''} {('DEFAULT '+str(col[4])) if col[4] is not None else ''}")

        # Get row count
        cur.execute(f"SELECT COUNT(*) FROM '{table}';")
        count = cur.fetchone()[0]
        print(f"    -> {count} rows")

        # Sample data (first 5 rows)
        if count > 0:
            cur.execute(f"SELECT * FROM '{table}' LIMIT 5;")
            rows = cur.fetchall()
            col_names = [c[1] for c in cols]
            print(f"    Sample ({min(5, count)} rows):")
            for row in rows:
                print(f"      {dict(zip(col_names, row))}")

    # List indexes
    cur.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name;")
    indexes = cur.fetchall()
    if indexes:
        print(f"\n  INDEXES:")
        for idx in indexes:
            print(f"    {idx[0]} on {idx[1]}: {idx[2]}")

    conn.close()
