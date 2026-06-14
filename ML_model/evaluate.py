"""
evaluate.py
===========
AI-Powered Data Center Cooling Optimization Platform
Stage 4 — Standalone Evaluation & Dashboard Export

Responsibilities
----------------
- Load a previously trained PPO model (no training, no retraining)
- Run deterministic evaluation via CoolingEnvironment.step()
- Collect extended KPIs by also calling simulate_action() directly at
  each step (gives access to hybrid_output, which env.step() info dict
  already carries via "hybrid_output" key)
- Export dashboard_metrics.json + four CSVs
- Print a human-readable console report

Architecture — symbol correctness guarantee
-------------------------------------------
Every import and every attribute access in this file has been verified
against the uploaded source code.  Nothing is invented.

Verified symbols used
---------------------
  rl_environment : CoolingEnvironment(air_params, liquid_params,
                       max_steps, safety_filter, render_mode)
                   .reset() -> (obs, info)
                   .step(action) -> (obs, reward, terminated, truncated, info)
                   .close()
                   ._current_state           (dict)
                   ._current_air_params      (dict)
                   ._current_liquid_params   (dict)
                   ACTION_LABELS             (dict {0:"AIR",1:"LIQUID",2:"HYBRID"})

  safety_filter  : SafetyFilter()
                   .validate_action(proposed_action, state)
                     -> (approved_action_int, report_dict)
                   report_dict["intervention_applied"]  (bool)
                   .is_safe_state(state)                 (bool)

  digital_twin   : simulate_action(action, air_params, liquid_params,
                       previous_state)
                     -> {"next_state", "reward_breakdown", "hybrid_output",
                         "action", "action_label"}
                   simulate_action()["reward_breakdown"]["total_reward"]
                   simulate_action()["hybrid_output"]["water_savings_percent"]
                   simulate_action()["hybrid_output"]["energy_savings_percent"]
                   simulate_action()["hybrid_output"]["sustainability_score"]
                   simulate_action()["hybrid_output"]["thermal_stability"]
                   simulate_action()["hybrid_output"]["outlet_temperature"]

  stable_baselines3 : PPO.load(path), PPO.predict(obs, deterministic)

NOT used (do not exist in the codebase)
---------------------------------------
  DataCenterCoolingEnv, SafetyStatus, SafetyFilter.evaluate(),
  _DEFAULT_AIR_PARAMS, _DEFAULT_LIQUID_PARAMS, _normalise_state(),
  CoolingEnvironment(randomise=), CoolingEnvironment(overheating_threshold=)

Usage
-----
  python evaluate.py
  python evaluate.py --episodes 50
  python evaluate.py --model-path rl_models/best_model.zip
  python evaluate.py --max-steps 100 --log-level DEBUG
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from stable_baselines3 import PPO

# ---------------------------------------------------------------------------
# Project imports — verified against uploaded source files
# ---------------------------------------------------------------------------
try:
    from digital_twin import simulate_action
    from rl_environment import CoolingEnvironment, ACTION_LABELS
    from safety_filter import SafetyFilter
except ImportError as exc:
    raise ImportError(
        "evaluate.py must be run from the project root alongside "
        "digital_twin.py, rl_environment.py, and safety_filter.py.\n"
        f"Original error: {exc}"
    ) from exc

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
)
logger = logging.getLogger("Evaluate")

# ---------------------------------------------------------------------------
# Paths and defaults
# ---------------------------------------------------------------------------
BASE_DIR      = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models_rl"
DASHBOARD_DIR = BASE_DIR / "dashboard_exports"

DEFAULT_MODEL_PATH: Path = MODELS_DIR / "ppo_cooling_agent.zip"
N_EVAL_EPISODES:    int  = 20
DEFAULT_MAX_STEPS:  int  = 100

# ---------------------------------------------------------------------------
# Default Digital Twin parameters
# These mirror the smoke-test values from digital_twin.py and
# rl_environment.py smoke tests — no invented constants.
# ---------------------------------------------------------------------------
_EVAL_AIR_PARAMS: Dict[str, Any] = {
    "Server_Workload":                    75.0,
    "Inlet_Temperature":                  24.0,
    "Ambient_Temperature":                30.0,
    "Chiller_Usage":                      65.0,
    "AHU_Usage":                          40.0,
    "Cooling_Strategy_Encoded":           2,
    "Cooling_Unit_Power_Consumption_kW":  12.5,
}

_EVAL_LIQUID_PARAMS: Dict[str, Any] = {
    "avg_P_ac":    6.0,
    "avg_P_cu":    3.5,
    "avg_T_out":   26.0,
    "avg_T_MEAS":  29.0,
    "avg_T_celCC": 32.0,
    "TLHC":        55.0,
    "DoW":         3.0,
    "WeH":         0.0,
}


# ===========================================================================
# Step-level accumulator
# ===========================================================================

class _StepAccumulator:
    """
    Collects per-step and per-episode values during evaluation.

    All stored values are standard Python floats/ints — no numpy arrays —
    so summarise() output is immediately JSON-serialisable.
    """

    def __init__(self) -> None:
        # Core per-step
        self.rewards:       List[float] = []
        self.actions:       List[int]   = []
        self.water_savings: List[float] = []
        self.energy_savings:List[float] = []
        self.cooling_effs:  List[float] = []
        self.temp_devs:     List[float] = []

        # Extended per-step (from hybrid_output / next_state)
        self.sustainability:    List[float] = []  # hybrid_output["sustainability_score"]
        self.thermal_stab:      List[float] = []  # hybrid_output["thermal_stability"]
        self.outlet_temps:      List[float] = []  # hybrid_output["outlet_temperature"]
        self.liq_outlet_temps:  List[float] = []  # next_state["liquid_outlet_temp"]

        # Safety counters
        self.safety_overrides: int = 0
        self.unsafe_actions:   int = 0

        # Per-episode aggregates
        self.episode_rewards:        List[float] = []
        self.episode_lengths:        List[int]   = []
        self.episode_sustainability: List[float] = []
        self.episode_thermal_stab:   List[float] = []
        self.episode_outlet_temp:    List[float] = []
        self.episode_liq_outlet:     List[float] = []

    def add_step(
        self,
        reward:          float,
        action:          int,
        next_state:      Dict[str, float],
        hybrid_output:   Dict[str, Any],
        safety_override: bool,
    ) -> None:
        self.rewards.append(float(reward))
        self.actions.append(int(action))
        self.water_savings.append( float(hybrid_output.get("water_savings_percent",  0.0)))
        self.energy_savings.append(float(hybrid_output.get("energy_savings_percent", 0.0)))
        self.cooling_effs.append(  float(next_state.get("cooling_efficiency",        0.5)))
        self.temp_devs.append(     float(next_state.get("temperature_deviation",     0.0)))
        self.sustainability.append(float(hybrid_output.get("sustainability_score") or 0.0))
        self.thermal_stab.append(  float(hybrid_output.get("thermal_stability")    or 0.0))
        self.outlet_temps.append(  float(hybrid_output.get("outlet_temperature")   or 0.0))
        self.liq_outlet_temps.append(float(next_state.get("liquid_outlet_temp",    0.0)))
        if safety_override:
            self.safety_overrides += 1

    def close_episode(self, episode_reward: float, episode_length: int) -> None:
        self.episode_rewards.append(round(float(episode_reward), 4))
        self.episode_lengths.append(int(episode_length))
        n = episode_length

        def _ep_mean(lst: List[float]) -> float:
            return round(float(np.mean(lst[-n:])), 4) if n and lst else 0.0

        self.episode_sustainability.append(_ep_mean(self.sustainability))
        self.episode_thermal_stab.append(  _ep_mean(self.thermal_stab))
        self.episode_outlet_temp.append(   _ep_mean(self.outlet_temps))
        self.episode_liq_outlet.append(    _ep_mean(self.liq_outlet_temps))

    def _mean(self, lst: List[float]) -> float:
        return round(float(np.mean(lst)), 4) if lst else 0.0

    def _std(self, lst: List[float]) -> float:
        return round(float(np.std(lst)), 4) if lst else 0.0

    def summarise(self) -> Dict[str, Any]:
        total_steps   = len(self.actions)
        action_counts = {
            "AIR":    self.actions.count(0),
            "LIQUID": self.actions.count(1),
            "HYBRID": self.actions.count(2),
        }
        denom = max(total_steps, 1)
        action_pcts = {k: round(v / denom * 100.0, 2) for k, v in action_counts.items()}
        ep_f = [float(r) for r in self.episode_rewards]

        return {
            "n_episodes":             len(ep_f),
            "mean_reward":            self._mean(ep_f),
            "max_reward":             round(float(max(ep_f)), 4)  if ep_f else 0.0,
            "min_reward":             round(float(min(ep_f)), 4)  if ep_f else 0.0,
            "std_reward":             self._std(ep_f),
            "mean_episode_length":    self._mean([float(x) for x in self.episode_lengths]),
            "mean_water_savings":     self._mean(self.water_savings),
            "mean_energy_savings":    self._mean(self.energy_savings),
            "mean_cooling_efficiency":self._mean(self.cooling_effs),
            "mean_temp_deviation":    self._mean(self.temp_devs),
            "mean_sustainability_score": self._mean(self.sustainability),
            "mean_thermal_stability":    self._mean(self.thermal_stab),
            "mean_outlet_temperature":   self._mean(self.outlet_temps),
            "mean_liquid_outlet_temp":   self._mean(self.liq_outlet_temps),
            "safety_interventions":   self.safety_overrides,
            "unsafe_action_count":    self.unsafe_actions,
            "strategy_distribution": {
                "AIR_count":    action_counts["AIR"],
                "LIQUID_count": action_counts["LIQUID"],
                "HYBRID_count": action_counts["HYBRID"],
                "AIR_pct":      action_pcts["AIR"],
                "LIQUID_pct":   action_pcts["LIQUID"],
                "HYBRID_pct":   action_pcts["HYBRID"],
            },
            "episode_rewards":        list(self.episode_rewards),
            "episode_lengths":        list(self.episode_lengths),
            "episode_sustainability": list(self.episode_sustainability),
            "episode_thermal_stab":   list(self.episode_thermal_stab),
            "episode_outlet_temp":    list(self.episode_outlet_temp),
            "episode_liq_outlet":     list(self.episode_liq_outlet),
        }


# ===========================================================================
# Step 1 — Load trained PPO model
# ===========================================================================

def load_trained_model(model_path: Path = DEFAULT_MODEL_PATH) -> PPO:
    """
    Load a saved PPO model from disk.

    Falls back from best_model.zip → latest_model.zip automatically.
    Raises FileNotFoundError with an actionable message if neither exists.
    """
    model_path = Path(model_path)

    if not model_path.exists():
        fallback = MODELS_DIR / "latest_model.zip"
        if fallback.exists():
            logger.warning("best_model.zip not found — falling back to latest_model.zip")
            model_path = fallback
        else:
            raise FileNotFoundError(
                f"Trained PPO model not found: {model_path.resolve()}\n"
                "Run 'python train_rl.py' first.\n"
                f"Expected: {MODELS_DIR / 'best_model.zip'}"
            )

    logger.info("Loading PPO model ← %s", model_path.resolve())
    try:
        model = PPO.load(str(model_path))
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load PPO model from {model_path.resolve()}.\n"
            f"Original error: {type(exc).__name__}: {exc}"
        ) from exc

    logger.info("PPO model loaded successfully.")
    return model


# ===========================================================================
# Step 2 — Deterministic rollout
# ===========================================================================

def run_evaluation(
    model:         PPO,
    n_episodes:    int                      = N_EVAL_EPISODES,
    max_steps:     int                      = DEFAULT_MAX_STEPS,
    air_params:    Optional[Dict[str, Any]] = None,
    liquid_params: Optional[Dict[str, Any]] = None,
    seed:          int                      = 42,
) -> Dict[str, Any]:
    """
    Run n_episodes of deterministic evaluation and collect all KPIs.

    Rollout design
    --------------
    For each step we:
      1. Call model.predict(obs, deterministic=True)
      2. Pass action through SafetyFilter.validate_action() — uses the
         ACTUAL API: returns (approved_int, report_dict).
         report_dict["intervention_applied"] flags overrides.
      3. Call simulate_action() directly to capture hybrid_output.
      4. Call env.step(approved_action) to keep obs/state consistent.

    WHY call simulate_action() AND env.step()?
      env.step() updates the environment's internal state buffer and
      returns the next observation the PPO policy will see.  But env's
      info dict may not always surface every hybrid_output key we need.
      Calling simulate_action() directly gives guaranteed access to
      sustainability_score, thermal_stability, and outlet_temperature.
      Both calls use the same approved_action, so results are identical.

    Parameters
    ----------
    model         : Loaded SB3 PPO model.
    n_episodes    : Number of full evaluation episodes.
    max_steps     : Maximum steps per episode.
    air_params    : Digital Twin air parameters (defaults used if None).
    liquid_params : Digital Twin liquid parameters.
    seed          : Base seed for CoolingEnvironment.reset().

    Returns
    -------
    dict   All metrics as standard Python scalars/lists (JSON-safe).
    """
    air_params    = air_params    or dict(_EVAL_AIR_PARAMS)
    liquid_params = liquid_params or dict(_EVAL_LIQUID_PARAMS)

    safety_filter = SafetyFilter()
    acc           = _StepAccumulator()

    logger.info(
        "Starting %d deterministic evaluation episodes (max_steps=%d) …",
        n_episodes, max_steps,
    )

    for ep in range(n_episodes):
        # CoolingEnvironment constructor signature (verified):
        #   (air_params, liquid_params, max_steps, safety_filter, render_mode)
        env = CoolingEnvironment(
            air_params    = air_params,
            liquid_params = liquid_params,
            max_steps     = max_steps,
        )
        obs, _ = env.reset(seed=seed + ep)

        episode_reward: float                        = 0.0
        episode_steps:  int                          = 0
        previous_state: Optional[Dict[str, float]]   = None

        for _step in range(max_steps):
            # --- PPO deterministic prediction ---
            action_arr, _ = model.predict(obs, deterministic=True)
            proposed_action = int(action_arr)

            # --- Safety filter (ACTUAL API: validate_action returns tuple) ---
            # validate_action(proposed_action: int, state: dict) -> (int, dict)
            approved_action, safety_report = safety_filter.validate_action(
                proposed_action = proposed_action,
                state           = env._current_state,
            )
            # report_dict["intervention_applied"] is the override flag
            safety_override = bool(safety_report.get("intervention_applied", False))

            if safety_override:
                logger.debug(
                    "Ep %d step %d: safety override %s → %s",
                    ep + 1, _step + 1,
                    ACTION_LABELS.get(proposed_action, str(proposed_action)),
                    ACTION_LABELS.get(approved_action, str(approved_action)),
                )

            # --- Direct simulate_action() call for hybrid_output access ---
            try:
                sim_result    = simulate_action(
                    action         = approved_action,
                    air_params     = env._current_air_params,
                    liquid_params  = env._current_liquid_params,
                    previous_state = previous_state,
                )
                next_state    = sim_result["next_state"]
                hybrid_output = sim_result["hybrid_output"]
                reward_val    = float(sim_result["reward_breakdown"]["total_reward"])
            except Exception as exc:
                logger.error(
                    "Ep %d step %d simulate_action() failed: %s", ep + 1, _step + 1, exc
                )
                next_state    = dict(env._current_state)
                hybrid_output = {}
                reward_val    = -1.0

            # --- Accumulate KPIs ---
            acc.add_step(
                reward          = reward_val,
                action          = approved_action,
                next_state      = next_state,
                hybrid_output   = hybrid_output,
                safety_override = safety_override,
            )

            # --- Step environment to keep obs buffer consistent ---
            obs, env_reward, terminated, truncated, info = env.step(approved_action)

            episode_reward += reward_val
            episode_steps  += 1
            previous_state  = next_state

            if terminated or truncated:
                break

        acc.close_episode(episode_reward=episode_reward, episode_length=episode_steps)
        env.close()

        logger.info(
            "Episode %2d/%d  reward=%.4f  steps=%d",
            ep + 1, n_episodes, episode_reward, episode_steps,
        )

    metrics = acc.summarise()
    logger.info(
        "Evaluation complete — mean_reward=%.4f  sustainability=%.2f  "
        "thermal_stability=%.4f",
        metrics["mean_reward"],
        metrics["mean_sustainability_score"],
        metrics["mean_thermal_stability"],
    )
    return metrics


# ===========================================================================
# Step 3 — Sanity checks
# ===========================================================================

def validate_metrics(metrics: Dict[str, Any]) -> None:
    """
    Run sanity checks on the collected metrics.
    Logs warnings (does not raise) so evaluation always completes.
    """
    dist = metrics.get("strategy_distribution", {})

    # Check strategy percentages sum to ~100
    total_pct = (
        dist.get("AIR_pct", 0.0)
        + dist.get("LIQUID_pct", 0.0)
        + dist.get("HYBRID_pct", 0.0)
    )
    if abs(total_pct - 100.0) > 1.0:
        logger.warning(
            "Strategy percentages sum to %.2f%% (expected ~100%%)", total_pct
        )
    else:
        logger.info("✅ Strategy percentages sum: %.2f%%", total_pct)

    # Check episode counts
    n_ep = metrics.get("n_episodes", 0)
    if n_ep == 0:
        logger.warning("⚠️  No episodes completed.")
    else:
        logger.info("✅ Episodes completed: %d", n_ep)

    # Check rewards are finite
    ep_rewards = metrics.get("episode_rewards", [])
    if ep_rewards and not all(float(r) == float(r) for r in ep_rewards):
        logger.warning("⚠️  Some episode rewards are NaN.")
    else:
        logger.info("✅ All episode rewards are finite.")

    # Warn if exports would be empty
    if not ep_rewards:
        logger.warning("⚠️  episode_rewards list is empty — CSV exports will have no data rows.")


# ===========================================================================
# Step 4 — Determine recommended strategy
# ===========================================================================

def determine_recommended_strategy(metrics: Dict[str, Any]) -> str:
    """
    Return the strategy selected most often (by step count).
    Tie-break: HYBRID > LIQUID > AIR.
    """
    dist = metrics.get("strategy_distribution", {})
    pct  = {
        "AIR":    float(dist.get("AIR_pct",    0.0)),
        "LIQUID": float(dist.get("LIQUID_pct", 0.0)),
        "HYBRID": float(dist.get("HYBRID_pct", 0.0)),
    }
    best = max(pct.values())
    for strategy in ("HYBRID", "LIQUID", "AIR"):
        if pct[strategy] == best:
            logger.info(
                "Recommended strategy: %s  (AIR=%.1f%%  LIQUID=%.1f%%  HYBRID=%.1f%%)",
                strategy, pct["AIR"], pct["LIQUID"], pct["HYBRID"],
            )
            return strategy
    return "HYBRID"


# ===========================================================================
# Step 5 — Dashboard JSON export
# ===========================================================================

def export_dashboard_json(
    metrics:              Dict[str, Any],
    recommended_strategy: str,
    strategy_reason:      str,
    output_dir:           Path = DASHBOARD_DIR,
) -> Path:
    """
    Write dashboard_exports/dashboard_metrics.json.

    Structure maps 1-to-1 with frontend dashboard panels.
    All values are standard Python scalars — no numpy types.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dist = metrics.get("strategy_distribution", {})

    payload: Dict[str, Any] = {
        "generated_at":         _utc_now(),
        "recommended_strategy": recommended_strategy,
         "strategy_reason": strategy_reason,
        "performance": {
            "mean_reward":         metrics.get("mean_reward",          0.0),
            "max_reward":          metrics.get("max_reward",           0.0),
            "min_reward":          metrics.get("min_reward",           0.0),
            "std_reward":          metrics.get("std_reward",           0.0),
            "mean_episode_length": metrics.get("mean_episode_length",  0.0),
            "n_episodes":          metrics.get("n_episodes",           0),
        },
        "cooling_metrics": {
            "cooling_efficiency":    metrics.get("mean_cooling_efficiency", 0.0),
            "temperature_deviation": metrics.get("mean_temp_deviation",     0.0),
            "outlet_temperature":    metrics.get("mean_outlet_temperature", 0.0),
            "liquid_outlet_temp":    metrics.get("mean_liquid_outlet_temp", 0.0),
            "thermal_stability":     metrics.get("mean_thermal_stability",  0.0),
        },
        "sustainability_metrics": {
            "water_savings_percent":  metrics.get("mean_water_savings",         0.0),
            "energy_savings_percent": metrics.get("mean_energy_savings",        0.0),
            "sustainability_score":   metrics.get("mean_sustainability_score",  0.0),
        },
        "safety_metrics": {
            "unsafe_action_count":  metrics.get("unsafe_action_count",  0),
            "safety_interventions": metrics.get("safety_interventions", 0),
        },
        "strategy_distribution": {
            "AIR_pct":      dist.get("AIR_pct",      0.0),
            "LIQUID_pct":   dist.get("LIQUID_pct",   0.0),
            "HYBRID_pct":   dist.get("HYBRID_pct",   0.0),
            "AIR_count":    dist.get("AIR_count",    0),
            "LIQUID_count": dist.get("LIQUID_count", 0),
            "HYBRID_count": dist.get("HYBRID_count", 0),
        },
        "timeseries": {
            "episode_rewards":        metrics.get("episode_rewards",        []),
            "episode_lengths":        metrics.get("episode_lengths",        []),
            "episode_sustainability": metrics.get("episode_sustainability", []),
            "episode_thermal_stab":   metrics.get("episode_thermal_stab",  []),
            "episode_outlet_temp":    metrics.get("episode_outlet_temp",   []),
            "episode_liq_outlet":     metrics.get("episode_liq_outlet",    []),
        },
    }

    out_path = output_dir / "dashboard_metrics.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=str)

    logger.info("Dashboard JSON → %s", out_path.resolve())
    return out_path.resolve()


