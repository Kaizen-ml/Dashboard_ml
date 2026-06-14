from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import data_adapter, ml_service, schemas

app = FastAPI(title="Data Center Cooling API", version="1.0.0")

origins = ["http://localhost:3000", "http://localhost:3001"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    ml_service.initialize()


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "ready": ml_service.is_ready()}


@app.get("/api/dashboard/overview", response_model=schemas.OverviewResponse)
def overview() -> schemas.OverviewResponse:
    metrics = ml_service.get_dashboard_metrics()
    return data_adapter.overview_response(metrics.get("overview", {}))


@app.get("/api/dashboard/facility", response_model=schemas.FacilityResponse)
def facility() -> schemas.FacilityResponse:
    metrics = ml_service.get_dashboard_metrics()
    return data_adapter.facility_response(metrics.get("facility", {}))


@app.get("/api/dashboard/workloads", response_model=list[schemas.WorkloadJob])
def workloads() -> list[schemas.WorkloadJob]:
    metrics = ml_service.get_dashboard_metrics()
    return data_adapter.workloads_response(metrics.get("workloads", []))


@app.get("/api/dashboard/grid", response_model=list[schemas.GridTrendPoint])
def grid() -> list[schemas.GridTrendPoint]:
    metrics = ml_service.get_dashboard_metrics()
    return data_adapter.grid_response(metrics.get("grid", []))


@app.get("/api/dashboard/recommendation", response_model=schemas.RecommendationResponse)
def recommendation() -> schemas.RecommendationResponse:
    return data_adapter.recommendation_response(ml_service.get_recommendation())


@app.post("/api/dashboard/simulate", response_model=schemas.SimulateResponse)
def simulate(request: schemas.SimulateRequest) -> schemas.SimulateResponse:
    try:
        raw = ml_service.simulate_action(
            request.action,
            request.air_params,
            request.liquid_params,
        )
        return data_adapter.simulate_response(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
