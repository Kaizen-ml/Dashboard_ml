from pathlib import Path
import logging
from rl_environment import CoolingEnvironment
from rl_agent import CoolingPPOAgent
logging.basicConfig(level=logging.INFO)
print("Creating env...")
env = CoolingEnvironment({"Server_Workload": 50}, {"avg_P_ac": 6}, max_steps=10)
print("Creating agent...")
agent = CoolingPPOAgent(env)
print("Loading model...")
agent.load("models_rl/ppo_cooling_agent.zip")
print("Done!")
