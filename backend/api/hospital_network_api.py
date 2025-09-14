from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta
from enum import Enum

from services.hospital_network import (
    HospitalNetworkService, HospitalInfo, InventoryRequest,
    SupplyOffer, UrgencyLevel
)
from ml_models.network_demand_predictor import NetworkDemandPredictor

router = APIRouter(prefix="/network", tags=["Hospital Network"])

# Initialize services (in production, these would be dependency-injected)
import os
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "demo-mode-no-api-key")

# Initialize services with graceful fallback
try:
    network_service = HospitalNetworkService(GOOGLE_MAPS_API_KEY)
    print("✅ Network service initialized successfully")
except Exception as e:
    print(f"Warning: Hospital network service failed: {e}")
    network_service = None

try:
    network_predictor = NetworkDemandPredictor(GOOGLE_MAPS_API_KEY)
    print("✅ Network predictor initialized successfully")
except Exception as e:
    print(f"Warning: Network predictor failed: {e}")
    network_predictor = None

# Pydantic models for API
class LocationInput(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")

class HospitalDiscoveryRequest(BaseModel):
    location: LocationInput
    radius_km: int = Field(50, ge=1, le=100, description="Search radius in kilometers")

class EmergencySupplyRequest(BaseModel):
    item_name: str = Field(..., description="Name of the medical item needed")
    quantity_needed: int = Field(..., gt=0, description="Quantity required")
    urgency_level: UrgencyLevel = Field(default=UrgencyLevel.MEDIUM)
    medical_reason: str = Field(..., description="Medical justification for the request")
    deadline: datetime = Field(..., description="When the supply is needed by")
    contact_info: str = Field(..., description="Contact information for coordination")
    requester_location: LocationInput

class NetworkForecastRequest(BaseModel):
    item_name: str
    days_ahead: int = Field(30, ge=1, le=90)
    include_network_analysis: bool = True

class SupplyOfferResponse(BaseModel):
    hospital_name: str
    hospital_phone: str
    hospital_address: str
    quantity_available: int
    cost_per_unit: float
    distance_km: float
    pickup_instructions: str
    valid_until: datetime

class NetworkInsights(BaseModel):
    network_status: str
    shortage_risk: str
    supply_chain_health: str
    recommendations: List[str]

class NetworkForecastResponse(BaseModel):
    item_name: str
    predicted_demand: int
    confidence_lower: int
    confidence_upper: int
    forecast_period_days: int
    network_insights: NetworkInsights
    risk_factors: List[str]
    supply_recommendations: List[str]
    generated_at: datetime

@router.get("/discover-hospitals",
           summary="Discover nearby hospitals",
           description="Find hospitals within specified radius using Google Maps API")
async def discover_nearby_hospitals(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius_km: int = Query(50, ge=1, le=100, description="Search radius in km")
) -> List[Dict]:
    """Discover hospitals near given coordinates"""
    if not network_service:
        raise HTTPException(status_code=503, detail="Hospital network service unavailable")

    try:
        hospitals = network_service.discover_nearby_hospitals(lat, lng, radius_km)

        return [
            {
                "id": hospital.id,
                "name": hospital.name,
                "address": hospital.address,
                "latitude": hospital.latitude,
                "longitude": hospital.longitude,
                "phone": hospital.phone,
                "capacity_rating": hospital.capacity_rating,
                "distance_km": network_service._calculate_distance(lat, lng, hospital.latitude, hospital.longitude)
            }
            for hospital in hospitals
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error discovering hospitals: {str(e)}")

@router.get("/network-status/{item_name}",
           summary="Get network status for specific item",
           description="Get current network-wide inventory status and trends")
async def get_network_status(
    item_name: str,
    lat: float = Query(..., description="Hospital latitude"),
    lng: float = Query(..., description="Hospital longitude"),
    radius_km: int = Query(50, description="Network radius in km")
) -> Dict:
    """Get network-wide status for a specific inventory item"""
    try:
        # Discover hospitals in network
        hospitals = network_service.discover_nearby_hospitals(lat, lng, radius_km)

        if not hospitals:
            return {
                "item_name": item_name,
                "network_status": "no_network_found",
                "message": "No hospitals found in specified radius"
            }

        # Get network inventory data
        network_data = network_service.get_network_inventory_data(hospitals)

        # Extract item-specific information
        item_status = {
            "item_name": item_name,
            "hospitals_in_network": len(hospitals),
            "total_network_stock": 0,
            "hospitals_with_stock": 0,
            "hospitals_with_shortages": 0,
            "hospitals_with_surplus": 0,
            "average_stock_per_hospital": 0,
            "shortage_alerts": [],
            "surplus_opportunities": []
        }

        if item_name in network_data.get('aggregate_inventory', {}):
            agg_data = network_data['aggregate_inventory'][item_name]
            item_status.update({
                "total_network_stock": agg_data['total_stock'],
                "hospitals_with_stock": agg_data['hospitals_with_stock'],
                "average_stock_per_hospital": agg_data['average_stock_per_hospital']
            })

        # Get shortage alerts for this item
        item_status["shortage_alerts"] = [
            alert for alert in network_data.get('shortage_alerts', [])
            if alert['item'] == item_name
        ]

        # Get surplus opportunities for this item
        item_status["surplus_opportunities"] = [
            surplus for surplus in network_data.get('surplus_items', [])
            if surplus['item'] == item_name
        ]

        item_status["hospitals_with_shortages"] = len(item_status["shortage_alerts"])
        item_status["hospitals_with_surplus"] = len(item_status["surplus_opportunities"])

        return item_status

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting network status: {str(e)}")

@router.post("/emergency-request",
            summary="Create emergency supply request",
            description="Request emergency supplies with intelligent matching and priority routing")
async def create_emergency_request(request: EmergencySupplyRequest) -> Dict:
    """Create an enhanced emergency supply request to the hospital network with intelligent matching"""
    if not network_service:
        raise HTTPException(status_code=503, detail="Hospital network service unavailable")

    try:
        # Convert Pydantic models to service objects
        inventory_request = InventoryRequest(
            item_name=request.item_name,
            quantity_needed=request.quantity_needed,
            urgency_level=request.urgency_level,
            requesting_hospital_id="current_hospital",  # Would be determined from authentication
            medical_reason=request.medical_reason,
            deadline=request.deadline,
            contact_info=request.contact_info
        )

        requester_location = (request.requester_location.latitude, request.requester_location.longitude)

        # Create enhanced supply request with priority routing
        result = network_service.create_supply_request(inventory_request, requester_location)

        # Convert offers to enhanced response format
        offer_responses = []
        for offer in result.get('offers', []):
            # Get hospital info from network service
            hospital_id = offer.get('hospital_id', '')
            hospital = network_service.hospitals.get(hospital_id) if hospital_id else None

            offer_responses.append(SupplyOfferResponse(
                hospital_name=offer.get('hospital_name', 'Unknown Hospital'),
                hospital_phone=offer.get('contact_info', hospital.phone if hospital else 'Contact through system'),
                hospital_address=hospital.address if hospital else 'Retrieved from system',
                quantity_available=offer['quantity'],
                cost_per_unit=offer['cost_per_unit'],
                distance_km=offer['distance_km'],
                pickup_instructions=f"Contact {offer.get('contact_info', 'hospital')} - {'Emergency Protocol Active' if request.urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH] else 'for pickup coordination'}",
                valid_until=datetime.now() + timedelta(hours=48 if request.urgency_level == UrgencyLevel.CRITICAL else 24)
            ))

        # Enhanced response with automatic matching results
        response_data = {
            "request_id": result['request_id'],
            "status": result['status'],
            "priority_level": result.get('priority_level', request.urgency_level.value),
            "emergency_protocols_activated": result.get('emergency_protocols_activated', False),
            "network_coverage": result.get('network_coverage', 0.0),
            "potential_suppliers": result['potential_suppliers'],
            "estimated_fulfillment_time": result['estimated_fulfillment_time'],
            "next_update_eta": result.get('next_update_eta', datetime.now() + timedelta(minutes=30)),
            "offers": offer_responses
        }

        # Add automatic matching results if available
        if 'auto_matches' in result and result['auto_matches']:
            response_data['auto_matches'] = result['auto_matches']
            response_data['message'] = f"🚨 CRITICAL REQUEST: {len(result['auto_matches'])} supplies auto-reserved. {len(offer_responses)} total options available."
        else:
            urgency_messages = {
                UrgencyLevel.CRITICAL: f"🚨 CRITICAL: {len(offer_responses)} emergency suppliers found.",
                UrgencyLevel.HIGH: f"⚠️ HIGH PRIORITY: {len(offer_responses)} suppliers located.",
                UrgencyLevel.MEDIUM: f"📋 MEDIUM: {len(offer_responses)} suppliers available.",
                UrgencyLevel.LOW: f"📝 {len(offer_responses)} potential suppliers found."
            }
            response_data['message'] = urgency_messages.get(request.urgency_level,
                                                          f"Emergency request created. {len(offer_responses)} suppliers found.")

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating emergency request: {str(e)}")

@router.get("/supply-sources/{item_name}",
           summary="Find supply sources",
           description="Find hospitals that can provide specific inventory items")
async def find_supply_sources(
    item_name: str,
    quantity_needed: int = Query(..., gt=0),
    lat: float = Query(..., description="Requester latitude"),
    lng: float = Query(..., description="Requester longitude"),
    max_distance_km: int = Query(100, description="Maximum distance to search")
) -> List[SupplyOfferResponse]:
    """Find hospitals that can supply needed inventory items"""
    try:
        requester_location = (lat, lng)

        # Find supply sources
        offers = network_service.find_supply_sources(
            item_name, quantity_needed, requester_location
        )

        # Filter by distance and convert to response format
        filtered_offers = []
        for offer in offers:
            # Calculate distance to offering hospital
            offering_hospital = network_service.hospitals.get(offer.offering_hospital_id)
            if not offering_hospital:
                continue

            distance = network_service._calculate_distance(
                lat, lng, offering_hospital.latitude, offering_hospital.longitude
            )

            if distance <= max_distance_km:
                filtered_offers.append(SupplyOfferResponse(
                    hospital_name=offering_hospital.name,
                    hospital_phone=offering_hospital.phone,
                    hospital_address=offering_hospital.address,
                    quantity_available=offer.quantity_available,
                    cost_per_unit=offer.cost_per_unit,
                    distance_km=distance,
                    pickup_instructions=offer.pickup_instructions,
                    valid_until=offer.valid_until
                ))

        return filtered_offers

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding supply sources: {str(e)}")

@router.post("/network-forecast",
            summary="Get network-enhanced demand forecast",
            description="Generate demand forecast using hospital network data")
async def get_network_forecast(request: NetworkForecastRequest) -> NetworkForecastResponse:
    """Get demand forecast enhanced with hospital network intelligence"""
    try:
        # Generate network-enhanced prediction
        prediction = network_predictor.predict_network_demand(
            request.item_name,
            request.days_ahead
        )

        # Convert to response format
        return NetworkForecastResponse(
            item_name=request.item_name,
            predicted_demand=prediction['demand'],
            confidence_lower=prediction['confidence']['lower'],
            confidence_upper=prediction['confidence']['upper'],
            forecast_period_days=request.days_ahead,
            network_insights=NetworkInsights(**prediction['network_insights']),
            risk_factors=prediction['risk_factors'],
            supply_recommendations=prediction['supply_recommendations'],
            generated_at=datetime.now()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating network forecast: {str(e)}")

@router.get("/network-map",
           summary="Get network visualization data",
           description="Get data for displaying hospital network on map")
async def get_network_map(
    center_lat: float = Query(..., description="Map center latitude"),
    center_lng: float = Query(..., description="Map center longitude"),
    radius_km: int = Query(50, description="Network radius"),
    item_name: Optional[str] = Query(None, description="Filter by specific item")
) -> Dict:
    """Get hospital network data for map visualization"""
    try:
        # Discover hospitals
        hospitals = network_service.discover_nearby_hospitals(center_lat, center_lng, radius_km)

        if not hospitals:
            return {
                "center": {"lat": center_lat, "lng": center_lng},
                "hospitals": [],
                "network_stats": {"total_hospitals": 0}
            }

        # Get network inventory data
        network_data = network_service.get_network_inventory_data(hospitals)

        # Prepare hospital data for map
        hospital_markers = []
        for hospital in hospitals:
            marker_data = {
                "id": hospital.id,
                "name": hospital.name,
                "position": {"lat": hospital.latitude, "lng": hospital.longitude},
                "address": hospital.address,
                "phone": hospital.phone,
                "capacity_rating": hospital.capacity_rating,
                "status": "normal"  # Default status
            }

            # Add status based on shortages/surplus if item specified
            if item_name:
                # Check if hospital has shortages for this item
                hospital_shortages = [
                    alert for alert in network_data.get('shortage_alerts', [])
                    if alert.get('hospital') == hospital.name and alert.get('item') == item_name
                ]

                hospital_surplus = [
                    surplus for surplus in network_data.get('surplus_items', [])
                    if surplus.get('hospital') == hospital.name and surplus.get('item') == item_name
                ]

                if hospital_shortages:
                    marker_data["status"] = "shortage"
                elif hospital_surplus:
                    marker_data["status"] = "surplus"

            hospital_markers.append(marker_data)

        # Network statistics
        network_stats = {
            "total_hospitals": len(hospitals),
            "hospitals_with_shortages": len(set(alert.get('hospital') for alert in network_data.get('shortage_alerts', []))),
            "hospitals_with_surplus": len(set(surplus.get('hospital') for surplus in network_data.get('surplus_items', [])))
        }

        if item_name and item_name in network_data.get('aggregate_inventory', {}):
            agg_data = network_data['aggregate_inventory'][item_name]
            network_stats[f"{item_name}_total_stock"] = agg_data.get('total_stock', 0)
            network_stats[f"{item_name}_avg_per_hospital"] = agg_data.get('average_stock_per_hospital', 0)

        return {
            "center": {"lat": center_lat, "lng": center_lng},
            "radius_km": radius_km,
            "hospitals": hospital_markers,
            "network_stats": network_stats,
            "shortage_alerts": network_data.get('shortage_alerts', []) if item_name else [],
            "surplus_opportunities": network_data.get('surplus_items', []) if item_name else []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating network map data: {str(e)}")

@router.get("/health",
           summary="Network service health check")
async def health_check():
    """Health check endpoint for network services"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "services": {
            "google_maps": "configured" if GOOGLE_MAPS_API_KEY != "your-google-maps-api-key" else "needs_configuration",
            "network_predictor": "available",
            "hospital_discovery": "available"
        }
    }