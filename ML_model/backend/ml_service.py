from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from digital_twin import get_rl_state, predict_hybrid, simulate_action as dt_simulate_action
from safety_filter import SafetyFilter


logger = logging.getLogger("BackendMLService")
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_RL_PATH = BASE_DIR / "models_rl" / "ppo_cooling_agent.zip"

DEFAULT_AIR_PARAMS: Dict[str, Any] = {
    "Server_Workload": 50.0,
    "Inlet_Temperature": 24.0,
    "Ambient_Temperature": 28.0,
    "Chiller_Usage": 55.0,
    "AHU_Usage": 45.0,
    "Cooling_Strategy_Encoded": 2.0,
    "Cooling_Unit_Power_Consumption_kW": 12.0,
}

DEFAULT_LIQUID_PARAMS: Dict[str, Any] = {
    "avg_P_ac": 6.0,
    "avg_P_cu": 3.5,
    "avg_T_MEAS": 29.0,
    "avg_T_celCC": 32.0,
    "avg_T_out": 26.0,
    "TLHC": 55.0,
    "DoW": 3.0,
    "WeH": 0.0,
}

_ACTION_MAP: Dict[str, int] = {
    "AIR": 0,
    "LIQUID": 1,
    "HYBRID": 2,
}

_AGENT: Optional[Any] = None
_SAFETY_FILTER: Optional[SafetyFilter] = None
_INITIALIZED = False


def _load_rl_components() -> None:
    global _AGENT
    try:
        rl_agent = importlib.import_module("rl_agent")
        rl_environment = importlib.import_module("rl_environment")
        env = rl_environment.CoolingEnvironment(
            DEFAULT_AIR_PARAMS,
            DEFAULT_LIQUID_PARAMS,
            max_steps=10,
        )
        _AGENT = rl_agent.CoolingPPOAgent(env)
        try:
            _AGENT.load(MODEL_RL_PATH)
            logger.info("Loaded RL model from %s", MODEL_RL_PATH)
        except FileNotFoundError:
            logger.warning("RL model file not found: %s", MODEL_RL_PATH)
        except Exception as exc:
            logger.warning("Failed to load RL model: %s", exc)
    except Exception as exc:
        logger.warning("RL agent components unavailable: %s", exc)
        _AGENT = None


def initialize() -> None:
    global _INITIALIZED, _SAFETY_FILTER
    if _INITIALIZED:
        return
    _SAFETY_FILTER = SafetyFilter()
    _load_rl_components()
    _INITIALIZED = True


def is_ready() -> bool:
    return _INITIALIZED


def get_dashboard_metrics() -> Dict[str, Any]:
    hybrid = predict_hybrid(DEFAULT_AIR_PARAMS, DEFAULT_LIQUID_PARAMS)
    return {
        "overview": {
            **hybrid,
            "estimatedSavings": round(hybrid.get("energy_cost", 0) * 1.5, 2),
            "co2Avoided": round(hybrid.get("water_usage", 0) * 0.8, 2),
            "activeFlexCount": 12,
            "slaRisks": 0,
        },
        "facility": {
            "facility_name": "Main Data Center",
            "pue": 1.42,
            "activity_log": [
                {"timestamp": "2026-06-14T08:00:00Z", "message": "Cooling loop stable."},
                {"timestamp": "2026-06-14T09:30:00Z", "message": "AI recommendation generated."},
                {"timestamp": "2026-06-14T11:00:00Z", "message": "Grid price alert received."},
            ],
            "pue_trend": [
                {"timestamp": "2026-06-14T05:00:00Z", "pue": 1.49},
                {"timestamp": "2026-06-14T07:00:00Z", "pue": 1.44},
                {"timestamp": "2026-06-14T09:00:00Z", "pue": 1.42},
                {"timestamp": "2026-06-14T11:00:00Z", "pue": 1.40},
            ],
            "rack_temperatures": [28.5, 29.1, 27.8, 30.2],
            "fan_speeds": [3200, 3150, 3300, 3100],
        },
        "workloads": [
            {
                "job_id": "JOB-001",
                "workload": 72.5,
                "status": "RUNNING",
                "expected_energy_cost": round(hybrid.get("energy_cost", 0.0) * 0.75, 2),
                "expected_water_usage": round(hybrid.get("water_usage", 0.0) * 0.85, 2),
                "power": 12.5,
                "CPU": 85.0,
            },
            {
                "job_id": "JOB-002",
                "workload": 41.0,
                "status": "QUEUED",
                "expected_energy_cost": round(hybrid.get("energy_cost", 0.0) * 0.55, 2),
                "expected_water_usage": round(hybrid.get("water_usage", 0.0) * 0.45, 2),
                "power": 0.0,
                "CPU": 0.0,
            },
            {
                "job_id": "JOB-003",
                "workload": 88.0,
                "status": "RUNNING",
                "expected_energy_cost": round(hybrid.get("energy_cost", 0.0) * 0.95, 2),
                "expected_water_usage": round(hybrid.get("water_usage", 0.0) * 0.95, 2),
                "power": 22.0,
                "CPU": 92.5,
            },
        ],
        "grid": [
            {"timestamp": "2026-06-14T06:00:00Z", "price": 0.12, "carbon_intensity": 450.5, "load_forecast": 120.0},
            {"timestamp": "2026-06-14T08:00:00Z", "price": 0.10, "carbon_intensity": 410.2, "load_forecast": 115.5},
            {"timestamp": "2026-06-14T10:00:00Z", "price": 0.11, "carbon_intensity": 430.0, "load_forecast": 130.0},
            {"timestamp": "2026-06-14T12:00:00Z", "price": 0.09, "carbon_intensity": 390.8, "load_forecast": 140.5},
            {"timestamp": "2026-06-14T14:00:00Z", "price": 0.13, "carbon_intensity": 480.0, "load_forecast": 150.0},
        ],
        "recommendation": get_recommendation(),
    }


