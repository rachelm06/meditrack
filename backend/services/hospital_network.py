import googlemaps
import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import math
import os
from dataclasses import dataclass
from enum import Enum

class UrgencyLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class HospitalInfo:
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    phone: str
    network_endpoint: Optional[str] = None  # API endpoint for inventory sharing
    capacity_rating: Optional[int] = None  # 1-5 scale
    trauma_level: Optional[str] = None  # Level I, II, III, IV
    last_sync: Optional[datetime] = None

@dataclass
class InventoryRequest:
    item_name: str
    quantity_needed: int
    urgency_level: UrgencyLevel
    requesting_hospital_id: str
    medical_reason: str
    deadline: datetime
    contact_info: str

@dataclass
class SupplyOffer:
    item_name: str
    quantity_available: int
    offering_hospital_id: str
    expiration_date: Optional[datetime]
    cost_per_unit: float
    pickup_instructions: str
    valid_until: datetime

class HospitalNetworkService:
    def __init__(self, google_maps_api_key: str):
        """Initialize hospital network service with Google Maps integration"""
        self.api_key = google_maps_api_key
        self.hospitals = {}  # Cache of known hospitals
        self.network_radius_km = 50  # Default search radius in kilometers
        self.max_hospitals = 20  # Maximum hospitals to consider in network

        # Initialize Google Maps client if valid API key provided
        if google_maps_api_key and google_maps_api_key != "demo-mode-no-api-key" and google_maps_api_key != "your-google-maps-api-key-here":
            try:
                import googlemaps
                self.gmaps = googlemaps.Client(key=google_maps_api_key)
                print("✅ Google Maps API initialized successfully!")
                self.demo_mode = False
            except Exception as e:
                print(f"❌ Google Maps initialization failed: {e}")
                self.gmaps = None
                self.demo_mode = True
        else:
            self.gmaps = None
            self.demo_mode = True
            print("🔧 Running in demo mode - Google Maps features will use simulated data")

    def discover_nearby_hospitals(self, latitude: float, longitude: float,
                                radius_km: int = None) -> List[HospitalInfo]:
        """Discover hospitals near given coordinates using Google Places API"""
        if radius_km is None:
            radius_km = self.network_radius_km

        # Use demo data if no Google Maps API available
        if self.demo_mode or not self.gmaps:
            return self._generate_demo_hospitals(latitude, longitude, radius_km)

        try:
            # Search for hospitals within radius
            places_result = self.gmaps.places_nearby(
                location=(latitude, longitude),
                radius=radius_km * 1000,  # Convert km to meters
                type='hospital'
            )

            hospitals = []

            for place in places_result.get('results', []):
                # Get detailed information about each hospital
                place_details = self.gmaps.place(
                    place_id=place['place_id'],
                    fields=['name', 'formatted_address', 'geometry', 'formatted_phone_number', 'rating']
                )

                details = place_details.get('result', {})
                location = details.get('geometry', {}).get('location', {})

                hospital = HospitalInfo(
                    id=place['place_id'],
                    name=details.get('name', 'Unknown Hospital'),
                    address=details.get('formatted_address', ''),
                    latitude=location.get('lat', 0),
                    longitude=location.get('lng', 0),
                    phone=details.get('formatted_phone_number', ''),
                    capacity_rating=int(details.get('rating', 3))
                )

                hospitals.append(hospital)
                self.hospitals[hospital.id] = hospital

            return sorted(hospitals, key=lambda h: self._calculate_distance(
                latitude, longitude, h.latitude, h.longitude
            ))[:self.max_hospitals]

        except Exception as e:
            print(f"Error discovering hospitals: {e}")
            return self._generate_demo_hospitals(latitude, longitude, radius_km)

    def _generate_demo_hospitals(self, center_lat: float, center_lng: float, radius_km: int) -> List[HospitalInfo]:
        """Generate realistic NYC-area hospital data when Google Maps API is not available"""
        import random

        # Realistic NYC area hospital data based on actual hospitals
        nyc_hospitals = [
            # Manhattan hospitals
            {"name": "NewYork-Presbyterian Hospital", "lat": 40.7831, "lng": -73.9442, "address": "525 E 68th St, New York, NY 10065", "phone": "(212) 746-5454", "trauma": "Level I"},
            {"name": "Mount Sinai Hospital", "lat": 40.7905, "lng": -73.9527, "address": "1 Gustave L. Levy Pl, New York, NY 10029", "phone": "(212) 241-6500", "trauma": "Level I"},
            {"name": "NYU Langone Medical Center", "lat": 40.7392, "lng": -73.9732, "address": "550 1st Ave, New York, NY 10016", "phone": "(212) 263-7300", "trauma": "Level I"},
            {"name": "Bellevue Hospital", "lat": 40.7388, "lng": -73.9754, "address": "462 1st Ave, New York, NY 10016", "phone": "(212) 562-4141", "trauma": "Level I"},
            {"name": "Columbia Presbyterian Medical Center", "lat": 40.8424, "lng": -73.9441, "address": "622 W 168th St, New York, NY 10032", "phone": "(212) 305-2500", "trauma": "Level I"},
            {"name": "Memorial Sloan Kettering Cancer Center", "lat": 40.7635, "lng": -73.9538, "address": "1275 York Ave, New York, NY 10065", "phone": "(212) 639-2000", "trauma": "Level III"},
            {"name": "Hospital for Special Surgery", "lat": 40.7640, "lng": -73.9569, "address": "535 E 70th St, New York, NY 10021", "phone": "(212) 606-1000", "trauma": "Level III"},
            {"name": "Mount Sinai Beth Israel", "lat": 40.7338, "lng": -73.9869, "address": "281 1st Ave, New York, NY 10003", "phone": "(212) 420-2000", "trauma": "Level II"},
            {"name": "Mount Sinai West", "lat": 40.7698, "lng": -73.9879, "address": "1000 10th Ave, New York, NY 10019", "phone": "(212) 523-4000", "trauma": "Level II"},

            # Brooklyn hospitals
            {"name": "Brooklyn Methodist Hospital", "lat": 40.6736, "lng": -73.9865, "address": "506 6th St, Brooklyn, NY 11215", "phone": "(718) 780-3000", "trauma": "Level II"},
            {"name": "Kings County Hospital Center", "lat": 40.6593, "lng": -73.9443, "address": "451 Clarkson Ave, Brooklyn, NY 11203", "phone": "(718) 245-3131", "trauma": "Level I"},
            {"name": "Maimonides Medical Center", "lat": 40.6389, "lng": -73.9942, "address": "4802 10th Ave, Brooklyn, NY 11219", "phone": "(718) 283-6000", "trauma": "Level II"},
            {"name": "NYC Health + Hospitals/Coney Island", "lat": 40.5795, "lng": -73.9707, "address": "2601 Ocean Pkwy, Brooklyn, NY 11235", "phone": "(718) 616-3000", "trauma": "Level II"},

            # Queens hospitals
            {"name": "Jamaica Hospital Medical Center", "lat": 40.6996, "lng": -73.8067, "address": "8900 Van Wyck Expy, Jamaica, NY 11418", "phone": "(718) 206-6000", "trauma": "Level II"},
            {"name": "NewYork-Presbyterian Queens", "lat": 40.7437, "lng": -73.8273, "address": "56-45 Main St, Flushing, NY 11355", "phone": "(718) 670-1231", "trauma": "Level II"},
            {"name": "Elmhurst Hospital Center", "lat": 40.7442, "lng": -73.8822, "address": "79-01 Broadway, Elmhurst, NY 11373", "phone": "(718) 334-4000", "trauma": "Level I"},
            {"name": "St. Francis Hospital", "lat": 40.7892, "lng": -73.7269, "address": "100 Port Washington Blvd, Roslyn, NY 11576", "phone": "(516) 562-6000", "trauma": "Level III"},

            # Bronx hospitals
            {"name": "Bronx-Lebanon Hospital Center", "lat": 40.8393, "lng": -73.9167, "address": "1650 Selwyn Ave, Bronx, NY 10457", "phone": "(718) 590-1800", "trauma": "Level I"},
            {"name": "Montefiore Medical Center", "lat": 40.8736, "lng": -73.8781, "address": "111 E 210th St, Bronx, NY 10467", "phone": "(718) 920-4321", "trauma": "Level I"},
            {"name": "St. Barnabas Hospital", "lat": 40.8318, "lng": -73.8927, "address": "4422 3rd Ave, Bronx, NY 10457", "phone": "(718) 960-9000", "trauma": "Level II"},
            {"name": "NYC Health + Hospitals/Lincoln", "lat": 40.8185, "lng": -73.9249, "address": "234 E 149th St, Bronx, NY 10451", "phone": "(718) 579-5000", "trauma": "Level II"},

            # Staten Island hospitals
            {"name": "Staten Island University Hospital", "lat": 40.6063, "lng": -74.1181, "address": "475 Seaview Ave, Staten Island, NY 10305", "phone": "(718) 226-9000", "trauma": "Level I"},
            {"name": "Richmond University Medical Center", "lat": 40.6395, "lng": -74.1201, "address": "355 Bard Ave, Staten Island, NY 10310", "phone": "(718) 818-1234", "trauma": "Level II"},

            # New Jersey hospitals (close to NYC)
            {"name": "Jersey City Medical Center", "lat": 40.7178, "lng": -74.0431, "address": "355 Grand St, Jersey City, NJ 07302", "phone": "(201) 915-2000", "trauma": "Level II"},
            {"name": "Hackensack University Medical Center", "lat": 40.8859, "lng": -74.0434, "address": "30 Prospect Ave, Hackensack, NJ 07601", "phone": "(551) 996-2000", "trauma": "Level I"},
        ]

        hospitals = []
        for i, hospital_data in enumerate(nyc_hospitals):
            # Calculate distance from center point
            distance = self._calculate_distance(center_lat, center_lng, hospital_data["lat"], hospital_data["lng"])

            # Only include hospitals within the specified radius
            if distance <= radius_km and len(hospitals) < self.max_hospitals:
                hospital = HospitalInfo(
                    id=f"nyc_hospital_{i}",
                    name=hospital_data["name"],
                    address=hospital_data["address"],
                    latitude=hospital_data["lat"],
                    longitude=hospital_data["lng"],
                    phone=hospital_data["phone"],
                    capacity_rating=random.randint(4, 5),  # NYC hospitals tend to be high-capacity
                    trauma_level=hospital_data["trauma"]
                )
                hospitals.append(hospital)
                self.hospitals[hospital.id] = hospital

        # Sort by distance from center
        hospitals.sort(key=lambda h: self._calculate_distance(center_lat, center_lng, h.latitude, h.longitude))

        return hospitals

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in kilometers using Haversine formula"""
        R = 6371  # Earth's radius in kilometers

        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)

        a = (math.sin(dlat/2) * math.sin(dlat/2) +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon/2) * math.sin(dlon/2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c

    def get_network_inventory_data(self, hospital_list: List[HospitalInfo]) -> Dict:
        """Collect inventory data from networked hospitals"""
        network_data = {
            'hospitals': [],
            'aggregate_inventory': {},
            'shortage_alerts': [],
            'surplus_items': []
        }

        for hospital in hospital_list:
            try:
                # Simulate API call to hospital's inventory system
                # In real implementation, this would call each hospital's API endpoint
                hospital_inventory = self._simulate_hospital_inventory(hospital)

                network_data['hospitals'].append({
                    'hospital': hospital,
                    'inventory': hospital_inventory,
                    'last_updated': datetime.now()
                })

                # Aggregate inventory data
                for item_name, data in hospital_inventory.items():
                    if item_name not in network_data['aggregate_inventory']:
                        network_data['aggregate_inventory'][item_name] = {
                            'total_stock': 0,
                            'hospitals_with_stock': 0,
                            'average_stock_per_hospital': 0,
                            'critical_hospitals': 0
                        }

                    agg = network_data['aggregate_inventory'][item_name]
                    agg['total_stock'] += data['current_stock']
                    agg['hospitals_with_stock'] += 1 if data['current_stock'] > 0 else 0

                    # Check for critical shortage (below 20% of min stock)
                    if data['current_stock'] < data['min_stock_level'] * 0.2:
                        agg['critical_hospitals'] += 1
                        network_data['shortage_alerts'].append({
                            'hospital': hospital.name,
                            'item': item_name,
                            'current_stock': data['current_stock'],
                            'min_stock': data['min_stock_level'],
                            'urgency': 'critical'
                        })

                    # Check for surplus (above 150% of max stock)
                    if data['current_stock'] > data['max_stock_level'] * 1.5:
                        network_data['surplus_items'].append({
                            'hospital': hospital.name,
                            'item': item_name,
                            'surplus_quantity': data['current_stock'] - data['max_stock_level'],
                            'expiration_risk': data.get('expiration_risk', 'Unknown')
                        })

                # Calculate averages
                for item_name, agg in network_data['aggregate_inventory'].items():
                    if agg['hospitals_with_stock'] > 0:
                        agg['average_stock_per_hospital'] = agg['total_stock'] / len(hospital_list)

            except Exception as e:
                print(f"Error getting inventory from {hospital.name}: {e}")
                continue

        return network_data

    def _simulate_hospital_inventory(self, hospital: HospitalInfo) -> Dict:
        """Simulate hospital inventory data - in production, this would call real APIs"""
        import random

        # Common medical inventory items
        items = [
            'N95 Masks', 'Surgical Gloves', 'Hand Sanitizer', 'Acetaminophen',
            'Ibuprofen', 'Syringes', 'Bandages', 'IV Bags', 'Ventilators',
            'Surgical Masks', 'Face Shields', 'Gowns', 'Thermometers'
        ]

        inventory = {}

        # Simulate varying stock levels based on hospital capacity
        capacity_multiplier = hospital.capacity_rating if hospital.capacity_rating else 3

        for item in items:
            base_stock = random.randint(50, 500) * capacity_multiplier

            # Add some randomness to simulate real-world variations
            variation = random.uniform(0.3, 2.0)
            current_stock = int(base_stock * variation)

            inventory[item] = {
                'current_stock': current_stock,
                'min_stock_level': base_stock // 4,
                'max_stock_level': base_stock * 2,
                'cost_per_unit': round(random.uniform(0.5, 25.0), 2),
                'expiration_risk': random.choice(['Low', 'Medium', 'High']),
                'last_updated': datetime.now()
            }

        return inventory

    def find_supply_sources(self, item_name: str, quantity_needed: int,
                          requester_location: Tuple[float, float]) -> List[SupplyOffer]:
        """Find hospitals that can supply needed items"""
        lat, lon = requester_location
        nearby_hospitals = self.discover_nearby_hospitals(lat, lon)
        network_data = self.get_network_inventory_data(nearby_hospitals)

        offers = []

        for hospital_data in network_data['hospitals']:
            hospital = hospital_data['hospital']
            inventory = hospital_data['inventory']

            if item_name in inventory:
                item_data = inventory[item_name]
                available_surplus = max(0, item_data['current_stock'] - item_data['min_stock_level'])

                if available_surplus >= quantity_needed:
                    # Calculate distance and travel time
                    distance = self._calculate_distance(lat, lon, hospital.latitude, hospital.longitude)

                    # Simulate travel time (assuming average 60 km/h speed)
                    estimated_travel_time = distance / 60  # hours

                    offer = SupplyOffer(
                        item_name=item_name,
                        quantity_available=min(available_surplus, quantity_needed * 2),
                        offering_hospital_id=hospital.id,
                        cost_per_unit=item_data['cost_per_unit'],
                        pickup_instructions=f"Contact {hospital.phone} for pickup coordination",
                        valid_until=datetime.now() + timedelta(hours=24),
                        expiration_date=None  # Would be set based on actual inventory data
                    )

                    offers.append(offer)

        # Sort by distance (closest first)
        return sorted(offers, key=lambda o: self._calculate_distance(
            lat, lon,
            self.hospitals[o.offering_hospital_id].latitude,
            self.hospitals[o.offering_hospital_id].longitude
        ))

    def create_supply_request(self, request: InventoryRequest,
                            requester_location: Tuple[float, float]) -> Dict:
        """Create and broadcast emergency supply request to network with intelligent matching"""
        request_id = f"REQ_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Enhanced supplier finding with priority routing
        offers = self.find_supply_sources_with_priority(
            request.item_name,
            request.quantity_needed,
            requester_location,
            request.urgency_level
        )

        # Intelligent matching based on urgency and proximity
        prioritized_offers = self._prioritize_offers_for_emergency(
            offers, request, requester_location
        )

        # Create request record with enhanced tracking
        request_record = {
            'request_id': request_id,
            'request': request.__dict__,
            'potential_offers': [offer.__dict__ for offer in prioritized_offers],
            'status': 'pending',
            'priority_score': self._calculate_request_priority_score(request),
            'created_at': datetime.now(),
            'expires_at': request.deadline,
            'auto_match_enabled': request.urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH],
            'network_broadcast_sent': datetime.now(),
            'tracking_updates': []
        }

        # Simulate automatic matching for critical requests
        auto_matches = []
        if request.urgency_level == UrgencyLevel.CRITICAL and prioritized_offers:
            auto_matches = self._attempt_automatic_matching(
                request, prioritized_offers, requester_location
            )

        # Calculate more accurate fulfillment estimates
        estimated_fulfillment = self._estimate_fulfillment_time(
            prioritized_offers, request.urgency_level, requester_location
        )

        return {
            'request_id': request_id,
            'status': 'created',
            'priority_level': request.urgency_level.value,
            'auto_matches': auto_matches,
            'potential_suppliers': len(prioritized_offers),
            'estimated_fulfillment_time': estimated_fulfillment,
            'network_coverage': self._calculate_network_coverage(requester_location),
            'offers': [
                {
                    'hospital_name': self.hospitals[offer.offering_hospital_id].name,
                    'hospital_id': offer.offering_hospital_id,
                    'quantity': offer.quantity_available,
                    'distance_km': round(self._calculate_distance(
                        requester_location[0], requester_location[1],
                        self.hospitals[offer.offering_hospital_id].latitude,
                        self.hospitals[offer.offering_hospital_id].longitude
                    ), 1),
                    'estimated_travel_time_hours': self._estimate_travel_time(
                        requester_location, offer.offering_hospital_id
                    ),
                    'cost_per_unit': offer.cost_per_unit,
                    'priority_score': getattr(offer, 'priority_score', 0),
                    'availability_confidence': self._calculate_availability_confidence(offer),
                    'contact_info': self.hospitals[offer.offering_hospital_id].phone
                } for offer in prioritized_offers[:8]  # Top 8 offers
            ],
            'emergency_protocols_activated': request.urgency_level in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH],
            'next_update_eta': datetime.now() + timedelta(minutes=15)
        }

    def find_supply_sources_with_priority(self, item_name: str, quantity_needed: int,
                                        requester_location: Tuple[float, float],
                                        urgency_level: UrgencyLevel) -> List[SupplyOffer]:
        """Enhanced supply source finding with urgency-based prioritization"""
        lat, lon = requester_location

        # Expand search radius for critical requests
        base_radius = self.network_radius_km
        if urgency_level == UrgencyLevel.CRITICAL:
            search_radius = base_radius * 1.5
        elif urgency_level == UrgencyLevel.HIGH:
            search_radius = base_radius * 1.2
        else:
            search_radius = base_radius

        nearby_hospitals = self.discover_nearby_hospitals(lat, lon, int(search_radius))
        network_data = self.get_network_inventory_data(nearby_hospitals)

        offers = []

        for hospital_data in network_data['hospitals']:
            hospital = hospital_data['hospital']
            inventory = hospital_data['inventory']

            if item_name in inventory:
                item_data = inventory[item_name]

                # Enhanced availability calculation considering urgency
                if urgency_level == UrgencyLevel.CRITICAL:
                    # For critical requests, allow using safety stock
                    available_quantity = max(0, item_data['current_stock'] - (item_data['min_stock_level'] * 0.5))
                elif urgency_level == UrgencyLevel.HIGH:
                    # For high priority, use standard safety margin
                    available_quantity = max(0, item_data['current_stock'] - item_data['min_stock_level'])
                else:
                    # Normal requests only use surplus
                    available_quantity = max(0, item_data['current_stock'] - item_data['min_stock_level'] * 1.2)

                if available_quantity > 0:
                    distance = self._calculate_distance(lat, lon, hospital.latitude, hospital.longitude)

                    # Calculate priority score for this offer
                    priority_score = self._calculate_offer_priority_score(
                        available_quantity, quantity_needed, distance, urgency_level, item_data
                    )

                    offer = SupplyOffer(
                        item_name=item_name,
                        quantity_available=min(available_quantity, quantity_needed * 2),
                        offering_hospital_id=hospital.id,
                        cost_per_unit=item_data['cost_per_unit'],
                        pickup_instructions=f"Contact {hospital.phone} - Emergency Protocol Active" if urgency_level == UrgencyLevel.CRITICAL else f"Contact {hospital.phone} for pickup coordination",
                        valid_until=datetime.now() + timedelta(hours=48 if urgency_level == UrgencyLevel.CRITICAL else 24),
                        expiration_date=None
                    )

                    # Add priority score as attribute
                    setattr(offer, 'priority_score', priority_score)
                    setattr(offer, 'distance_km', distance)
                    offers.append(offer)

        # Sort by priority score (higher is better)
        return sorted(offers, key=lambda o: getattr(o, 'priority_score', 0), reverse=True)

    def _calculate_offer_priority_score(self, available_qty: int, needed_qty: int,
                                      distance_km: float, urgency: UrgencyLevel,
                                      item_data: Dict) -> float:
        """Calculate priority score for supply offer"""
        score = 0

        # Quantity match score (0-40 points)
        quantity_ratio = min(available_qty / needed_qty, 1.0)
        score += quantity_ratio * 40

        # Distance score (0-25 points) - closer is better
        max_distance = 100  # km
        distance_score = max(0, (max_distance - distance_km) / max_distance) * 25
        score += distance_score

        # Stock health score (0-20 points)
        stock_ratio = item_data['current_stock'] / max(item_data['min_stock_level'], 1)
        stock_health = min(stock_ratio / 3.0, 1.0) * 20  # Full points if 3x min stock
        score += stock_health

        # Urgency multiplier (0-15 points)
        urgency_multipliers = {
            UrgencyLevel.CRITICAL: 15,
            UrgencyLevel.HIGH: 10,
            UrgencyLevel.MEDIUM: 5,
            UrgencyLevel.LOW: 0
        }
        score += urgency_multipliers.get(urgency, 0)

        return round(score, 2)

    def _prioritize_offers_for_emergency(self, offers: List[SupplyOffer],
                                       request: InventoryRequest,
                                       requester_location: Tuple[float, float]) -> List[SupplyOffer]:
        """Prioritize offers for emergency situations"""
        if not offers:
            return offers

        # Additional sorting for emergency scenarios
        if request.urgency_level == UrgencyLevel.CRITICAL:
            # For critical requests, prioritize by distance and availability
            return sorted(offers, key=lambda o: (
                -getattr(o, 'priority_score', 0),  # Higher priority first
                getattr(o, 'distance_km', 50),     # Closer first
                -o.quantity_available               # More quantity first
            ))
        else:
            return offers  # Already sorted by priority score

    def _attempt_automatic_matching(self, request: InventoryRequest,
                                  offers: List[SupplyOffer],
                                  requester_location: Tuple[float, float]) -> List[Dict]:
        """Attempt automatic matching for critical requests"""
        auto_matches = []
        remaining_quantity = request.quantity_needed

        for offer in offers[:3]:  # Try top 3 offers
            if remaining_quantity <= 0:
                break

            # For critical requests, auto-reserve supplies
            hospital = self.hospitals[offer.offering_hospital_id]
            match_quantity = min(offer.quantity_available, remaining_quantity)

            auto_match = {
                'hospital_id': offer.offering_hospital_id,
                'hospital_name': hospital.name,
                'quantity_reserved': match_quantity,
                'distance_km': round(self._calculate_distance(
                    requester_location[0], requester_location[1],
                    hospital.latitude, hospital.longitude
                ), 1),
                'estimated_pickup_time': datetime.now() + timedelta(
                    hours=max(1, self._estimate_travel_time(requester_location, offer.offering_hospital_id))
                ),
                'contact_phone': hospital.phone,
                'reservation_expires': datetime.now() + timedelta(hours=6),  # 6-hour hold
                'confirmation_required': True,
                'status': 'auto-reserved'
            }

            auto_matches.append(auto_match)
            remaining_quantity -= match_quantity

        return auto_matches

    def _calculate_request_priority_score(self, request: InventoryRequest) -> float:
        """Calculate overall priority score for the request"""
        urgency_scores = {
            UrgencyLevel.CRITICAL: 100,
            UrgencyLevel.HIGH: 75,
            UrgencyLevel.MEDIUM: 50,
            UrgencyLevel.LOW: 25
        }

        base_score = urgency_scores.get(request.urgency_level, 25)

        # Add time pressure factor
        time_to_deadline = (request.deadline - datetime.now()).total_seconds() / 3600  # hours
        if time_to_deadline < 2:  # Less than 2 hours
            time_pressure = 25
        elif time_to_deadline < 6:  # Less than 6 hours
            time_pressure = 15
        elif time_to_deadline < 12:  # Less than 12 hours
            time_pressure = 10
        else:
            time_pressure = 0

        return base_score + time_pressure

    def _estimate_fulfillment_time(self, offers: List[SupplyOffer],
                                 urgency: UrgencyLevel,
                                 requester_location: Tuple[float, float]) -> datetime:
        """Estimate when the request can be fulfilled"""
        if not offers:
            return datetime.now() + timedelta(hours=24)  # Default fallback

        # Get the best offer's travel time
        best_offer = offers[0]
        travel_time = self._estimate_travel_time(requester_location, best_offer.offering_hospital_id)

        # Add coordination time based on urgency
        coordination_times = {
            UrgencyLevel.CRITICAL: 0.5,  # 30 minutes
            UrgencyLevel.HIGH: 1.0,      # 1 hour
            UrgencyLevel.MEDIUM: 2.0,    # 2 hours
            UrgencyLevel.LOW: 4.0        # 4 hours
        }

        coordination_time = coordination_times.get(urgency, 2.0)
        total_time = travel_time + coordination_time

        return datetime.now() + timedelta(hours=total_time)

    def _estimate_travel_time(self, requester_location: Tuple[float, float],
                            supplier_hospital_id: str) -> float:
        """Estimate travel time between locations (in hours)"""
        if supplier_hospital_id not in self.hospitals:
            return 2.0  # Default

        hospital = self.hospitals[supplier_hospital_id]
        distance = self._calculate_distance(
            requester_location[0], requester_location[1],
            hospital.latitude, hospital.longitude
        )

        # Assume average speed including traffic and coordination
        average_speed = 45  # km/h including stops
        return max(0.5, distance / average_speed)  # Minimum 30 minutes

    def _calculate_network_coverage(self, location: Tuple[float, float]) -> float:
        """Calculate what percentage of the region is covered by the hospital network"""
        lat, lon = location
        nearby_hospitals = self.discover_nearby_hospitals(lat, lon, self.network_radius_km)

        # Simple coverage estimate based on hospital density
        # In a real system, this would consider actual service areas
        coverage = min(len(nearby_hospitals) / 10, 1.0)  # Assume 10 hospitals = full coverage
        return round(coverage, 2)

    def _calculate_availability_confidence(self, offer: SupplyOffer) -> float:
        """Calculate confidence that the offered quantity is actually available"""
        # In production, this would consider real-time inventory updates,
        # hospital responsiveness, etc.

        # For now, provide reasonable estimates
        base_confidence = 0.85

        # Higher confidence for hospitals we've worked with recently
        # Lower confidence for very large quantities relative to typical stocks
        if offer.quantity_available > 1000:  # Large quantity
            confidence = base_confidence - 0.1
        else:
            confidence = base_confidence

        return round(max(0.5, confidence), 2)

    def get_network_forecast_data(self, item_name: str,
                                hospital_locations: List[Tuple[float, float]]) -> Dict:
        """Collect data from hospital network to improve demand forecasting"""

        network_demand_data = {
            'item_name': item_name,
            'regional_usage_patterns': [],
            'shortage_indicators': [],
            'seasonal_trends': {},
            'outbreak_signals': []
        }

        all_hospitals = []
        for lat, lon in hospital_locations:
            hospitals = self.discover_nearby_hospitals(lat, lon, radius_km=25)
            all_hospitals.extend(hospitals)

        # Remove duplicates
        unique_hospitals = {h.id: h for h in all_hospitals}.values()

        # Collect network inventory data
        network_data = self.get_network_inventory_data(list(unique_hospitals))

        # Analyze usage patterns across the network
        if item_name in network_data['aggregate_inventory']:
            agg_data = network_data['aggregate_inventory'][item_name]

            # Calculate regional demand indicators
            network_demand_data['regional_usage_patterns'] = {
                'total_network_stock': agg_data['total_stock'],
                'hospitals_in_network': len(unique_hospitals),
                'average_stock_per_hospital': agg_data['average_stock_per_hospital'],
                'critical_shortage_rate': agg_data['critical_hospitals'] / len(unique_hospitals),
                'stock_distribution_variance': self._calculate_stock_variance(network_data, item_name)
            }

            # Identify shortage patterns
            network_demand_data['shortage_indicators'] = [
                alert for alert in network_data['shortage_alerts']
                if alert['item'] == item_name
            ]

            # Detect potential outbreak signals
            if agg_data['critical_hospitals'] > len(unique_hospitals) * 0.3:
                network_demand_data['outbreak_signals'].append({
                    'signal_type': 'widespread_shortage',
                    'severity': 'high' if agg_data['critical_hospitals'] > len(unique_hospitals) * 0.5 else 'medium',
                    'affected_hospitals': agg_data['critical_hospitals'],
                    'detection_time': datetime.now()
                })

        return network_demand_data

    def _calculate_stock_variance(self, network_data: Dict, item_name: str) -> float:
        """Calculate variance in stock levels across hospitals"""
        stocks = []
        for hospital_data in network_data['hospitals']:
            if item_name in hospital_data['inventory']:
                stocks.append(hospital_data['inventory'][item_name]['current_stock'])

        if len(stocks) < 2:
            return 0.0

        mean_stock = sum(stocks) / len(stocks)
        variance = sum((x - mean_stock) ** 2 for x in stocks) / len(stocks)
        return variance