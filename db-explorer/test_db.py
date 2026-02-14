import psycopg2

conn = psycopg2.connect(
    host='127.0.0.1',
    port=15432,
    user='para',
    password='Uo5e6sk$sp1123',
    dbname='postgres'
)
cur = conn.cursor()

# List all databases
cur.execute('SELECT datname FROM pg_database WHERE datistemplate = false;')
print('=== DATABASES ===')
for row in cur.fetchall():
    print(row[0])

cur.close()
conn.close()
