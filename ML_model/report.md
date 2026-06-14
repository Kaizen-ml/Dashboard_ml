# AI Data Center Cooling Optimization Platform

## Overview

This codebase implements an AI-driven cooling optimization platform for data center operations. It combines a trained Digital Twin, a reinforcement learning (RL) policy, and dashboard-ready exports so operators can monitor cooling strategies, safety, and efficiency.

The core objective is to decide when to use air cooling, liquid cooling, or a hybrid mode in order to improve energy use, water savings, thermal stability, and overall cooling efficiency.

## Key Goals

- Generate outputs for a dashboard used by data center operators.
- Use RL to select cooling actions that increase efficiency while maintaining safety.
- Export metrics as CSV and JSON so dashboards can render trends, strategy distribution, and safety history.
- Build a realistic Digital Twin of cooling performance using XGBoost regression models.

## High-Level Architecture

1. `preprocess.py` — Stage 1: prepare raw data into clean feature sets.
2. `train_digital_twin.py` — Stage 2: train XGBoost models for air and liquid cooling predictions.
3. `digital_twin.py` — Stage 3: inference engine and RL hooks for state, reward, and action simulation.c
4. `rl_environment.py` — Stage 3A: gym-compatible environment that wraps the Digital Twin.
5. `safety_filter.py` — Stage 3A: stateless safety guard that validates and overrides RL actions.
6. `rl_agent.py` — Stage 3B: PPO reinforcement learning agent and dashboard recommendation helpers.
7. `train_rl.py` — Stage 3B pipeline: train the agent, evaluate it, save the model, and export dashboard artifacts.
8. `evaluate.py` — stand-alone evaluation script for a saved model.
9. `benchmark.py` — compare PPO performance against fixed AIR/LIQUID/HYBRID baselines.

## Data Flow

- Raw CSV inputs are processed by `preprocess.py` and saved to `processed/`.
- `train_digital_twin.py` trains per-target XGBoost models and stores them in `models/` with metadata.
- `digital_twin.py` loads those models and exposes prediction functions plus RL hooks.
- `rl_environment.py` consumes the Digital Twin state and runs episodes with discrete actions.
- `rl_agent.py` trains a PPO policy over environment episodes and stores the policy in `models_rl/`.
- `train_rl.py` evaluates the trained policy and writes dashboard-ready exports in `dashboard_exports/`.

## Core Modules Explained

### digital_twin.py

This file is the inference engine for the physical system. It:

- Loads XGBoost models from `models/`.
- Provides `predict_air()`, `predict_liquid()`, and `predict_hybrid()` for cooling strategy outputs.
- Provides RL hooks:
  - `get_rl_state()` returns the 4-dimensional RL state used by the agent.
  - `calculate_reward()` computes a reward signal balancing water savings, energy savings, cooling efficiency, and temperature penalties.
  - `simulate_action()` applies an AIR / LIQUID / HYBRID decision to the model inputs and returns the next state, reward breakdown, and hybrid metrics.

The RL state includes:

- `temperature_deviation`
- `water_usage`
- `liquid_outlet_temp`
- `cooling_efficiency`

These are the reliable, physically meaningful signals used for policy learning.

#### Cooling action semantics in `simulate_action()`

- `0` = AIR: lower water use, weaker temperature control, slightly reduced efficiency.
- `1` = LIQUID: stronger temperature control, higher water use, improved efficiency.
- `2` = HYBRID: balanced trade-off with moderate water use and temperature performance.

The function also clamps outputs to safe bounds and computes reward through `calculate_reward()`.

### rl_environment.py

This module wraps the Digital Twin into a Gymnasium environment:

- Observation space: a 4-D Box matching the RL state.
- Action space: Discrete(3) for AIR / LIQUID / HYBRID.
- Episode termination: unsafe state or max steps.
- It uses the `SafetyFilter` before every step.
- It maintains history buffers for dashboard visualization.

The environment is responsible for:

- resetting initial state with randomized workload and ambient temperature,
- calling `get_rl_state()` for observations,
- applying `SafetyFilter` to actions,
- recording the sequence of states and metrics for exports.

### safety_filter.py

The safety layer ensures the RL policy never executes unsafe actions directly.

It checks the current state against thresholds such as:

- temperature deviation limit
- cooling efficiency minimum
- water usage minimum
- liquid outlet temperature min/max

If a proposed action would violate constraints, it substitutes a safer alternative and returns a structured intervention report. This is important for data center dashboards because operators need transparency when the AI overrides a recommendation.

### rl_agent.py

This module wraps Stable-Baselines3 PPO and adds domain-specific utilities:

