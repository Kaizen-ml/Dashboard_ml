from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ActivityLog(BaseModel):
    timestamp: str
    message: str


class PUERecord(BaseModel):
    timestamp: str
    pue: float


class GridTrendPoint(BaseModel):
    timestamp: str
    price: float
    carbon_intensity: float = 0.0
    load_forecast: float = 0.0


class RackSensor(BaseModel):
    rack_id: str
    temperature: float
    humidity: float
    efficiency: float


class OverviewResponse(BaseModel):
    water_usage: float
    energy_cost: float
    temperature_deviation: float
    outlet_temperature: float
    cooling_efficiency: float
    energy_savings_percent: float
    water_savings_percent: float
    sustainability_score: float
    recommended_strategy: str
    confidence: Dict[str, str]
    estimatedSavings: float = 0.0
    co2Avoided: float = 0.0
    activeFlexCount: int = 0
    slaRisks: int = 0


class FacilityResponse(BaseModel):
    facility_name: str
    pue: float
    activity_logs: List[ActivityLog]
    pue_trend: List[PUERecord]
    rack_temperatures: List[float] = []
    fan_speeds: List[float] = []


class WorkloadJob(BaseModel):
    job_id: str
    workload: float
    status: str
    expected_energy_cost: float
    expected_water_usage: float
    power: float = 0.0
    CPU: float = 0.0


class RecommendationResponse(BaseModel):
    recommended_action: int
    action_label: str
    rationale: str
    current_state: Dict[str, float]
    expected_outcomes: Dict[str, float]
    confidence_note: str
    rack_data: List[RackSensor]
    export_metadata: Dict[str, str] = {}


class SimulateRequest(BaseModel):
    action: str
    air_params: Optional[Dict[str, Any]] = None
    liquid_params: Optional[Dict[str, Any]] = None


class SimulateResponse(BaseModel):
    approved_action: int
    approved_action_label: str
    action_executed: str
    next_state: Dict[str, float]
    reward_breakdown: Dict[str, float]
    hybrid_output: Dict[str, Any]
    safety_report: Dict[str, Any]