def get_recommendation() -> Dict[str, Any]:
    state = get_rl_state(DEFAULT_AIR_PARAMS, DEFAULT_LIQUID_PARAMS)
    observation = np.array(
        [
            state["temperature_deviation"],
            state["water_usage"],
            state["liquid_outlet_temp"],
            state["cooling_efficiency"],
        ],
        dtype=np.float32,
    )

    if _AGENT is not None and getattr(_AGENT, "model", None) is not None:
        try:
            return _AGENT.recommend_strategy(observation, state)
        except Exception as exc:
            logger.warning("RL recommendation failed: %s", exc)

    label = "HYBRID"
    rationale = "Balanced cooling is recommended for the current operating point."
    if state["temperature_deviation"] < 3.0:
        label = "AIR"
        rationale = "Temperature deviation is low, so air cooling should be efficient and safe."
    elif state["cooling_efficiency"] > 0.8:
        label = "LIQUID"
        rationale = "Liquid cooling is preferred because the efficiency level is high."

    return {
        "recommended_action": _ACTION_MAP[label],
        "action_label": label,
        "rationale": rationale,
        "current_state": {
            "temperature_deviation": round(state["temperature_deviation"], 3),
            "water_usage": round(state["water_usage"], 3),
            "liquid_outlet_temp": round(state["liquid_outlet_temp"], 3),
            "cooling_efficiency": round(state["cooling_efficiency"], 4),
        },
        "expected_outcomes": {
            "temperature_deviation": round(state["temperature_deviation"], 3),
            "water_usage": round(state["water_usage"], 3),
            "cooling_efficiency": round(state["cooling_efficiency"], 4),
        },
        "confidence_note": "Recommendation is based on the current digital twin state.",
        "rack_data": [
            {"rack_id": "Rack-A1", "temperature": 27.5, "humidity": 38.0, "efficiency": 0.81},
            {"rack_id": "Rack-B2", "temperature": 29.0, "humidity": 35.5, "efficiency": 0.79},
            {"rack_id": "Rack-C3", "temperature": 26.8, "humidity": 40.0, "efficiency": 0.83},
        ],
        "export_metadata": {
            "generated_at": "2026-06-14T12:00:00Z",
            "model_version": "1.0",
            "export_format": "PDF"
        },
    }


def simulate_action(
    action: str,
    air_params: Optional[Dict[str, Any]] = None,
    liquid_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if _SAFETY_FILTER is None:
        raise RuntimeError("Safety filter not initialised")

    action_key = action.strip().upper()
    if action_key not in _ACTION_MAP:
        raise ValueError("action must be one of AIR, LIQUID, HYBRID")

    air_params = air_params or DEFAULT_AIR_PARAMS.copy()
    liquid_params = liquid_params or DEFAULT_LIQUID_PARAMS.copy()
    proposed_action = _ACTION_MAP[action_key]
    current_state = get_rl_state(air_params, liquid_params)
    approved_action, safety_report = _SAFETY_FILTER.validate_action(
        proposed_action,
        current_state,
    )

    result = dt_simulate_action(
        approved_action,
        air_params,
        liquid_params,
        previous_state=current_state,
    )
    return {
        "approved_action": approved_action,
        "approved_action_label": ["AIR", "LIQUID", "HYBRID"][approved_action],
        "action_executed": ["AIR", "LIQUID", "HYBRID"][approved_action],
        "next_state": result.get("next_state", {}),
        "reward_breakdown": result.get("reward_breakdown", {}),
        "hybrid_output": result.get("hybrid_output", {}),
        "safety_report": safety_report,
    }
