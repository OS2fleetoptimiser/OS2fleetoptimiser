import os
from functools import wraps
from redis import Redis
import pickle


class RedisNotConfiguredError(Exception):
    pass


def get_redis_client():
    backend_url = os.getenv("CELERY_BACKEND_URL")
    if not backend_url:
        raise RedisNotConfiguredError(
            "CELERY_BACKEND_URL environment variable is not set"
        )
    r = Redis.from_url(backend_url)
    r.ping()
    return r


def require_redis(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(get_redis_client(), *args, **kwargs)
    return wrapper


@require_redis
def get_cached_data(r: Redis, key: str):
    cached_data = r.get(key)
    return pickle.loads(cached_data) if cached_data else None


@require_redis
def set_cached_data(r: Redis, key: str, data):
    r.set(key, pickle.dumps(data))


@require_redis
def delete_cached_data(r: Redis, key: str):
    r.delete(key)

