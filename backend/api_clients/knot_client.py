import httpx
import os
from datetime import datetime, timedelta
import asyncio
from typing import Dict, List
import json

class KnotClient:
    def __init__(self):
        self.api_key = os.getenv("KNOT_API_KEY", "demo_key")
        self.base_url = "https://api.knotapi.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def get_purchase_data(self) -> Dict:
        """
        Fetch healthcare purchase data from Knot API (TransactionLink)
        In demo mode, returns mock data that resembles actual healthcare spend
        """
        try:
            if self.api_key == "demo_key":
                return self._get_mock_purchase_data()

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transactions",
                    headers=self.headers,
                    params={
                        "category": "healthcare",
                        "merchant": "medical_supplies",
                        "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
                        "end_date": datetime.now().isoformat()
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return self._process_transaction_data(data)
                else:
                    print(f"Knot API error: {response.status_code}")
                    return self._get_mock_purchase_data()

        except Exception as e:
            print(f"Error fetching Knot data: {e}")
            return self._get_mock_purchase_data()

    def _get_mock_purchase_data(self) -> Dict:
        """
        Mock data representing healthcare purchases that would come from Knot API
        """
        purchases = [
            {
                "transaction_id": "knt_001",
                "merchant": "MedSupply Co",
                "category": "PPE",
                "amount": 1250.00,
                "quantity": 500,
                "item_description": "N95 Masks - Industrial Grade",
                "date": (datetime.now() - timedelta(days=5)).isoformat(),
                "payment_method": "corporate_card"
            },
            {
                "transaction_id": "knt_002",
                "merchant": "SafeHands Inc",
                "category": "PPE",
                "amount": 336.00,
                "quantity": 960,
                "item_description": "Nitrile Surgical Gloves - Box of 100",
                "date": (datetime.now() - timedelta(days=8)).isoformat(),
                "payment_method": "corporate_card"
            },
            {
                "transaction_id": "knt_003",
                "merchant": "PharmaCorp",
                "category": "Medication",
                "amount": 89.50,
                "quantity": 500,
                "item_description": "Acetaminophen 500mg Tablets",
                "date": (datetime.now() - timedelta(days=12)).isoformat(),
                "payment_method": "purchase_order"
            },
            {
                "transaction_id": "knt_004",
                "merchant": "MedEquip Ltd",
                "category": "General Supplies",
                "amount": 256.00,
                "quantity": 3200,
                "item_description": "Disposable Syringes 5ml",
                "date": (datetime.now() - timedelta(days=15)).isoformat(),
                "payment_method": "corporate_card"
            },
            {
                "transaction_id": "knt_005",
                "merchant": "FluidTech",
                "category": "General Supplies",
                "amount": 562.50,
                "quantity": 45,
                "item_description": "0.9% Saline IV Bags 250ml",
                "date": (datetime.now() - timedelta(days=18)).isoformat(),
                "payment_method": "purchase_order"
            },
            {
                "transaction_id": "knt_006",
                "merchant": "CleanCorp",
                "category": "PPE",
                "amount": 179.80,
                "quantity": 20,
                "item_description": "Hand Sanitizer 16oz Bottles",
                "date": (datetime.now() - timedelta(days=22)).isoformat(),
                "payment_method": "corporate_card"
            },
            {
                "transaction_id": "knt_007",
                "merchant": "FirstAid Pro",
                "category": "General Supplies",
                "amount": 135.00,
                "quantity": 300,
                "item_description": "Sterile Gauze Bandages",
                "date": (datetime.now() - timedelta(days=25)).isoformat(),
                "payment_method": "corporate_card"
            },
            {
                "transaction_id": "knt_008",
                "merchant": "MediCare Supply",
                "category": "Medication",
                "amount": 68.20,
                "quantity": 310,
                "item_description": "Ibuprofen 200mg Tablets",
                "date": (datetime.now() - timedelta(days=28)).isoformat(),
                "payment_method": "purchase_order"
            }
        ]

        category_breakdown = {}
        total_amount = 0

        for purchase in purchases:
            category = purchase["category"]
            amount = purchase["amount"]

            if category not in category_breakdown:
                category_breakdown[category] = {
                    "total_amount": 0,
                    "transaction_count": 0,
                    "average_transaction": 0
                }

            category_breakdown[category]["total_amount"] += amount
            category_breakdown[category]["transaction_count"] += 1
            total_amount += amount

        for category in category_breakdown:
            category_breakdown[category]["average_transaction"] = (
                category_breakdown[category]["total_amount"] /
                category_breakdown[category]["transaction_count"]
            )

        return {
            "purchases": purchases,
            "category_breakdown": category_breakdown,
            "total_spend": total_amount,
            "period": "last_30_days",
            "currency": "USD"
        }

    def _process_transaction_data(self, raw_data: Dict) -> Dict:
        """
        Process raw transaction data from Knot API into structured format
        """
        processed_purchases = []
        category_breakdown = {}

        for transaction in raw_data.get("transactions", []):
            processed_purchase = {
                "transaction_id": transaction.get("id"),
                "merchant": transaction.get("merchant_name"),
                "category": self._categorize_transaction(transaction),
                "amount": float(transaction.get("amount", 0)),
                "item_description": transaction.get("description"),
                "date": transaction.get("transaction_date"),
                "payment_method": transaction.get("payment_method")
            }
            processed_purchases.append(processed_purchase)

            category = processed_purchase["category"]
            if category not in category_breakdown:
                category_breakdown[category] = {
                    "total_amount": 0,
                    "transaction_count": 0
                }

            category_breakdown[category]["total_amount"] += processed_purchase["amount"]
            category_breakdown[category]["transaction_count"] += 1

        return {
            "purchases": processed_purchases,
            "category_breakdown": category_breakdown,
            "total_spend": sum(p["amount"] for p in processed_purchases),
            "period": "api_retrieved",
            "currency": "USD"
        }

    def _categorize_transaction(self, transaction: Dict) -> str:
        """
        Categorize transactions based on merchant and description
        """
        description = transaction.get("description", "").lower()
        merchant = transaction.get("merchant_name", "").lower()

        if any(keyword in description or keyword in merchant
               for keyword in ["mask", "glove", "sanitizer", "ppe", "protective"]):
            return "PPE"
        elif any(keyword in description or keyword in merchant
                 for keyword in ["medication", "drug", "pharmacy", "medicine", "pill", "tablet"]):
            return "Medication"
        else:
            return "General Supplies"

    async def get_vendor_analysis(self) -> Dict:
        """
        Analyze vendor relationships and spending patterns
        """
        purchase_data = await self.get_purchase_data()

        vendor_analysis = {}
        for purchase in purchase_data["purchases"]:
            vendor = purchase["merchant"]
            if vendor not in vendor_analysis:
                vendor_analysis[vendor] = {
                    "total_spend": 0,
                    "transaction_count": 0,
                    "categories": set(),
                    "avg_transaction_size": 0
                }

            vendor_analysis[vendor]["total_spend"] += purchase["amount"]
            vendor_analysis[vendor]["transaction_count"] += 1
            vendor_analysis[vendor]["categories"].add(purchase["category"])

        for vendor in vendor_analysis:
            vendor_analysis[vendor]["avg_transaction_size"] = (
                vendor_analysis[vendor]["total_spend"] /
                vendor_analysis[vendor]["transaction_count"]
            )
            vendor_analysis[vendor]["categories"] = list(vendor_analysis[vendor]["categories"])

        return {
            "vendor_analysis": vendor_analysis,
            "top_vendors": sorted(
                vendor_analysis.items(),
                key=lambda x: x[1]["total_spend"],
                reverse=True
            )[:5]
        }

    async def calculate_savings_opportunities(self) -> Dict:
        """
        Calculate potential savings based on purchase patterns and market data
        """
        purchase_data = await self.get_purchase_data()
        vendor_data = await self.get_vendor_analysis()

        savings_opportunities = []

        for category, data in purchase_data["category_breakdown"].items():
            if data["transaction_count"] > 1:
                potential_bulk_savings = data["total_amount"] * 0.08

                savings_opportunities.append({
                    "category": category,
                    "opportunity_type": "bulk_discount",
                    "current_spend": data["total_amount"],
                    "potential_savings": potential_bulk_savings,
                    "recommendation": f"Consolidate {category} purchases for bulk pricing"
                })

        for vendor, data in vendor_data["vendor_analysis"].items():
            if data["transaction_count"] >= 3:
                contract_savings = data["total_spend"] * 0.12

                savings_opportunities.append({
                    "vendor": vendor,
                    "opportunity_type": "contract_negotiation",
                    "current_spend": data["total_spend"],
                    "potential_savings": contract_savings,
                    "recommendation": f"Negotiate annual contract with {vendor}"
                })

        total_potential_savings = sum(opp["potential_savings"] for opp in savings_opportunities)

        return {
            "opportunities": savings_opportunities,
            "total_potential_savings": total_potential_savings,
            "current_total_spend": purchase_data["total_spend"],
            "potential_savings_percentage": (total_potential_savings / purchase_data["total_spend"]) * 100
        }