# Hospital Network Integration Setup

The hospital network feature has been enhanced with Google Maps integration and advanced forecasting capabilities.

## Quick Setup

1. **Get Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Enable the Maps JavaScript API and Places API
   - Create credentials (API key)
   - Copy the API key

2. **Configure Backend**
   ```bash
   # Copy environment file
   cp backend/.env.example backend/.env

   # Edit backend/.env and set:
   GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. **Configure Frontend**
   ```bash
   # Create or edit frontend/.env.local
   echo "REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here" >> frontend/.env.local
   ```

## Features Implemented

### ✅ Google Maps Integration
- **Real-time hospital discovery** using Google Places API
- **Interactive hospital network map** with status indicators
- **Distance-based supply routing** with travel time estimates
- **Hospital contact integration** (phone, address, directions)

### ✅ Enhanced Forecasting Model
- **Nearby hospital inventory sampling** for outbreak detection
- **Geographic clustering analysis** for shortage risk assessment
- **Network connectivity scoring** for supply chain resilience
- **Regional demand variance calculations** for better accuracy
- **Emergency amplification factors** during crisis situations

### ✅ Emergency Shortage Exchange System
- **Intelligent priority routing** based on urgency levels
- **Automatic supply reservation** for critical requests (6-hour holds)
- **Multi-tier search radius expansion** for critical situations
- **Real-time availability confidence scoring**
- **Emergency protocol activation** for high/critical requests

## How It Works

### For Forecasting
1. **Samples nearby hospital inventories** within network radius
2. **Analyzes consumption patterns** across the region
3. **Detects outbreak signals** from widespread shortages
4. **Calculates network stress indicators** and cascade risks
5. **Provides enhanced demand predictions** with network intelligence

### For Emergency Requests
1. **Critical requests** (urgency: critical)
   - Expands search radius by 1.5x
   - Auto-reserves supplies from top 3 matches
   - Activates emergency protocols
   - 6-hour supply holds with pickup coordination

2. **High priority requests** (urgency: high)
   - Expands search radius by 1.2x
   - Priority routing and faster coordination
   - Emergency protocols activated

3. **Normal requests** (urgency: medium/low)
   - Standard network search
   - Regular supply sharing protocols

### For Supply Exchange
- **Priority scoring** based on distance, quantity match, urgency, and stock health
- **Geographic clustering detection** to prevent shortage cascades
- **Network coverage assessment** for optimal supplier selection
- **Travel time estimation** including traffic and coordination delays

## Usage Examples

### Making an Emergency Request
```javascript
// Critical shortage - auto-reserves supplies
{
  "item_name": "N95 Masks",
  "quantity_needed": 500,
  "urgency_level": "critical",
  "medical_reason": "COVID outbreak - ICU shortage",
  "deadline": "2024-01-15T18:00:00",
  "contact_info": "Dr. Smith - (555) 123-4567"
}
```

### Network-Enhanced Forecasting
```javascript
// Get 30-day forecast with network intelligence
{
  "item_name": "N95 Masks",
  "days_ahead": 30,
  "include_network_analysis": true
}
```

## API Endpoints

- `POST /network/emergency-request` - Submit emergency supply requests
- `GET /network/network-forecast` - Get network-enhanced demand forecasts
- `GET /network/discover-hospitals` - Find nearby hospitals with Google Maps
- `GET /network/network-map` - Get hospital network visualization data
- `GET /network/network-status/{item}` - Get real-time network status for specific items

## Demo Mode
If no Google Maps API key is provided, the system runs in demo mode with simulated hospital data for development and testing.

## Next Steps
1. Set up your Google Maps API key
2. Test with a few emergency requests
3. Monitor network forecasting accuracy
4. Configure your hospital's coordinates in the environment file
5. Customize search radius and network parameters as needed

The system will now provide much more accurate demand forecasting by sampling nearby hospital inventories and can facilitate emergency supply exchanges during shortages or outbreaks.