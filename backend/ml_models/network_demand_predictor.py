import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import pickle
import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

from services.hospital_network import HospitalNetworkService, UrgencyLevel

class NetworkDemandPredictor:
    """Enhanced demand predictor that incorporates hospital network data for better accuracy"""

    def __init__(self, google_maps_api_key: str):
        self.network_service = HospitalNetworkService(google_maps_api_key)
        self.prophet_models = {}
        self.ensemble_models = {}
        self.scalers = {}
        self.model_path = "./models/network/"
        os.makedirs(self.model_path, exist_ok=True)

        # Hospital location coordinates (would be configurable in production)
        self.hospital_locations = [
            (40.7128, -74.0060),  # New York area
            (34.0522, -118.2437), # Los Angeles area
            (41.8781, -87.6298),  # Chicago area
        ]

    def prepare_network_features(self, base_data: pd.DataFrame, item_name: str) -> pd.DataFrame:
        """Enhance base demand data with network intelligence"""

        # Get network forecast data for the item
        network_data = self.network_service.get_network_forecast_data(
            item_name, self.hospital_locations
        )

        enhanced_data = base_data.copy()

        # Add network-based features
        if network_data['regional_usage_patterns']:
            patterns = network_data['regional_usage_patterns']

            # Network stock indicators
            enhanced_data['network_total_stock'] = patterns['total_network_stock']
            enhanced_data['network_avg_stock'] = patterns['average_stock_per_hospital']
            enhanced_data['shortage_rate'] = patterns['critical_shortage_rate']
            enhanced_data['stock_variance'] = patterns['stock_distribution_variance']

            # Calculate network stress index
            enhanced_data['network_stress_index'] = self._calculate_network_stress(patterns)

        # Outbreak signal indicators
        outbreak_signals = len(network_data.get('outbreak_signals', []))
        enhanced_data['outbreak_signal_count'] = outbreak_signals
        enhanced_data['outbreak_risk'] = min(outbreak_signals / 3.0, 1.0)  # Normalize to 0-1

        # Shortage cascade risk
        shortage_count = len(network_data.get('shortage_indicators', []))
        enhanced_data['shortage_cascade_risk'] = self._calculate_cascade_risk(
            shortage_count, len(self.hospital_locations)
        )

        # Regional supply pressure
        enhanced_data['supply_pressure'] = self._calculate_supply_pressure(network_data)

        # Add time-based network effects
        enhanced_data['network_demand_multiplier'] = self._calculate_demand_multiplier(
            enhanced_data, network_data
        )

        return enhanced_data

    def _calculate_network_stress(self, patterns: Dict) -> float:
        """Calculate overall network stress indicator (0-1 scale)"""
        factors = [
            patterns['critical_shortage_rate'],  # Higher shortage rate = more stress
            min(patterns['stock_distribution_variance'] / 10000, 1.0),  # Higher variance = more stress
            max(0, 1 - patterns['average_stock_per_hospital'] / 1000)  # Lower average stock = more stress
        ]
        return np.mean(factors)

    def _calculate_cascade_risk(self, shortage_count: int, total_hospitals: int) -> float:
        """Calculate risk of shortage cascading through network"""
        if total_hospitals == 0:
            return 0.0

        shortage_ratio = shortage_count / total_hospitals

        # Non-linear cascade risk - small shortages have minimal risk,
        # but risk increases exponentially as more hospitals are affected
        cascade_risk = min(shortage_ratio ** 0.5 * 2, 1.0)
        return cascade_risk

    def _calculate_supply_pressure(self, network_data: Dict) -> float:
        """Calculate supply pressure based on network shortage patterns"""
        shortage_indicators = network_data.get('shortage_indicators', [])

        if not shortage_indicators:
            return 0.0

        # Weight shortages by urgency
        urgency_weights = {'low': 0.1, 'medium': 0.5, 'high': 0.8, 'critical': 1.0}
        total_pressure = 0

        for shortage in shortage_indicators:
            urgency = shortage.get('urgency', 'medium')
            pressure = urgency_weights.get(urgency, 0.5)

            # Adjust by severity (how far below min stock)
            if 'current_stock' in shortage and 'min_stock' in shortage:
                severity = max(0, 1 - shortage['current_stock'] / shortage['min_stock'])
                pressure *= (1 + severity)

            total_pressure += pressure

        # Normalize by number of potential shortage sources
        return min(total_pressure / len(shortage_indicators), 2.0)

    def _calculate_demand_multiplier(self, data: pd.DataFrame, network_data: Dict) -> pd.Series:
        """Calculate demand multiplier based on network conditions"""
        base_multiplier = 1.0

        # Adjust based on network stress
        if 'network_stress_index' in data.columns:
            stress_adjustment = 1 + (data['network_stress_index'] * 0.5)
            base_multiplier *= stress_adjustment

        # Adjust based on outbreak signals
        if 'outbreak_risk' in data.columns:
            outbreak_adjustment = 1 + (data['outbreak_risk'] * 1.0)
            base_multiplier *= outbreak_adjustment

        # Adjust based on cascade risk
        if 'shortage_cascade_risk' in data.columns:
            cascade_adjustment = 1 + (data['shortage_cascade_risk'] * 0.8)
            base_multiplier *= cascade_adjustment

        return pd.Series([base_multiplier] * len(data), index=data.index)

    def train_network_prophet_model(self, data: pd.DataFrame, item_name: str) -> Prophet:
        """Train Prophet model with network features"""

        # Prepare data for Prophet
        prophet_data = pd.DataFrame({
            'ds': data['date'],
            'y': data['quantity_used']
        })

        # Add capacity constraints
        prophet_data['cap'] = data['quantity_used'].quantile(0.95) * 3
        prophet_data['floor'] = 0

        # Create Prophet model with network-aware parameters
        model = Prophet(
            growth='logistic',
            seasonality_mode='multiplicative',
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.08,  # Slightly more flexible for network effects
            seasonality_prior_scale=1.0,
            holidays_prior_scale=10.0
        )

        # Add enhanced network-based regressors
        network_regressors = [
            'network_stress_index', 'outbreak_risk', 'shortage_cascade_risk',
            'supply_pressure', 'network_demand_multiplier', 'geographic_clustering_risk',
            'network_connectivity', 'regional_demand_variance', 'nearby_avg_stock_ratio',
            'nearby_shortage_rate', 'nearby_consumption_trend', 'emergency_amplification'
        ]

        for regressor in network_regressors:
            if regressor in data.columns:
                model.add_regressor(regressor)
                prophet_data[regressor] = data[regressor].values

        # Add standard regressors
        standard_regressors = ['admissions', 'flu_trend', 'covid_trend']
        for regressor in standard_regressors:
            if regressor in data.columns:
                model.add_regressor(regressor)
                prophet_data[regressor] = data[regressor].values

        model.fit(prophet_data)
        return model

    def train_ensemble_model(self, data: pd.DataFrame, item_name: str) -> Dict:
        """Train ensemble model combining multiple algorithms with network features"""

        # Enhanced features including new network intelligence
        feature_columns = [
            'admissions', 'flu_trend', 'covid_trend', 'seasonal_factor',
            'day_of_week', 'month', 'is_weekend',
            'network_stress_index', 'outbreak_risk', 'shortage_cascade_risk',
            'supply_pressure', 'network_demand_multiplier',
            'geographic_clustering_risk', 'network_connectivity', 'regional_demand_variance',
            'nearby_avg_stock_ratio', 'nearby_shortage_rate', 'nearby_consumption_trend',
            'emergency_amplification'
        ]

        # Filter available features
        available_features = [f for f in feature_columns if f in data.columns]

        if len(available_features) < 3:
            print(f"Insufficient features for ensemble model for {item_name}")
            return None

        X = data[available_features].fillna(method='ffill').fillna(0)
        y = data['quantity_used']

        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Train multiple models
        models = {}

        # Random Forest with network-aware hyperparameters
        rf_params = {
            'n_estimators': [100, 200, 300],
            'max_depth': [8, 12, 16, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'max_features': ['sqrt', 'log2']
        }

        rf = RandomForestRegressor(random_state=42)
        rf_search = RandomizedSearchCV(
            rf, rf_params, n_iter=20, cv=TimeSeriesSplit(n_splits=3),
            scoring='neg_mean_squared_error', random_state=42
        )
        rf_search.fit(X_scaled, y)
        models['random_forest'] = rf_search.best_estimator_

        # Gradient Boosting for capturing network interactions
        gb_params = {
            'n_estimators': [100, 200],
            'learning_rate': [0.05, 0.1, 0.15],
            'max_depth': [4, 6, 8],
            'subsample': [0.8, 0.9, 1.0]
        }

        gb = GradientBoostingRegressor(random_state=42)
        gb_search = RandomizedSearchCV(
            gb, gb_params, n_iter=15, cv=TimeSeriesSplit(n_splits=3),
            scoring='neg_mean_squared_error', random_state=42
        )
        gb_search.fit(X_scaled, y)
        models['gradient_boosting'] = gb_search.best_estimator_

        return {
            'models': models,
            'scaler': scaler,
            'features': available_features,
            'feature_importance': self._calculate_ensemble_importance(models, available_features)
        }

    def _calculate_ensemble_importance(self, models: Dict, features: List[str]) -> Dict:
        """Calculate feature importance across ensemble models"""
        importance_dict = {}

        for model_name, model in models.items():
            if hasattr(model, 'feature_importances_'):
                for i, feature in enumerate(features):
                    if feature not in importance_dict:
                        importance_dict[feature] = []
                    importance_dict[feature].append(model.feature_importances_[i])

        # Average importance across models
        avg_importance = {}
        for feature, importances in importance_dict.items():
            avg_importance[feature] = np.mean(importances)

        return avg_importance

    def predict_network_demand(self, item_name: str, days_ahead: int = 30) -> Dict:
        """Make demand prediction incorporating network intelligence"""

        try:
            # Get current network status
            all_hospitals = []
            for lat, lon in self.hospital_locations:
                hospitals = self.network_service.discover_nearby_hospitals(lat, lon)
                all_hospitals.extend(hospitals)

            network_data = self.network_service.get_network_inventory_data(all_hospitals)

            # Create future dates
            future_dates = pd.date_range(start=datetime.now().date(), periods=days_ahead, freq='D')

            # Prepare features for prediction
            future_features = self._generate_future_features(future_dates, item_name, network_data)

            predictions = {}

            # Prophet prediction with network features
            if item_name in self.prophet_models:
                prophet_pred = self._predict_with_prophet(
                    self.prophet_models[item_name], future_features, days_ahead
                )
                predictions['prophet'] = prophet_pred

            # Ensemble prediction
            if item_name in self.ensemble_models:
                ensemble_pred = self._predict_with_ensemble(
                    self.ensemble_models[item_name], future_features
                )
                predictions['ensemble'] = ensemble_pred

            # Combine predictions with network-aware weighting
            final_prediction = self._combine_predictions(predictions, network_data, item_name)

            # Add network-specific insights
            network_insights = self._generate_network_insights(network_data, item_name)

            return {
                'demand': final_prediction['demand'],
                'confidence': final_prediction['confidence'],
                'network_insights': network_insights,
                'risk_factors': final_prediction['risk_factors'],
                'supply_recommendations': self._generate_supply_recommendations(
                    final_prediction, network_data, item_name
                )
            }

        except Exception as e:
            print(f"Network prediction error for {item_name}: {e}")
            return self._fallback_prediction(item_name, days_ahead)

    def _generate_future_features(self, future_dates: pd.DatetimeIndex,
                                 item_name: str, network_data: Dict) -> pd.DataFrame:
        """Generate enhanced features for future prediction periods with improved network intelligence"""

        features = []
        nearby_hospital_inventories = self._sample_nearby_hospital_inventories(network_data, item_name)

        for date in future_dates:
            # Base temporal features
            feature = {
                'date': date,
                'day_of_week': date.weekday(),
                'month': date.month,
                'is_weekend': int(date.weekday() >= 5),
                'week': date.isocalendar().week
            }

            # Enhanced network-based features (projected forward)
            if item_name in network_data.get('aggregate_inventory', {}):
                agg_data = network_data['aggregate_inventory'][item_name]

                # Project network conditions forward with adaptive decay based on urgency
                days_forward = (date.date() - datetime.now().date()).days

                # Adaptive decay - critical situations persist longer
                base_decay = 0.95
                urgency_factor = len(network_data.get('shortage_indicators', [])) / 10
                adjusted_decay = base_decay - (urgency_factor * 0.1)  # Slower decay for urgent situations
                decay_factor = adjusted_decay ** days_forward

                # Network stress with geographic clustering effects
                geographic_stress = self._calculate_geographic_clustering_stress(network_data, nearby_hospital_inventories)

                feature.update({
                    'network_stress_index': min(agg_data.get('critical_hospitals', 0) / 10, 1.0) * decay_factor,
                    'shortage_cascade_risk': min(len(network_data.get('shortage_indicators', [])) / 5, 1.0) * decay_factor,
                    'outbreak_risk': min(len(network_data.get('outbreak_signals', [])) / 3, 1.0) * decay_factor,
                    'supply_pressure': self._calculate_supply_pressure(network_data) * decay_factor,
                    'geographic_clustering_risk': geographic_stress * decay_factor,
                    'network_connectivity': self._calculate_network_connectivity(network_data),
                    'regional_demand_variance': self._calculate_regional_demand_variance(nearby_hospital_inventories, item_name)
                })

                # Add nearby hospital sampling indicators
                if nearby_hospital_inventories:
                    feature.update({
                        'nearby_avg_stock_ratio': self._calculate_nearby_stock_ratio(nearby_hospital_inventories, item_name),
                        'nearby_shortage_rate': self._calculate_nearby_shortage_rate(nearby_hospital_inventories, item_name),
                        'nearby_consumption_trend': self._calculate_nearby_consumption_trend(nearby_hospital_inventories, item_name, days_forward)
                    })
                else:
                    feature.update({
                        'nearby_avg_stock_ratio': 0.5,
                        'nearby_shortage_rate': 0.1,
                        'nearby_consumption_trend': 1.0
                    })
            else:
                # Enhanced default values with regional estimates
                feature.update({
                    'network_stress_index': 0.1,
                    'shortage_cascade_risk': 0.1,
                    'outbreak_risk': 0.1,
                    'supply_pressure': 0.1,
                    'geographic_clustering_risk': 0.1,
                    'network_connectivity': 0.5,
                    'regional_demand_variance': 0.2,
                    'nearby_avg_stock_ratio': 0.5,
                    'nearby_shortage_rate': 0.1,
                    'nearby_consumption_trend': 1.0
                })

            # Enhanced network demand multiplier with more sophisticated weighting
            feature['network_demand_multiplier'] = 1.0 + (
                feature['network_stress_index'] * 0.25 +
                feature['outbreak_risk'] * 0.4 +
                feature['shortage_cascade_risk'] * 0.3 +
                feature['geographic_clustering_risk'] * 0.2 +
                (1 - feature['network_connectivity']) * 0.15 +  # Lower connectivity = higher risk
                feature['regional_demand_variance'] * 0.1
            )

            # Enhanced seasonal and trend features with regional adjustments
            base_seasonal = 1.0 + 0.2 * np.sin(2 * np.pi * date.timetuple().tm_yday / 365)
            seasonal_adjustment = feature.get('nearby_consumption_trend', 1.0)

            feature.update({
                'seasonal_factor': base_seasonal * seasonal_adjustment,
                'flu_trend': (1.0 + 0.3 * np.sin(2 * np.pi * (date.timetuple().tm_yday - 60) / 365)) * seasonal_adjustment,
                'covid_trend': (0.8 + 0.4 * np.sin(2 * np.pi * (date.timetuple().tm_yday - 30) / 365)) * seasonal_adjustment,
                'admissions': (150 + 20 * np.sin(2 * np.pi * date.timetuple().tm_yday / 365)) * feature['nearby_consumption_trend']
            })

            # Emergency and outbreak amplification factors
            if feature['outbreak_risk'] > 0.5:
                feature['emergency_amplification'] = 1 + (feature['outbreak_risk'] * 0.8)
            else:
                feature['emergency_amplification'] = 1.0

            features.append(feature)

        return pd.DataFrame(features)

    def _sample_nearby_hospital_inventories(self, network_data: Dict, item_name: str) -> List[Dict]:
        """Sample inventory data from nearby hospitals for enhanced forecasting"""
        nearby_inventories = []

        for hospital_data in network_data.get('hospitals', []):
            hospital = hospital_data['hospital']
            inventory = hospital_data.get('inventory', {})

            if item_name in inventory:
                nearby_inventories.append({
                    'hospital_id': hospital.id,
                    'hospital_name': hospital.name,
                    'distance_km': getattr(hospital, 'distance_km', 25.0),  # Default if not set
                    'current_stock': inventory[item_name]['current_stock'],
                    'min_stock': inventory[item_name]['min_stock_level'],
                    'max_stock': inventory[item_name]['max_stock_level'],
                    'consumption_rate': inventory[item_name].get('daily_consumption_rate',
                                                               inventory[item_name]['current_stock'] / 30),  # Estimate if not available
                    'last_updated': inventory[item_name].get('last_updated', datetime.now())
                })

        return nearby_inventories

    def _calculate_geographic_clustering_stress(self, network_data: Dict, nearby_inventories: List[Dict]) -> float:
        """Calculate stress factor based on geographic clustering of shortages"""
        if not nearby_inventories:
            return 0.0

        # Find hospitals with shortages
        shortage_hospitals = [
            inv for inv in nearby_inventories
            if inv['current_stock'] < inv['min_stock'] * 0.5
        ]

        if len(shortage_hospitals) < 2:
            return 0.0

        # Calculate clustering - if shortages are geographically close, increase stress
        # Simplified calculation based on shortage density
        shortage_rate = len(shortage_hospitals) / len(nearby_inventories)

        # Higher clustering stress if shortages are concentrated
        clustering_stress = min(shortage_rate ** 0.7, 1.0)  # Non-linear relationship

        return clustering_stress

    def _calculate_network_connectivity(self, network_data: Dict) -> float:
        """Calculate how well-connected the hospital network is for supply sharing"""
        hospitals = network_data.get('hospitals', [])
        if len(hospitals) < 2:
            return 0.0

        # Estimate connectivity based on surplus/shortage balance
        shortage_alerts = len(network_data.get('shortage_alerts', []))
        surplus_items = len(network_data.get('surplus_items', []))

        if shortage_alerts == 0 and surplus_items == 0:
            return 0.5  # Neutral

        # Good connectivity when surplus can cover shortages
        if surplus_items > shortage_alerts:
            connectivity = min(surplus_items / max(shortage_alerts, 1), 1.0)
        else:
            connectivity = max(0.1, surplus_items / max(shortage_alerts, 1))

        return connectivity

    def _calculate_regional_demand_variance(self, nearby_inventories: List[Dict], item_name: str) -> float:
        """Calculate variance in demand patterns across the region"""
        if len(nearby_inventories) < 2:
            return 0.1

        consumption_rates = [inv['consumption_rate'] for inv in nearby_inventories]
        if not consumption_rates:
            return 0.1

        mean_consumption = np.mean(consumption_rates)
        variance = np.var(consumption_rates)

        # Normalize variance relative to mean
        normalized_variance = min(variance / max(mean_consumption, 1), 1.0)

        return normalized_variance

    def _calculate_nearby_stock_ratio(self, nearby_inventories: List[Dict], item_name: str) -> float:
        """Calculate average stock ratio of nearby hospitals"""
        if not nearby_inventories:
            return 0.5

        stock_ratios = []
        for inv in nearby_inventories:
            target_stock = (inv['min_stock'] + inv['max_stock']) / 2
            ratio = inv['current_stock'] / max(target_stock, 1)
            stock_ratios.append(min(ratio, 2.0))  # Cap at 200%

        return np.mean(stock_ratios)

    def _calculate_nearby_shortage_rate(self, nearby_inventories: List[Dict], item_name: str) -> float:
        """Calculate the rate of shortages among nearby hospitals"""
        if not nearby_inventories:
            return 0.1

        shortage_count = sum(1 for inv in nearby_inventories
                           if inv['current_stock'] < inv['min_stock'])

        return shortage_count / len(nearby_inventories)

    def _calculate_nearby_consumption_trend(self, nearby_inventories: List[Dict], item_name: str, days_forward: int) -> float:
        """Calculate consumption trend modifier based on nearby hospital patterns"""
        if not nearby_inventories:
            return 1.0

        # Estimate consumption trends based on stock levels and patterns
        total_consumption = sum(inv['consumption_rate'] for inv in nearby_inventories)
        avg_consumption = total_consumption / len(nearby_inventories)

        # Adjust trend based on current stock levels and shortage indicators
        shortage_hospitals = sum(1 for inv in nearby_inventories
                               if inv['current_stock'] < inv['min_stock'])
        shortage_rate = shortage_hospitals / len(nearby_inventories)

        # Higher shortage rate indicates increasing consumption trend
        trend_multiplier = 1.0 + (shortage_rate * 0.3)

        # Decay trend influence over time
        time_decay = 0.98 ** days_forward

        return 1.0 + (trend_multiplier - 1.0) * time_decay

    def _predict_with_prophet(self, model: Prophet, features: pd.DataFrame, days_ahead: int) -> Dict:
        """Make prediction using Prophet model"""

        prophet_future = model.make_future_dataframe(periods=days_ahead)
        prophet_future['cap'] = 10000  # Set reasonable capacity
        prophet_future['floor'] = 0

        # Add regressors
        regressor_columns = ['network_stress_index', 'outbreak_risk', 'shortage_cascade_risk',
                           'supply_pressure', 'network_demand_multiplier', 'admissions',
                           'flu_trend', 'covid_trend']

        for col in regressor_columns:
            if col in features.columns:
                if len(prophet_future) >= len(features):
                    prophet_future[col] = list(features[col]) + [features[col].iloc[-1]] * (len(prophet_future) - len(features))
                else:
                    prophet_future[col] = features[col][:len(prophet_future)]

        forecast = model.predict(prophet_future)

        future_forecast = forecast.tail(days_ahead)

        return {
            'demand': max(0, int(future_forecast['yhat'].sum())),
            'confidence': {
                'lower': max(0, int(future_forecast['yhat_lower'].sum())),
                'upper': int(future_forecast['yhat_upper'].sum())
            }
        }

    def _predict_with_ensemble(self, ensemble: Dict, features: pd.DataFrame) -> Dict:
        """Make prediction using ensemble model"""

        if not ensemble or 'models' not in ensemble:
            return {'demand': 0, 'confidence': {'lower': 0, 'upper': 0}}

        models = ensemble['models']
        scaler = ensemble['scaler']
        feature_cols = ensemble['features']

        # Prepare features
        X = features[feature_cols].fillna(method='ffill').fillna(0)
        X_scaled = scaler.transform(X)

        # Get predictions from each model
        predictions = []
        for model_name, model in models.items():
            pred = model.predict(X_scaled)
            predictions.append(pred.sum())

        # Ensemble average
        avg_prediction = np.mean(predictions)
        std_prediction = np.std(predictions)

        return {
            'demand': max(0, int(avg_prediction)),
            'confidence': {
                'lower': max(0, int(avg_prediction - 1.96 * std_prediction)),
                'upper': int(avg_prediction + 1.96 * std_prediction)
            }
        }

    def _combine_predictions(self, predictions: Dict, network_data: Dict, item_name: str) -> Dict:
        """Combine multiple predictions with network-aware weighting"""

        if not predictions:
            return {'demand': 0, 'confidence': {'lower': 0, 'upper': 0}, 'risk_factors': []}

        # Weight predictions based on network conditions
        weights = {}

        # Higher network stress increases ensemble model weight (better at capturing volatility)
        network_stress = 0.1
        if item_name in network_data.get('aggregate_inventory', {}):
            agg_data = network_data['aggregate_inventory'][item_name]
            network_stress = min(agg_data.get('critical_hospitals', 0) / 10, 1.0)

        if 'prophet' in predictions:
            weights['prophet'] = 0.7 - (network_stress * 0.3)  # Less weight under high stress

        if 'ensemble' in predictions:
            weights['ensemble'] = 0.3 + (network_stress * 0.3)  # More weight under high stress

        # Normalize weights
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}

        # Combine predictions
        combined_demand = 0
        combined_lower = 0
        combined_upper = 0

        for pred_type, weight in weights.items():
            pred = predictions[pred_type]
            combined_demand += pred['demand'] * weight
            combined_lower += pred['confidence']['lower'] * weight
            combined_upper += pred['confidence']['upper'] * weight

        # Identify risk factors
        risk_factors = []
        if network_stress > 0.3:
            risk_factors.append("High network stress detected")
        if len(network_data.get('shortage_indicators', [])) > 2:
            risk_factors.append("Multiple hospitals reporting shortages")
        if len(network_data.get('outbreak_signals', [])) > 0:
            risk_factors.append("Potential outbreak signals detected")

        return {
            'demand': max(0, int(combined_demand)),
            'confidence': {
                'lower': max(0, int(combined_lower)),
                'upper': int(combined_upper)
            },
            'risk_factors': risk_factors
        }

    def _generate_network_insights(self, network_data: Dict, item_name: str) -> Dict:
        """Generate insights about network conditions affecting demand"""

        insights = {
            'network_status': 'normal',
            'shortage_risk': 'low',
            'supply_chain_health': 'good',
            'recommendations': []
        }

        # Analyze network conditions
        shortage_count = len(network_data.get('shortage_indicators', []))
        outbreak_count = len(network_data.get('outbreak_signals', []))

        if shortage_count > 3:
            insights['network_status'] = 'stressed'
            insights['shortage_risk'] = 'high'
            insights['recommendations'].append("Consider increasing safety stock levels")

        if outbreak_count > 0:
            insights['network_status'] = 'alert'
            insights['shortage_risk'] = 'elevated'
            insights['recommendations'].append("Monitor for rapid demand increases")

        # Supply chain health assessment
        if item_name in network_data.get('aggregate_inventory', {}):
            agg_data = network_data['aggregate_inventory'][item_name]
            shortage_rate = agg_data.get('critical_hospitals', 0) / max(len(network_data.get('hospitals', [])), 1)

            if shortage_rate > 0.4:
                insights['supply_chain_health'] = 'poor'
                insights['recommendations'].append("Activate emergency supply sharing protocols")
            elif shortage_rate > 0.2:
                insights['supply_chain_health'] = 'concerning'
                insights['recommendations'].append("Increase collaboration with nearby hospitals")

        return insights

    def _generate_supply_recommendations(self, prediction: Dict, network_data: Dict, item_name: str) -> List[str]:
        """Generate supply management recommendations based on network analysis"""

        recommendations = []

        predicted_demand = prediction['demand']
        risk_factors = prediction.get('risk_factors', [])

        # Base recommendations on predicted demand and risk
        if predicted_demand > 1000:
            recommendations.append(f"High demand predicted ({predicted_demand} units). Consider bulk ordering.")

        if risk_factors:
            recommendations.append("Network stress detected. Implement collaborative procurement.")

        # Network-specific recommendations
        surplus_items = network_data.get('surplus_items', [])
        surplus_for_item = [s for s in surplus_items if s['item'] == item_name]

        if surplus_for_item:
            recommendations.append(f"Surplus available at {len(surplus_for_item)} nearby hospitals. Consider redistribution.")

        shortage_alerts = [s for s in network_data.get('shortage_alerts', []) if s['item'] == item_name]
        if shortage_alerts:
            recommendations.append(f"Critical shortages reported at {len(shortage_alerts)} hospitals. Activate sharing protocols.")

        return recommendations

    def _fallback_prediction(self, item_name: str, days_ahead: int) -> Dict:
        """Fallback prediction when network prediction fails"""

        base_demand = {
            'N95 Masks': 12, 'Surgical Gloves': 18, 'Hand Sanitizer': 2,
            'Acetaminophen': 6, 'Ibuprofen': 4, 'Syringes': 14,
            'Bandages': 8, 'IV Bags': 3
        }

        daily_demand = base_demand.get(item_name, 7)
        total_demand = daily_demand * days_ahead

        return {
            'demand': total_demand,
            'confidence': {'lower': int(total_demand * 0.8), 'upper': int(total_demand * 1.2)},
            'network_insights': {'network_status': 'unknown', 'recommendations': []},
            'risk_factors': ['Network data unavailable'],
            'supply_recommendations': ['Use historical averages for planning']
        }