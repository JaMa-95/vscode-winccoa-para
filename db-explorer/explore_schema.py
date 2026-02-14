import psycopg2
import json

conn = psycopg2.connect(
    host='127.0.0.1',
    port=15432,
    user='para',
    password='Uo5e6sk$sp1123',
    dbname='winccoa'
)
cur = conn.cursor()

# List all schemas
cur.execute("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;")
print('=== SCHEMAS ===')
for row in cur.fetchall():
    print(f"  {row[0]}")

# List all tables per schema (excluding system schemas)
cur.execute("""
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name;
""")
print('\n=== TABLES ===')
current_schema = None
for row in cur.fetchall():
    if row[0] != current_schema:
        current_schema = row[0]
        print(f"\n  Schema: {current_schema}")
    print(f"    {row[1]}")

# For each table, show columns
cur.execute("""
    SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position;
""")
print('\n=== COLUMNS ===')
current_table = None
for row in cur.fetchall():
    table_key = f"{row[0]}.{row[1]}"
    if table_key != current_table:
        current_table = table_key
        print(f"\n  {table_key}:")
    nullable = "NULL" if row[3] == "YES" else "NOT NULL"
    default = f" DEFAULT {row[5]}" if row[5] else ""
    print(f"    {row[2]}: {row[3]} ({row[4]}){default}")

# Show row counts for all tables
print('\n=== ROW COUNTS ===')
cur.execute("""
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name;
""")
tables = cur.fetchall()
for schema, table in tables:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{schema}"."{table}";')
        count = cur.fetchone()[0]
        print(f"  {schema}.{table}: {count} rows")
    except Exception as e:
        conn.rollback()
        print(f"  {schema}.{table}: ERROR - {e}")

cur.close()
conn.close()
