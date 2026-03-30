import json
import os
from datetime import datetime, timezone
import google.generativeai as genai
from typing import List, Dict, Any

class MultiAgentSystem:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    async def analyze_impact_zones(self, incidents: List[Dict], active_events: List[Dict]) -> List[Dict]:
        """
        Predictive Agent: Analyzes incident clusters and disaster events to predict high-risk zones.
        """
        prompt = f"""
        You are a Disaster Impact Analyst Agent. 
        Current Incidents: {json.dumps(incidents[:10])}
        Active Disaster Events: {json.dumps(active_events)}

        Based on the types of incidents (flood, fire, etc.) and their locations (lat/lng), predict 2-3 'Impact Zones' where the disaster might spread within the next 4 hours.
        Return a JSON list of objects with:
        - "name": Descriptive name (e.g., "North River Flood Expansion")
        - "type": "unsafe" or "evacuation"
        - "lat": Predicted center latitude
        - "lng": Predicted center longitude
        - "radius_km": Impact radius
        - "reason": Why this zone was predicted (e.g., "clustering of medical incidents suggests gas leak spread")

        Respond ONLY with valid JSON.
        """
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Impact Agent Error: {e}")
            return []

    async def optimize_allocations(self, incidents: List[Dict], resources: List[Dict], predicted_zones: List[Dict]) -> Dict:
        """
        Strategic Resource Agent: Recommends resource movements based on predicted impact.
        """
        prompt = f"""
        You are a Strategic Resource Allocation Agent.
        Incidents: {json.dumps(incidents[:10])}
        Resources: {json.dumps(resources[:10])}
        Predicted Impact Zones: {json.dumps(predicted_zones)}

        Analyze the current state and provide a 'Strategic Recommendation'.
        Identify which incidents should be prioritized and if any resources should be preemptively moved closer to 'Predicted Impact Zones'.
        
        Return a JSON object with:
        - "priority_actions": List of strings (e.g., "Move Fire Truck 7 to Zone B")
        - "risk_summary": Brief summary of resource gaps
        - "efficiency_score": 0-100 rating of current deployment
        
        Respond ONLY with valid JSON.
        """
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Resource Agent Error: {e}")
            return {"priority_actions": [], "risk_summary": "Error in agent analysis", "efficiency_score": 0}

    async def run_coordination_cycle(self, incidents: List[Dict], resources: List[Dict], active_events: List[Dict]) -> Dict:
        """
        Orchestrator Agent: Runs the full multi-agent workflow.
        """
        print("Starting Multi-Agent Coordination Cycle...")
        
        # 1. Prediction Phase
        predicted_zones = await self.analyze_impact_zones(incidents, active_events)
        
        # 2. Strategy Phase
        strategy = await self.optimize_allocations(incidents, resources, predicted_zones)
        
        # 3. Final Report
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "predicted_impact_zones": predicted_zones,
            "strategic_recommendation": strategy,
            "status": "completed"
        }
