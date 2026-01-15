import os
from fleetmanager.tasks.cache_utils import get_cached_data, set_cached_data, delete_cached_data


def key_constructor(datestring: str, process: str):
    return f"running_task:{os.getenv('CELERY_QUEUE', 'default')}:{process}:{datestring}"


def set_task_running(sim_start: str, process: str):
    if sim_start is None:
        return
    set_cached_data(key_constructor(sim_start, process), "running")


def is_task_running(sim_start: str, process: str) -> bool:
    if sim_start is None:
        # to allow isolated runs without api
        return True
    return bool(get_cached_data(key_constructor(sim_start, process)))


def clear_task_signal(sim_start: str, process: str):
    if sim_start is None:
        return
    delete_cached_data(key_constructor(sim_start, process))
