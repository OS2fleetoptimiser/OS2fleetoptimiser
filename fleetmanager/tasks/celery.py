import os

from celery import Celery
from celery.signals import worker_ready
from kombu import Queue, serialization
from datetime import datetime, timedelta
from uuid import uuid4

from fleetmanager.api.fleet_simulation.schemas import FleetSimulationOptions
from fleetmanager.api.goal_simulation.schemas import GoalSimulationOptions
from fleetmanager.api.location.schemas import PrecisionTestOptions
from fleetmanager.data_access.db_engine import engine_creator
from fleetmanager.data_access.seeding import seed_db
from fleetmanager.fleet_simulation import fleet_simulator
from fleetmanager.goal_simulation import goal_simulator, automatic_simulator
from fleetmanager.location import precision_test
from fleetmanager.tasks.cache_utils import get_redis_client

app = Celery(
    os.getenv("CELERY_USER", f"fleetmanager_{uuid4().hex}"),
    broker=os.getenv("CELERY_BROKER_URL", "amqp://localhost"),
    backend=os.getenv("CELERY_BACKEND_URL", "redis://localhost"),
)
app.log.already_setup = True
app.conf.event_serializer = "pickle"
app.conf.task_serializer = "pickle"
app.conf.result_serializer = "pickle"
app.conf.accept_content = ["pickle", "application/json", "application/x-python-serialize"]
app.conf.update(result_extended=True)
queue = os.getenv("CELERY_QUEUE", "default")
serialization.register_pickle()
serialization.enable_insecure_serializers()

app.conf.task_queues = [Queue(queue)]
app.conf.result_expires = timedelta(days=int(os.getenv("TTL", 30))).total_seconds()  # 30 day default TTL

@app.task(queue=queue)
def run_fleet_simulation(settings: FleetSimulationOptions):
    return fleet_simulator(settings)


@app.task(bind=True, queue=queue)
def run_goal_simulation(self, settings: GoalSimulationOptions, sim_start: datetime):
    # return goal_simulator(settings, self, sim_start)
    return automatic_simulator(settings, self, sim_start)  # todo temporary testing ge algorithm


@app.task(bind=True, queue=queue)
def run_precision_location_test(self, settings: PrecisionTestOptions):
    return precision_test(
        extractors=settings.extractors,
        location=settings.location,
        test_specific_start=settings.test_specific_start,
        start_date=settings.start_date,
        task=self,
        test_name=settings.test_name
    )


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    """fail fast if redis is not available. Seed dev data if SEED_DUMMY_DATA=true."""
    get_redis_client()
    if os.getenv("SEED_DUMMY_DATA", "false").lower() == "true":
        _engine = engine_creator()
        seed_db(_engine)
