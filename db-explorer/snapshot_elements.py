import psycopg2
import sys

conn = psycopg2.connect(
    host='127.0.0.1',
    port=15432,
    user='para',
    password='Uo5e6sk$sp1123',
    dbname='winccoa'
)
cur = conn.cursor()

label = sys.argv[1] if len(sys.argv) > 1 else "SNAPSHOT"
print(f"=== {label} ===")

# Count elements
cur.execute('SELECT COUNT(*) FROM winccoa.elements;')
print(f"Total elements: {cur.fetchone()[0]}")

# Show all elements that contain "Test" or "PARA_TEST"
cur.execute("SELECT element_id, element_name, dpt_name, type_, unit FROM winccoa.elements WHERE element_name ILIKE '%test%' OR element_name ILIKE '%para_test%' ORDER BY element_id;")
rows = cur.fetchall()
print(f"\nTest-related elements ({len(rows)}):")
for row in rows:
    print(f"  id={row[0]} name={row[1]} dpt={row[2]} type={row[3]} unit={row[4]}")

# Show all tables and their row counts
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'winccoa' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
""")
tables = cur.fetchall()
print(f"\nTable row counts:")
for (table,) in tables:
    cur.execute(f'SELECT COUNT(*) FROM winccoa."{table}";')
    count = cur.fetchone()[0]
    print(f"  {table}: {count}")

cur.close()
conn.close()
