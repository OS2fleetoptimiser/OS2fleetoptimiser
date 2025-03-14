import os
from redis import Redis
import pickle


def get_redis_client():
    return Redis.from_url(os.getenv("CELERY_BACKEND_URL"))

def get_cached_data(key: str):
    r = get_redis_client()
    cached_data = r.get(key)
    return pickle.loads(cached_data) if cached_data else None

def set_cached_data(key: str, data):
    r = get_redis_client()
    r.set(key, pickle.dumps(data))
