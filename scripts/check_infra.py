import os
from redis import Redis
import psycopg2

def check_redis():
    url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    try:
        r = Redis.from_url(url, socket_timeout=5)
        ok = r.ping()
        print('redis: ok') if ok else print('redis: ping failed')
    except Exception as e:
        print('redis: error ->', repr(e))

def check_postgres():
    dsn = os.environ.get('DATABASE_DSN', 'postgresql://user:password@localhost:5432/plc')
    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
        cur = conn.cursor()
        cur.execute('SELECT 1')
        print('postgres: ok ->', cur.fetchone())
        conn.close()
    except Exception as e:
        print('postgres: error ->', repr(e))

if __name__ == '__main__':
    check_redis()
    check_postgres()