- Builds the PPO model using `MlpPolicy`.
- Trains on the environment with callbacks to capture reward history.
- Loads and saves the trained model to `models_rl/ppo_cooling_agent.zip`.
- Evaluates the policy deterministically and exports aggregated metrics.
- Generates human-readable strategy recommendations for dashboard cards.

The agent also supports:

- `recommend_strategy()` — returns a recommended action label, plain-English rationale, expected KPIs, and rack-level placeholder data for 3D visualizations.
- `get_config()` — returns hyperparameters for logging and dashboard metadata.

### train_rl.py

This is the main RL pipeline script. It:

- builds the training and evaluation environments,
- creates the `CoolingPPOAgent`,
- trains it over a configurable number of timesteps,
- evaluates the policy over deterministic episodes,
- saves model and metrics,
- exports dashboard CSV files.

It produces the following outputs:

- `models_rl/ppo_cooling_agent.zip`
- `models_rl/training_metrics.json`
- `models_rl/evaluation_metrics.json`
- `models_rl/training_history.csv`
- `dashboard_exports/reward_history.csv`
- `dashboard_exports/strategy_history.csv`
- `dashboard_exports/safety_history.csv`
- `dashboard_exports/episode_summary.csv`

This makes the system ready for a dashboard frontend to display rewards, strategy choices, safety events, and episode summaries.

### evaluate.py

A standalone evaluator for a saved PPO model. It:

- loads `models_rl/ppo_cooling_agent.zip`,
- runs deterministic episodes,
- collects KPI summaries,
- writes `dashboard_metrics.json` and the CSV artifacts.

This script is useful when the model is already trained and you want dashboard-ready metrics without retraining.

### benchmark.py

This file compares the RL policy against fixed baselines:

- always AIR,
- always LIQUID,
- always HYBRID,
- PPO policy.

It exports benchmark results to `dashboard_exports/benchmark_results.csv` and `benchmark_results.json` so operators can see whether the learned agent actually improves performance.

## Supporting Data Pipeline Files

### preprocess.py

Prepares datasets from raw CSV sources. It validates input schemas, cleans missing values, engineers features, and outputs processed files in `processed/`:

- `processed/air_cooling_data.csv`
- `processed/liquid_cooling_data.csv`
- `processed/facility_data.csv`
- `processed/data_report.json`

This stage is necessary before the Digital Twin models can be trained.

### train_digital_twin.py

Trains the XGBoost models used by `digital_twin.py`. It:

- loads the processed air and liquid datasets,
- validates required columns,
- trains per-target regression models,
- saves the models as `.pkl` files in `models/`,
- saves metadata in `models/model_metadata.json`.

This module is the foundation of the Digital Twin, because the RL agent relies on predicted cooling physics rather than real-time hardware measurements.

## Dashboard Purpose and Outputs

The platform is designed to serve a data center dashboard by producing the following outputs:

- strategy distribution (how often AIR/LIQUID/HYBRID is chosen),
- reward trends over training,
- episode-by-episode performance,
- safety intervention counts,
- mean water savings, energy savings, cooling efficiency, and temperature deviation,
- benchmark comparisons against fixed baseline strategies,
- recommended cooling actions and natural-language rationale.

The dashboard exports are intentionally CSV/JSON so they can be consumed by many visualization systems without requiring a database.

## RL and Cooling Control

The RL agent chooses among three cooling modes:

- `AIR` — minimal water flow, lower energy, weaker temperature control.
- `LIQUID` — higher water flow, better temperature control, higher cooling efficiency.
- `HYBRID` — a balanced mix, designed for both water and thermal trade-offs.

This decision logic is meant to represent a real data center control problem in which operator dashboards need to know whether the system should change fan speed/air cooling or shift toward liquid cooling.

The RL reward function encourages:

- water savings,
- energy savings,
- cooling efficiency,
- low temperature deviation,
- avoidance of overheating.

Safety is enforced by `SafetyFilter` before the Digital Twin applies any action. That protects the data center from dangerous action sequences and records interventions for the dashboard.

## Recommended Usage

- Run `python preprocess.py` first to produce `processed/` datasets.
- Train the digital twin with `python train_digital_twin.py`.
- Train the RL agent with `python train_rl.py`.
- Evaluate a saved model with `python evaluate.py`.
- Compare strategies with `python benchmark.py`.

## Summary

This repository is a complete pipeline for a data center cooling dashboard:

- raw telemetry data is cleaned and transformed,
- a Digital Twin is trained from real cooling data,
- a PPO RL agent learns to choose between air, liquid, and hybrid cooling,
- a safety layer prevents unsafe actions,
- dashboard-ready export files capture performance, strategy, and safety metrics.

The main value of the system is that it can help data center operators move from fixed cooling rules to an AI-driven decision process that optimizes fan speed/water flow and reports results in dashboard form.
