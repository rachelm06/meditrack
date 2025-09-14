# MediTrack Healthcare Supply Chain Management System

A comprehensive healthcare inventory management platform that combines real-time monitoring with predictive analytics to prevent critical shortages while minimizing waste.

## Overview

MediTrack addresses the critical healthcare supply chain paradox where hospitals simultaneously waste billions of dollars annually while facing life-threatening shortages during emergencies. The platform uses machine learning-powered demand forecasting and an AI-powered constitutional judge to transform reactive inventory management into proactive, intelligent supply orchestration.

## Key Features

**AI-Powered Emergency Purchase Judge**
Constitutional AI system with weighted scoring rules that automatically flags emergency and urgent purchase decisions using demand forecasting data. Provides transparent rationale generation with calibrated confidence scores to ensure defensible decision-making.

**Hybrid ML Demand Forecasting**
Ensemble approach combining Facebook Prophet for seasonal time-series patterns with Random Forest for feature-based predictions. Enhanced with network sampling from nearby hospital inventories to improve outbreak and shortage detection accuracy.

**Real-Time Hospital Network Intelligence**
Google Maps API integration discovers nearby hospitals and enables emergency supply sharing with intelligent priority routing. Includes ML-enhanced network health scoring to assess shortage clustering and supply chain connectivity.

**Smart Waste Prevention**
Tracks healthcare waste patterns and automatically detects rogue spending, expiration risks, and hoarding behaviors. Provides real-time dashboard alerts to prevent supply chain losses.

## Architecture

**Backend**: FastAPI with SQLite persistence, modular service layers for hospital network discovery, demand forecasting, constitutional AI judge, and real-time inventory tracking.

**Frontend**: React.js with Google Maps integration, real-time dashboard updates, and comprehensive emergency alert system.

**APIs**: RESTful endpoints for hospital network discovery, emergency alerts, demand forecasting, and AI judge interactions.

**ML Pipeline**: Hybrid ensemble forecasting with synthetic hospital-scale demand modeling, volatility factors, and seasonal multipliers.

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Maps API key

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file with your configuration:
```
DATABASE_URL=sqlite:///./healthcare_inventory.db
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
HOSPITAL_HUB_LATITUDE=40.7580
HOSPITAL_HUB_LONGITUDE=-73.9855
```

Start the backend server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env.local` file:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
REACT_APP_API_URL=http://localhost:8000
```

Start the frontend development server:
```bash
npm start
```

## Usage

### Dashboard
Access the main dashboard at `http://localhost:3000` to view:
- Current inventory levels and usage trends
- Emergency purchase alerts from the AI Judge
- Demand forecasting charts and predictions
- Budget impact analysis

### Hospital Network
Navigate to the Hospital Network page to:
- View nearby hospitals on an interactive map
- Check supply availability across the network
- Create emergency supply requests
- Monitor network health status

### AI Assistant
Use the AI chat interface to:
- Ask questions about supply chain decisions
- Get explanations for emergency recommendations
- Analyze usage trends and patterns
- Understand budget impacts

## API Endpoints

### Emergency Alerts
- `GET /ai_judge/emergency_alerts` - Get urgent purchase alerts
- `POST /ai_judge/evaluate_item` - Evaluate specific item for emergency purchase
- `GET /ai_judge/constitution` - View AI Judge constitutional rules

### Hospital Network
- `GET /network/discover-hospitals` - Find nearby hospitals
- `GET /network/network-status/{item}` - Get network-wide item status
- `POST /network/emergency-request` - Create emergency supply request
- `GET /network/network-map` - Get hospital network visualization data

### Forecasting
- `POST /predict_demand` - Generate demand forecasts
- `POST /network/network-forecast` - Get network-enhanced predictions

### Inventory Management
- `GET /inventory_status` - Current inventory levels
- `POST /import_data` - Import inventory data
- `GET /dashboard_metrics` - Dashboard overview metrics

## Technical Details

### AI Judge Constitutional Framework
The AI Judge applies a weighted scoring system with clear decision thresholds:
- Days until depletion (30% weight)
- Usage trend acceleration (25% weight)
- Item criticality level (25% weight)
- Supplier reliability risk (10% weight)
- External factors (10% weight)

Decision categories:
- EMERGENCY (>8.5): Immediate purchase within 24 hours
- URGENT (7.0-8.5): Purchase recommended within 3 days
- MODERATE (5.0-7.0): Consider accelerated purchase within 1 week
- LOW (<5.0): Continue normal procurement schedule

### Machine Learning Models
**Prophet Model**: Handles seasonal patterns, holidays, and long-term trends in historical usage data.

**Random Forest**: Processes features like current stock levels, usage rates, supplier reliability, and external factors.

**Ensemble Logic**: Combines predictions using confidence-weighted averaging with fallback mechanisms for edge cases.

### Hospital Network Discovery
Uses Google Places API to discover hospitals within configurable radius. Falls back to realistic synthetic NYC hospital data when API is unavailable, including major facilities across all five boroughs.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For technical issues or questions about implementation, please open an issue on GitHub.