from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
from ml_models.demand_predictor import DemandPredictor
from api_clients.knot_client import KnotClient
from api_clients.cerebras_client import CerebrasClient
from database.db_manager import DatabaseManager
from import_manager import ImportManager
from api.hospital_network_api import router as network_router
from ai_agents.supply_chain_judge import SupplyChainJudge

app = FastAPI(title="Smart Healthcare Inventory Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include hospital network router
app.include_router(network_router)

db_manager = DatabaseManager()
demand_predictor = DemandPredictor()
knot_client = KnotClient()
cerebras_client = CerebrasClient()
import_manager = ImportManager()
ai_judge = SupplyChainJudge()

class PredictionRequest(BaseModel):
    item_name: str
    days_ahead: int = 30

class InventoryItem(BaseModel):
    item_name: str
    category: str
    current_stock: int
    min_stock_level: int
    max_stock_level: int
    cost_per_unit: float
    supplier: str
    expiration_risk: str

class ReorderSuggestion(BaseModel):
    item_name: str
    suggested_quantity: int
    reorder_date: str
    estimated_cost: float
    priority: str

class AIQuestionRequest(BaseModel):
    question: str
    context: dict = None

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

@app.get("/inventory")
async def get_inventory():
    """Get all inventory items"""
    try:
        inventory_data = db_manager.get_current_inventory()
        return {"inventory": inventory_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/inventory/{item_name}")
async def update_inventory_item(item_name: str, updates: dict):
    """Update an inventory item"""
    try:
        db_manager.update_inventory_item(item_name, updates)
        return {"message": f"Item '{item_name}' updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/inventory")
async def add_inventory_item(item: InventoryItem):
    """Add a new inventory item"""
    try:
        db_manager.add_inventory_item(item.dict())
        return {"message": f"Item '{item.item_name}' added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard_metrics")
async def get_dashboard_metrics():
    try:
        inventory_data = db_manager.get_current_inventory()
        total_items = sum(item["current_stock"] for item in inventory_data)  # Sum of all quantities, not count of categories
        low_stock_items = len([item for item in inventory_data if item["usage_rate"] > 0 and item["current_stock"] / item["usage_rate"] < 14])
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

@app.post("/import/inventory")
async def import_inventory_data(file: UploadFile = File(...)):
    """Import inventory data from CSV or Excel file"""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and Excel files are supported"
        )

    try:
        file_content = await file.read()
        result = import_manager.import_inventory_data(file_content, file.filename)

        if result.success:
            return {
                "success": True,
                "message": result.message,
                "import_id": result.import_id,
                "imported_records": result.imported_records,
                "failed_records": result.failed_records,
                "errors": result.errors
            }
        else:
            raise HTTPException(status_code=400, detail=result.message)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/usage")
async def import_usage_data(file: UploadFile = File(...)):
    """Import usage/prescription data from CSV or Excel file"""
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and Excel files are supported"
        )

    try:
        file_content = await file.read()
        result = import_manager.import_usage_data(file_content, file.filename)

        if result.success:
            return {
                "success": True,
                "message": result.message,
                "import_id": result.import_id,
                "imported_records": result.imported_records,
                "failed_records": result.failed_records,
                "errors": result.errors
            }
        else:
            raise HTTPException(status_code=400, detail=result.message)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/import/history")
