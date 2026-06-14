from __future__ import annotations

from typing import Any, Dict, List

from . import schemas


def overview_response(raw: Dict[str, Any]) -> schemas.OverviewResponse:
    return schemas.OverviewResponse(
        water_usage=float(raw.get("water_usage", 0.0)),
        energy_cost=float(raw.get("energy_cost", 0.0)),
        temperature_deviation=float(raw.get("temperature_deviation", 0.0)),
        outlet_temperature=float(raw.get("outlet_temperature", 0.0)),
        cooling_efficiency=float(raw.get("cooling_efficiency", 0.0)),
        energy_savings_percent=float(raw.get("energy_savings_percent", 0.0)),
        water_savings_percent=float(raw.get("water_savings_percent", 0.0)),
        sustainability_score=float(raw.get("sustainability_score", 0.0)),
        recommended_strategy=str(raw.get("recommended_strategy", "UNKNOWN")),
        confidence={
            str(k): str(v)
            for k, v in dict(raw.get("confidence", {})).items()
        },
        estimatedSavings=float(raw.get("estimatedSavings", 0.0)),
        co2Avoided=float(raw.get("co2Avoided", 0.0)),
        activeFlexCount=int(raw.get("activeFlexCount", 0)),
        slaRisks=int(raw.get("slaRisks", 0)),
    )


def facility_response(raw: Dict[str, Any]) -> schemas.FacilityResponse:
    return schemas.FacilityResponse(
        facility_name=str(raw.get("facility_name", "Data Center")),
        pue=float(raw.get("pue", 1.0)),
        activity_logs=[
            schemas.ActivityLog(**item)
            for item in raw.get("activity_log", [])
            if isinstance(item, dict)
        ],
        pue_trend=[
            schemas.PUERecord(**item)
            for item in raw.get("pue_trend", [])
            if isinstance(item, dict)
        ],
        rack_temperatures=[float(t) for t in raw.get("rack_temperatures", [])],
        fan_speeds=[float(f) for f in raw.get("fan_speeds", [])],
    )


def workloads_response(raw: List[Dict[str, Any]]) -> List[schemas.WorkloadJob]:
    return [
        schemas.WorkloadJob(
            job_id=str(item.get("job_id", "unknown")),
            workload=float(item.get("workload", 0.0)),
            status=str(item.get("status", "UNKNOWN")),
            expected_energy_cost=float(item.get("expected_energy_cost", 0.0)),
            expected_water_usage=float(item.get("expected_water_usage", 0.0)),
            power=float(item.get("power", 0.0)),
            CPU=float(item.get("CPU", 0.0)),
        )
        for item in raw
        if isinstance(item, dict)
    ]


def grid_response(raw: List[Dict[str, Any]]) -> List[schemas.GridTrendPoint]:
    return [
        schemas.GridTrendPoint(
            timestamp=str(item.get("timestamp", "")),
            price=float(item.get("price", 0.0)),
            carbon_intensity=float(item.get("carbon_intensity", 0.0)),
            load_forecast=float(item.get("load_forecast", 0.0)),
        )
        for item in raw
        if isinstance(item, dict)
    ]


def recommendation_response(raw: Dict[str, Any]) -> schemas.RecommendationResponse:
    return schemas.RecommendationResponse(
        recommended_action=int(raw.get("recommended_action", 0)),
        action_label=str(raw.get("action_label", "UNKNOWN")),
        rationale=str(raw.get("rationale", "")),
        current_state={
            str(k): float(v)
            for k, v in dict(raw.get("current_state", {})).items()
        },
        expected_outcomes={
            str(k): float(v)
            for k, v in dict(raw.get("expected_outcomes", {})).items()
            if isinstance(v, (int, float))
        },
        confidence_note=str(raw.get("confidence_note", "")),
        rack_data=[
            schemas.RackSensor(**item)
            for item in raw.get("rack_data", [])
            if isinstance(item, dict)
        ],
        export_metadata={
            str(k): str(v)
            for k, v in dict(raw.get("export_metadata", {})).items()
        },
    )


def simulate_response(raw: Dict[str, Any]) -> schemas.SimulateResponse:
    return schemas.SimulateResponse(
        approved_action=int(raw.get("approved_action", 0)),
        approved_action_label=str(raw.get("approved_action_label", "UNKNOWN")),
        action_executed=str(raw.get("action_executed", "UNKNOWN")),
        next_state={
            str(k): float(v)
            for k, v in dict(raw.get("next_state", {})).items()
        },
        reward_breakdown={
            str(k): float(v)
            for k, v in dict(raw.get("reward_breakdown", {})).items()
        },
        hybrid_output={
            str(k): v
            for k, v in dict(raw.get("hybrid_output", {})).items()
        },
        safety_report={
            str(k): v
            for k, v in dict(raw.get("safety_report", {})).items()
        },
    )
