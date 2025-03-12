import os
from uuid import uuid4
from datetime import datetime


def get_task_id(task_name: str, queue_name: str = None):
    """
    Construct a task id for the celery task storing in redis
    takes in at least task_name and will construct id for efficient scanning of
    redis store. Key to be stored will look like
    celery-task-meta-<queue_name>:<task_name>:<datetime isoformat>:<uid>
    """
    uid = uuid4().hex
    now = datetime.now()
    if queue_name is None:
        queue_name = os.getenv("CELERY_QUEUE")

    return f"{queue_name}:{task_name}:{now.isoformat()}:{uid}"
