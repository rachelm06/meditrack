from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from ml_models.demand_predictor import DemandPredictor
from api_clients.knot_client import KnotClient
from api_clients.cerebras_client import CerebrasClient
from database.db_manager import DatabaseManager

app = FastAPI(title="Smart Healthcare Inventory Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_manager = DatabaseManager()
demand_predictor = DemandPredictor()
knot_client = KnotClient()
cerebras_client = CerebrasClient()

class PredictionRequest(BaseModel):
    item_name: str
    days_ahead: int = 30

class InventoryItem(BaseModel):
    item_name: str
    category: str
    current_stock: int
    usage_rate: float
    cost_per_unit: float

class ReorderSuggestion(BaseModel):
    item_name: str
    suggested_quantity: int
    reorder_date: str
    estimated_cost: float
    priority: str

@app.on_event("startup")
async def startup_event():
    db_manager.initialize_database()
    demand_predictor.load_or_train_model()

@app.get("/")
async def root():
    return {"message": "Smart Healthcare Inventory Dashboard API"}

@app.post("/predict_demand")
async def predict_demand(request: PredictionRequest):
    try:
        prediction = demand_predictor.predict_demand(
            item_name=request.item_name,
            days_ahead=request.days_ahead
        )
        return {
            "item_name": request.item_name,
            "predicted_demand": prediction["demand"],
            "confidence_interval": prediction["confidence"],
            "forecast_period": request.days_ahead
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/inventory_status")
async def get_inventory_status():
    try:
        inventory_data = db_manager.get_current_inventory()
        shortages = []
        reorder_suggestions = []

        for item in inventory_data:
            prediction = demand_predictor.predict_demand(item["item_name"], 30)
            days_until_depletion = item["current_stock"] / item["usage_rate"] if item["usage_rate"] > 0 else 999

            if days_until_depletion < 14:
                shortages.append({
                    "item_name": item["item_name"],
                    "category": item["category"],
                    "current_stock": item["current_stock"],
                    "days_until_depletion": round(days_until_depletion, 1),
                    "predicted_monthly_demand": prediction["demand"]
                })

            if days_until_depletion < 30:
                suggested_qty = max(int(prediction["demand"] * 1.2), item["current_stock"])
                reorder_date = datetime.now() + timedelta(days=max(0, days_until_depletion - 7))

                reorder_suggestions.append({
                    "item_name": item["item_name"],
                    "suggested_quantity": suggested_qty,
                    "reorder_date": reorder_date.strftime("%Y-%m-%d"),
                    "estimated_cost": suggested_qty * item["cost_per_unit"],
                    "priority": "High" if days_until_depletion < 7 else "Medium"
                })

        return {
            "predicted_shortages": shortages,
            "reorder_suggestions": reorder_suggestions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/budget_impact")
async def get_budget_impact():
    try:
        knot_data = await knot_client.get_purchase_data()
        usage_data = db_manager.get_usage_analytics()

        total_spend = sum(purchase["amount"] for purchase in knot_data["purchases"])
        waste_cost = sum(item["waste_cost"] for item in usage_data["waste_analysis"])
        potential_savings = sum(item["potential_savings"] for item in usage_data["optimization_opportunities"])

        return {
            "total_monthly_spend": total_spend,
            "waste_cost": waste_cost,
            "potential_savings": potential_savings,
            "optimized_budget": total_spend - waste_cost + potential_savings,
            "purchase_breakdown": knot_data["category_breakdown"],
            "waste_analysis": usage_data["waste_analysis"],
            "optimization_opportunities": usage_data["optimization_opportunities"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify_items")
async def classify_items():
    try:
        inventory_items = db_manager.get_all_inventory_items()
        classifications = await cerebras_client.classify_items(inventory_items)

        return {
            "total_items": len(inventory_items),
            "classifications": classifications,
            "processing_time": classifications.get("processing_time", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard_metrics")
async def get_dashboard_metrics():
    try:
        inventory_data = db_manager.get_current_inventory()
        total_items = len(inventory_data)
        low_stock_items = len([item for item in inventory_data if item["current_stock"] / item["usage_rate"] < 14])
        total_value = sum(item["current_stock"] * item["cost_per_unit"] for item in inventory_data)

        return {
            "total_items": total_items,
            "low_stock_items": low_stock_items,
            "total_inventory_value": total_value,
            "critical_alerts": low_stock_items,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)