async def get_import_history(limit: int = 50):
    """Get import history records"""
    try:
        history = import_manager.get_import_history(limit)
        return {"imports": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/import/status/{import_id}")
async def get_import_status(import_id: str):
    """Get status of specific import"""
    try:
        status = import_manager.get_import_status(import_id)
        if status:
            return status
        else:
            raise HTTPException(status_code=404, detail="Import not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/import/templates")
async def get_import_templates():
    """Get sample CSV templates for data import"""
    inventory_template = {
        "filename": "inventory_template.csv",
        "headers": ["item_name", "category", "number_items", "min_stock_level",
                   "max_stock_level", "cost_per_unit", "supplier", "expiration_risk"],
        "sample_data": [
            {
                "item_name": "N95 Masks",
                "category": "PPE",
                "number_items": 500,
                "min_stock_level": 100,
                "max_stock_level": 1000,
                "cost_per_unit": 2.50,
                "supplier": "MedSupply Co",
                "expiration_risk": "Low"
            }
        ]
    }

    usage_template = {
        "filename": "usage_template.csv",
        "headers": ["item_name", "quantity_used", "usage_date", "department",
                   "patient_id", "prescription_id", "notes"],
        "sample_data": [
            {
                "item_name": "N95 Masks",
                "quantity_used": 50,
                "usage_date": "2024-01-15",
                "department": "Emergency",
                "patient_id": "P001",
                "prescription_id": "",
                "notes": "Regular usage"
            }
        ]
    }

    return {
        "templates": {
            "inventory": inventory_template,
            "usage": usage_template
        }
    }

@app.get("/analytics/usage_trends")
async def get_usage_trends(
    start_date: str = None,
    end_date: str = None,
    aggregation: str = "day",
    items: str = None
):
    """Get usage trends data with timeline filtering and aggregation"""
    try:
        # Parse parameters
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()

        item_filter = items.split(',') if items else None

        # Get usage data with aggregation
        usage_data = db_manager.get_usage_trends(
            start_date=start_date,
            end_date=end_date,
            aggregation_level=aggregation,
            item_filter=item_filter
        )

        return {
            "data": usage_data,
            "metadata": {
                "start_date": start_date,
                "end_date": end_date,
                "aggregation": aggregation,
                "total_records": len(usage_data),
                "items_included": item_filter or "all"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/demand_forecast")
async def get_demand_forecast(
    item_name: str,
    start_date: str = None,
    end_date: str = None,
    confidence_intervals: bool = True
):
    """Get demand forecast data with confidence intervals"""
    try:
        if not start_date:
            start_date = datetime.now().isoformat()
        if not end_date:
            # Default to 90 days ahead
            end_date = (datetime.now() + timedelta(days=90)).isoformat()

        # Calculate days between dates
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        days_ahead = (end - start).days

        # Get prediction
        prediction = demand_predictor.predict_demand(item_name, days_ahead)

        # Generate forecast timeline
        forecast_data = []
        current_date = start
        daily_demand = prediction["demand"] / days_ahead if days_ahead > 0 else 0

        for day in range(days_ahead):
            date_str = (current_date + timedelta(days=day)).strftime('%Y-%m-%d')

            # Add some realistic variance
            import random
            variance = daily_demand * 0.2 * random.uniform(-1, 1)

            forecast_data.append({
                "date": date_str,
                "predicted_demand": max(0, daily_demand + variance),
                "confidence_lower": max(0, daily_demand - abs(variance) * 1.5) if confidence_intervals else None,
                "confidence_upper": daily_demand + abs(variance) * 1.5 if confidence_intervals else None
            })

        return {
            "item_name": item_name,
            "forecast": forecast_data,
            "total_predicted_demand": prediction["demand"],
            "confidence": prediction["confidence"],
            "metadata": {
                "start_date": start_date,
                "end_date": end_date,
                "forecast_days": days_ahead,
                "model_type": "hybrid_prophet_rf"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai_judge/emergency_alerts")
async def get_emergency_alerts():
    """Get urgent emergency purchase alerts for the front page"""
    try:
        inventory_data = db_manager.get_current_inventory()
        emergency_alerts = []

        for item in inventory_data:
            # Get usage trends for the item
            usage_trends = db_manager.get_usage_trends(
                start_date=(datetime.now() - timedelta(days=30)).isoformat(),
                end_date=datetime.now().isoformat(),
                item_filter=[item['item_name']]
            )

            # Get prediction
            try:
                prediction = demand_predictor.predict_demand(item['item_name'], 30)
            except:
                prediction = {"demand": 0, "confidence": [0, 0]}

            # Evaluate emergency status
            evaluation = ai_judge.evaluate_emergency_purchase(
                item_data=item,
                usage_trends=usage_trends,
                predictions=prediction,
                external_context={"normal_conditions": True}
            )

            # Only include EMERGENCY and URGENT items
            if evaluation["decision"] in ["EMERGENCY", "URGENT"]:
                emergency_alerts.append({
                    "item_name": item["item_name"],
                    "decision": evaluation["decision"],
                    "score": evaluation["score"],
                    "confidence": evaluation["confidence"],
                    "rationale": evaluation["rationale"],
                    "action_required": evaluation["action_required"],
                    "timeline": evaluation["timeline"]
                })

        # Sort by urgency (EMERGENCY first, then by score)
        emergency_alerts.sort(key=lambda x: (x["decision"] != "EMERGENCY", -x["score"]))

        return {
            "emergency_alerts": emergency_alerts,
            "alert_count": len(emergency_alerts),
            "has_critical": any(alert["decision"] == "EMERGENCY" for alert in emergency_alerts),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai_judge/evaluate_item")
async def evaluate_item_emergency(item_name: str):
    """Evaluate a specific item for emergency purchase necessity"""
    try:
        # Get item data
        inventory_data = db_manager.get_current_inventory()
        item_data = next((item for item in inventory_data if item['item_name'].lower() == item_name.lower()), None)

        if not item_data:
            raise HTTPException(status_code=404, detail=f"Item '{item_name}' not found in inventory")

        # Get usage trends
        usage_trends = db_manager.get_usage_trends(
            start_date=(datetime.now() - timedelta(days=30)).isoformat(),
            end_date=datetime.now().isoformat(),
            item_filter=[item_name]
        )

        # Get prediction
        try:
            prediction = demand_predictor.predict_demand(item_name, 30)
        except:
            prediction = {"demand": 0, "confidence": [0, 0]}

        # Evaluate
        evaluation = ai_judge.evaluate_emergency_purchase(
            item_data=item_data,
            usage_trends=usage_trends,
            predictions=prediction,
            external_context={"normal_conditions": True}
        )

        return evaluation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai_judge/ask_question")
async def ask_ai_judge(request: AIQuestionRequest):
    """Ask the AI Judge a question about supply chain, predictions, or dashboard data"""
    try:
        # Gather context data
        context_data = {}

        # Add inventory data
        try:
            context_data['inventory'] = db_manager.get_current_inventory()
        except:
            context_data['inventory'] = []

        # Add usage trends
        try:
            context_data['usage_trends'] = db_manager.get_usage_trends(
                start_date=(datetime.now() - timedelta(days=30)).isoformat(),
                end_date=datetime.now().isoformat()
            )
        except:
            context_data['usage_trends'] = []

        # Add budget data
        try:
            knot_data = await knot_client.get_purchase_data()
            usage_analytics = db_manager.get_usage_analytics()
            context_data['budget_impact'] = {
                'total_monthly_spend': sum(purchase["amount"] for purchase in knot_data["purchases"]),
                'waste_cost': sum(item["waste_cost"] for item in usage_analytics["waste_analysis"]),
                'potential_savings': sum(item["potential_savings"] for item in usage_analytics["optimization_opportunities"])
            }
        except:
            context_data['budget_impact'] = {}

        # Add any user-provided context
        if request.context:
            context_data.update(request.context)

        # Get response from AI Judge
        response = ai_judge.ask_question(request.question, context_data)

        return {
            "question": request.question,
            "response": response["response"],
            "confidence": response["confidence"],
            "response_type": response["response_type"],
            "actionable": response.get("actionable", False),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai_judge/constitution")
async def get_ai_judge_constitution():
    """Get the AI Judge's constitution and rules"""
    return {
        "constitution": ai_judge.constitution,
        "version": "1.0",
        "last_updated": "2025-01-01"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)