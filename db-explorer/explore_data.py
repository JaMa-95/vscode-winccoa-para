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

# Systems
cur.execute('SELECT * FROM winccoa.systems;')
print('=== SYSTEMS ===')
for row in cur.fetchall():
    print(f"  {row}")

# Configuration
cur.execute('SELECT * FROM winccoa.configuration;')
print('\n=== CONFIGURATION ===')
for row in cur.fetchall():
    print(f"  {row}")

# Archive groups
cur.execute('SELECT * FROM winccoa.archive_groups;')
print('\n=== ARCHIVE GROUPS ===')
for row in cur.fetchall():
    print(f"  {row}")

# Elements (sample - first 30)
cur.execute('SELECT element_id, sys_id, type_, event, alert, element_name, dpt_name, dpt_id, unit, alias, comment_ FROM winccoa.elements ORDER BY element_id LIMIT 30;')
print('\n=== ELEMENTS (first 30) ===')
cols = [desc[0] for desc in cur.description]
print(f"  {cols}")
for row in cur.fetchall():
    print(f"  {row}")

# Elements grouped by dpt_name
cur.execute("SELECT dpt_name, COUNT(*) as cnt FROM winccoa.elements GROUP BY dpt_name ORDER BY cnt DESC;")
print('\n=== ELEMENTS BY DPT NAME ===')
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} elements")

# Distinct type_ values
cur.execute("SELECT DISTINCT type_ FROM winccoa.elements ORDER BY type_;")
print('\n=== DISTINCT TYPE_ VALUES ===')
for row in cur.fetchall():
    print(f"  {row[0]}")

# Segments
cur.execute('SELECT * FROM winccoa.segments;')
print('\n=== SEGMENTS ===')
for row in cur.fetchall():
    print(f"  {row}")

# Scheduler tasks
cur.execute('SELECT * FROM winccoa.scheduler_tasks;')
print('\n=== SCHEDULER TASKS ===')
for row in cur.fetchall():
    print(f"  {row}")

# Elements to archive groups
cur.execute('SELECT e.element_name, ea.group_name FROM winccoa.elements_to_archive_groups ea JOIN winccoa.elements e ON e.element_id = ea.element_id LIMIT 20;')
print('\n=== ELEMENTS TO ARCHIVE GROUPS (first 20) ===')
for row in cur.fetchall():
    print(f"  {row}")

# Sample event data
cur.execute('SELECT * FROM winccoa._event_1_a LIMIT 5;')
print('\n=== EVENT_1_A SAMPLE ===')
cols = [desc[0] for desc in cur.description]
print(f"  {cols}")
for row in cur.fetchall():
    print(f"  {row}")

cur.close()
conn.close()
