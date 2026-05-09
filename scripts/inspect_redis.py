import os
import redis

url = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
print('REDIS_URL=', url)
try:
    r = redis.from_url(url)
except Exception as e:
    print('Redis connection error:', e)
    raise

llen = r.llen('pipeline:jobs')
print('LLEN pipeline:jobs ->', llen)
items = r.lrange('pipeline:jobs', 0, -1)
print('LRANGE pipeline:jobs ->', len(items), 'items')
for i, item in enumerate(items):
    try:
        s = item.decode('utf-8')
    except Exception:
        s = str(item)
    print(i, s[:400])

job_id = '65f71513-3975-47d4-917c-c88f2fd66dd8'
v = r.get(f'pipeline:job:{job_id}')
print('pipeline:job:'+job_id+' ->', v)
