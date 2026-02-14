import psycopg2

conn = psycopg2.connect(
    host='127.0.0.1',
    port=15432,
    user='para',
    password='Uo5e6sk$sp1123',
    dbname='winccoa'
)
cur = conn.cursor()

# Show elements for ExampleDP_Float type (user DPs, not internal)
cur.execute("""
    SELECT e.element_id, e.element_name, e.dpt_name, e.type_, e.event, e.alert, e.unit,
           ea.group_name
    FROM winccoa.elements e
    LEFT JOIN winccoa.elements_to_archive_groups ea ON e.element_id = ea.element_id
    WHERE e.dpt_name LIKE 'Example%'
    ORDER BY e.element_name;
""")
print('=== Example DP Elements ===')
for row in cur.fetchall():
    print(f"  id={row[0]} name={row[1]} dpt={row[2]} type={row[3]} event={row[4]} alert={row[5]} unit={row[6]} group={row[7]}")

# Show some _NGA related elements
cur.execute("""
    SELECT e.element_id, e.element_name, e.dpt_name, e.type_, e.event, e.alert
    FROM winccoa.elements e
    WHERE e.dpt_name LIKE '_NGA%'
    ORDER BY e.element_name;
""")
print('\n=== NGA Elements ===')
for row in cur.fetchall():
    print(f"  id={row[0]} name={row[1]} dpt={row[2]} type={row[3]} event={row[4]} alert={row[5]}")

# Check indexes on key tables
cur.execute("""
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'winccoa'
    ORDER BY tablename, indexname;
""")
print('\n=== INDEXES ===')
for row in cur.fetchall():
    print(f"  {row[0]}.{row[1]}: {row[2]}")

# Check views
cur.execute("""
    SELECT table_name, view_definition
    FROM information_schema.views
    WHERE table_schema = 'winccoa';
""")
print('\n=== VIEWS ===')
for row in cur.fetchall():
    print(f"\n  VIEW: {row[0]}")
    print(f"  {row[1][:500]}")

cur.close()
conn.close()
