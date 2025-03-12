from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.openapi.utils import get_openapi

from fleetmanager.api.configuration.routes import router as configuration_routes
from fleetmanager.api.fleet_simulation.routes import router as fleet_simulation_routes
from fleetmanager.api.goal_simulation.routes import router as goal_simulation_routes
from fleetmanager.api.location.routes import router as location_routes
from fleetmanager.api.simulation_setup.routes import router as simulation_setup_routes
from fleetmanager.api.statistics.routes import router as statistics_routes
from fleetmanager.api.user.routes import router as user_routes

app = FastAPI(
    title="FleetOptimiser",
    version="latest",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.include_router(simulation_setup_routes)
app.include_router(configuration_routes)
app.include_router(fleet_simulation_routes)
app.include_router(goal_simulation_routes)
app.include_router(statistics_routes)
app.include_router(location_routes)
app.include_router(user_routes)

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
async def get_documentation():
    return get_redoc_html(title=app.title, openapi_url="/openapi.json")


@app.get("/openapi.json", include_in_schema=False)
async def openapi():
    return get_openapi(title=app.title, version=app.version, routes=app.routes)