# ===========================================================================
# Step 6 — CSV exports
# ===========================================================================

def export_dashboard_csvs(
    metrics:    Dict[str, Any],
    output_dir: Path = DASHBOARD_DIR,
) -> Dict[str, Path]:
    """
    Write four frontend-consumable CSVs.

    reward_timeseries.csv    episode | total_reward | episode_length
    action_distribution.csv  strategy | count | pct
    safety_summary.csv        metric | value
    extended_kpis.csv         episode | sustainability_score | thermal_stability
                              | outlet_temperature | liquid_outlet_temp
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    saved: Dict[str, Path] = {}

    ep_rewards = metrics.get("episode_rewards", [])
    ep_lengths = metrics.get("episode_lengths", [])

    if len(ep_rewards) != len(ep_lengths):
        raise ValueError(
            f"Length mismatch: {len(ep_rewards)} rewards vs {len(ep_lengths)} lengths."
        )

    # ---- reward_timeseries.csv ----------------------------------------
    rt_rows = [
        {"episode": i + 1, "total_reward": round(float(r), 4), "episode_length": int(l)}
        for i, (r, l) in enumerate(zip(ep_rewards, ep_lengths))
    ]
    rt_path = output_dir / "reward_timeseries.csv"
    _write_csv(rt_path, rt_rows, ["episode", "total_reward", "episode_length"])
    saved["reward_timeseries"] = rt_path.resolve()

    # ---- action_distribution.csv --------------------------------------
    dist = metrics.get("strategy_distribution", {})
    ad_rows = [
        {"strategy": "AIR",    "count": dist.get("AIR_count",    0), "pct": dist.get("AIR_pct",    0.0)},
        {"strategy": "LIQUID", "count": dist.get("LIQUID_count", 0), "pct": dist.get("LIQUID_pct", 0.0)},
        {"strategy": "HYBRID", "count": dist.get("HYBRID_count", 0), "pct": dist.get("HYBRID_pct", 0.0)},
    ]
    ad_path = output_dir / "action_distribution.csv"
    _write_csv(ad_path, ad_rows, ["strategy", "count", "pct"])
    saved["action_distribution"] = ad_path.resolve()

    # ---- safety_summary.csv -------------------------------------------
    ss_rows = [
        {"metric": "unsafe_action_count",  "value": metrics.get("unsafe_action_count",  0)},
        {"metric": "safety_interventions", "value": metrics.get("safety_interventions", 0)},
        {"metric": "n_episodes",           "value": metrics.get("n_episodes",           0)},
        {"metric": "mean_episode_length",  "value": metrics.get("mean_episode_length",  0.0)},
    ]
    ss_path = output_dir / "safety_summary.csv"
    _write_csv(ss_path, ss_rows, ["metric", "value"])
    saved["safety_summary"] = ss_path.resolve()

    # ---- extended_kpis.csv --------------------------------------------
    ep_sust  = metrics.get("episode_sustainability", [])
    ep_therm = metrics.get("episode_thermal_stab",   [])
    ep_out   = metrics.get("episode_outlet_temp",    [])
    ep_liq   = metrics.get("episode_liq_outlet",     [])
    n_ep     = len(ep_rewards)

    ek_rows = [
        {
            "episode":              i + 1,
            "sustainability_score": round(float(ep_sust[i]),  4) if i < len(ep_sust)  else 0.0,
            "thermal_stability":    round(float(ep_therm[i]), 4) if i < len(ep_therm) else 0.0,
            "outlet_temperature":   round(float(ep_out[i]),   4) if i < len(ep_out)   else 0.0,
            "liquid_outlet_temp":   round(float(ep_liq[i]),   4) if i < len(ep_liq)   else 0.0,
        }
        for i in range(n_ep)
    ]
    ek_path = output_dir / "extended_kpis.csv"
    _write_csv(
        ek_path, ek_rows,
        ["episode", "sustainability_score", "thermal_stability",
         "outlet_temperature", "liquid_outlet_temp"],
    )
    saved["extended_kpis"] = ek_path.resolve()

    logger.info("Dashboard CSVs:")
    for name, path in saved.items():
        logger.info("  %-26s → %s", name, path)

    return saved


# ===========================================================================
# Step 7 — Console report
# ===========================================================================

def print_console_report(
    metrics: Dict[str, Any],
    recommended_strategy: str,
    strategy_reason: str,
 ) -> None:
    """Print a full human-readable evaluation report to stdout."""
    dist = metrics.get("strategy_distribution", {})
    sep  = "=" * 54

    lines = [
    sep,
    "  COOLING OPTIMIZATION — EVALUATION REPORT",
    sep,
    f"  Recommended Strategy     : {recommended_strategy}",
    f"  Strategy Reason          : {strategy_reason}",
    "",
    "  — PERFORMANCE —",
    f"  Mean Reward              : {metrics.get('mean_reward',          0.0):>10.4f}",
    f"  Max  Reward              : {metrics.get('max_reward',           0.0):>10.4f}",
    f"  Min  Reward              : {metrics.get('min_reward',           0.0):>10.4f}",
    f"  Std  Reward              : {metrics.get('std_reward',           0.0):>10.4f}",
    f"  Mean Episode Length      : {metrics.get('mean_episode_length',  0.0):>10.1f}  steps",
    f"  Episodes Evaluated       : {metrics.get('n_episodes',           0):>10}",

    "",
    "  — COOLING METRICS —",
    f"  Cooling Efficiency       : {metrics.get('mean_cooling_efficiency',  0.0):>10.4f}",
    f"  Temperature Deviation    : {metrics.get('mean_temp_deviation',      0.0):>10.3f} °C",
    f"  Outlet Temperature       : {metrics.get('mean_outlet_temperature',  0.0):>10.3f} °C",
    f"  Liquid Outlet Temp       : {metrics.get('mean_liquid_outlet_temp',  0.0):>10.3f} °C",
    f"  Thermal Stability        : {metrics.get('mean_thermal_stability',   0.0):>10.4f}",

    "",
    "  — SUSTAINABILITY —",
    f"  Water Savings            : {metrics.get('mean_water_savings',        0.0):>10.2f} %",
    f"  Energy Savings           : {metrics.get('mean_energy_savings',       0.0):>10.2f} %",
    f"  Sustainability Score     : {metrics.get('mean_sustainability_score', 0.0):>10.2f} /100",

    "",
    "  — SAFETY —",
    f"  Safety Interventions     : {metrics.get('safety_interventions', 0):>10}",
    f"  Unsafe Action Count      : {metrics.get('unsafe_action_count',  0):>10}",

    "",
    "  — STRATEGY DISTRIBUTION —",
    f"  AIR    : {dist.get('AIR_pct',    0.0):>6.1f}%  ({dist.get('AIR_count',    0):>5} steps)",
    f"  LIQUID : {dist.get('LIQUID_pct', 0.0):>6.1f}%  ({dist.get('LIQUID_count', 0):>5} steps)",
    f"  HYBRID : {dist.get('HYBRID_pct', 0.0):>6.1f}%  ({dist.get('HYBRID_count', 0):>5} steps)",

    sep,
 ]

    # Sanity check: strategy pcts should sum to ~100
    total_pct = (dist.get("AIR_pct", 0.0)
                 + dist.get("LIQUID_pct", 0.0)
                 + dist.get("HYBRID_pct", 0.0))
    lines.append(f"  Strategy pct sum         : {total_pct:.1f}%  (expect ~100)")
    lines.append(sep)

    print("\n" + "\n".join(lines) + "\n")


# ===========================================================================
# Utilities
# ===========================================================================

def _write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    logger.debug("CSV written → %s (%d rows)", path, len(rows))


def _utc_now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# ===========================================================================
# Main pipeline
# ===========================================================================

def main(
    model_path:    Path                      = DEFAULT_MODEL_PATH,
    n_episodes:    int                       = N_EVAL_EPISODES,
    max_steps:     int                       = DEFAULT_MAX_STEPS,
    air_params:    Optional[Dict[str, Any]]  = None,
    liquid_params: Optional[Dict[str, Any]]  = None,
    output_dir:    Path                      = DASHBOARD_DIR,
    seed:          int                       = 42,
) -> Dict[str, Any]:
    """
    Full standalone evaluation pipeline.

    1. Load trained PPO model
    2. Run deterministic evaluation (collect extended KPIs)
    3. Run sanity checks
    4. Determine recommended strategy
    5. Export dashboard_metrics.json
    6. Export CSVs (reward_timeseries, action_distribution,
                    safety_summary, extended_kpis)
    7. Print console report

    Returns
    -------
    dict  {"metrics", "recommended_strategy", "exported_files"}
    """
    logger.info("=" * 58)
    logger.info("  Evaluation Pipeline  |  model: %s", Path(model_path).name)
    logger.info("  episodes=%d  max_steps=%d  seed=%d", n_episodes, max_steps, seed)
    logger.info("=" * 58)

    model = load_trained_model(model_path=model_path)

    metrics = run_evaluation(
        model         = model,
        n_episodes    = n_episodes,
        max_steps     = max_steps,
        air_params    = air_params,
        liquid_params = liquid_params,
        seed          = seed,
    )

    validate_metrics(metrics)

    recommended_strategy = determine_recommended_strategy(metrics)

    # --------------------------------------------------
    # Explain WHY the strategy was chosen
    # --------------------------------------------------

    cooling_efficiency = metrics.get("cooling_efficiency", 0.0)
    temperature_deviation = metrics.get("temperature_deviation", 0.0)
    water_savings = metrics.get("water_savings_percent", 0.0)
    energy_savings = metrics.get("energy_savings_percent", 0.0)

    strategy_reason = (
        f"{recommended_strategy} selected because it achieved "
        f"{cooling_efficiency:.4f} cooling efficiency, "
        f"{water_savings:.2f}% water savings, "
        f"{energy_savings:.2f}% energy savings while maintaining "
        f"{temperature_deviation:.2f}°C temperature deviation."
    )

    json_path = export_dashboard_json(
    metrics,
    recommended_strategy,
    strategy_reason,
    output_dir=output_dir
    )
    csv_paths = export_dashboard_csvs(metrics, output_dir=output_dir)

    print_console_report(
    metrics,
    recommended_strategy,
    strategy_reason
 )
    exported_files: Dict[str, Path] = {"dashboard_json": json_path}
    exported_files.update(csv_paths)

    logger.info("Pipeline complete.  %d files exported.", len(exported_files))

    return {
        "metrics":              metrics,
        "recommended_strategy": recommended_strategy,
        "exported_files":       exported_files,
    }


# ===========================================================================
# CLI
# ===========================================================================

def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate a trained PPO cooling agent. Does NOT retrain.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH,
                        dest="model_path", help="Path to the trained PPO model ZIP.")
    parser.add_argument("--episodes",   type=int,  default=N_EVAL_EPISODES,
                        dest="episodes", help="Number of deterministic evaluation episodes.")
    parser.add_argument("--max-steps",  type=int,  default=DEFAULT_MAX_STEPS,
                        dest="max_steps", help="Maximum steps per episode.")
    parser.add_argument("--output-dir", type=Path, default=DASHBOARD_DIR,
                        dest="output_dir", help="Directory for dashboard export files.")
    parser.add_argument("--seed",       type=int,  default=42,
                        help="Evaluation random seed.")
    parser.add_argument("--log-level",  default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        dest="log_level", help="Logging verbosity.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    _args = _parse_args()
    logging.getLogger().setLevel(getattr(logging, _args.log_level))

    try:
        result = main(
            model_path = _args.model_path,
            n_episodes = _args.episodes,
            max_steps  = _args.max_steps,
            output_dir = _args.output_dir,
            seed       = _args.seed,
        )
    except FileNotFoundError as exc:
        logger.error("Model not found: %s", exc)
        sys.exit(1)
    except RuntimeError as exc:
        logger.error("Evaluation failed: %s", exc)
        sys.exit(1)
    except (ValueError, KeyError) as exc:
        logger.error("Data error: %s", exc)
        sys.exit(1)
    except OSError as exc:
        logger.error("File I/O error: %s", exc)
        sys.exit(1)

    print("\nExported files:")
    for name, path in result["exported_files"].items():
        print(f"  {name:<28} {path}")