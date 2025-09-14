import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error, make_scorer
import pickle
import os
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class DemandPredictor:
    def __init__(self):
        self.prophet_model = None
        self.rf_model = None
        self.item_models = {}
        self.model_path = "./models/"
        os.makedirs(self.model_path, exist_ok=True)

    def load_data(self):
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            data_dir = os.path.join(base_dir, 'data')

            admissions_df = pd.read_csv(os.path.join(data_dir, "patient_admissions.csv"))
            usage_df = pd.read_csv(os.path.join(data_dir, "inventory_usage.csv"))
            seasonal_df = pd.read_csv(os.path.join(data_dir, "seasonal_trends.csv"))
        except Exception as e:
            print(f"Warning: Could not load data files: {e}")
            # Return empty DataFrames with expected columns as fallback
            admissions_df = pd.DataFrame(columns=['date', 'admissions'])
            usage_df = pd.DataFrame(columns=['date', 'item_name', 'quantity_used', 'cost_per_unit', 'expiration_risk'])
            seasonal_df = pd.DataFrame(columns=['week', 'seasonal_factor', 'flu_trend', 'covid_trend'])

        admissions_df['date'] = pd.to_datetime(admissions_df['date'])
        usage_df['date'] = pd.to_datetime(usage_df['date'])

        return admissions_df, usage_df, seasonal_df

    def prepare_features(self, admissions_df, usage_df, seasonal_df):
        usage_agg = usage_df.groupby(['date', 'item_name']).agg({
            'quantity_used': 'sum',
            'cost_per_unit': 'mean',
            'expiration_risk': lambda x: (x == 'High').sum()
        }).reset_index()

        merged_df = usage_agg.merge(admissions_df, on='date', how='left')

        merged_df['week'] = merged_df['date'].dt.isocalendar().week
        merged_df = merged_df.merge(seasonal_df, on='week', how='left')

        merged_df['day_of_week'] = merged_df['date'].dt.dayofweek
        merged_df['month'] = merged_df['date'].dt.month
        merged_df['is_weekend'] = merged_df['day_of_week'].isin([5, 6]).astype(int)

        merged_df['demand_factor'] = (
            merged_df['admissions'] * merged_df['seasonal_factor'] *
            merged_df['flu_trend'] * merged_df['covid_trend']
        )

        return merged_df

    def optimize_prophet_hyperparameters(self, prophet_data, item_name):
        """Optimize Prophet hyperparameters using cross-validation"""

        # Parameter combinations to test
        param_combinations = [
            {'changepoint_prior_scale': 0.001, 'seasonality_prior_scale': 0.01},
            {'changepoint_prior_scale': 0.01, 'seasonality_prior_scale': 0.1},
            {'changepoint_prior_scale': 0.05, 'seasonality_prior_scale': 1.0},
            {'changepoint_prior_scale': 0.1, 'seasonality_prior_scale': 10.0},
            {'changepoint_prior_scale': 0.5, 'seasonality_prior_scale': 10.0}
        ]

        best_model = None
        best_mape = float('inf')
        best_params = None

        print(f"Optimizing Prophet parameters for {item_name}...")

        for params in param_combinations:
            try:
                model = Prophet(
                    growth='logistic',
                    seasonality_mode='multiplicative',
                    yearly_seasonality=True,
                    weekly_seasonality=True,
                    daily_seasonality=False,
                    changepoint_prior_scale=params['changepoint_prior_scale'],
                    seasonality_prior_scale=params['seasonality_prior_scale']
                )

                # Add regressors if they exist in data
                for regressor in ['admissions', 'flu_cases', 'covid_cases']:
                    if regressor in prophet_data.columns:
                        model.add_regressor(regressor)

                model.fit(prophet_data)

                # Simple holdout validation (use last 20% of data for validation)
                split_point = int(len(prophet_data) * 0.8)
                train_data = prophet_data[:split_point]
                val_data = prophet_data[split_point:]

                if len(val_data) > 0:
                    model_temp = Prophet(
                        growth='logistic',
                        seasonality_mode='multiplicative',
                        yearly_seasonality=True,
                        weekly_seasonality=True,
                        daily_seasonality=False,
                        changepoint_prior_scale=params['changepoint_prior_scale'],
                        seasonality_prior_scale=params['seasonality_prior_scale']
                    )

                    for regressor in ['admissions', 'flu_cases', 'covid_cases']:
                        if regressor in train_data.columns:
                            model_temp.add_regressor(regressor)

                    model_temp.fit(train_data)

                    # Make predictions on validation set
                    forecast = model_temp.predict(val_data[['ds'] + [col for col in val_data.columns if col in ['admissions', 'flu_cases', 'covid_cases']]])

                    # Calculate MAPE
                    actual = val_data['y'].values
                    predicted = forecast['yhat'].values
                    mape = np.mean(np.abs((actual - predicted) / actual)) * 100

                    if mape < best_mape:
                        best_mape = mape
                        best_model = model
                        best_params = params

            except Exception as e:
                print(f"Error with parameters {params}: {e}")
                continue

        if best_model is None:
            # Fallback to default parameters
            print(f"Using default Prophet parameters for {item_name}")
            best_model = Prophet(
                growth='logistic',
                seasonality_mode='multiplicative',
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05
            )
            for regressor in ['admissions', 'flu_cases', 'covid_cases']:
                if regressor in prophet_data.columns:
                    best_model.add_regressor(regressor)
            best_model.fit(prophet_data)
        else:
            print(f"Best Prophet parameters for {item_name}: {best_params}, MAPE: {best_mape:.2f}%")

        return best_model

    def train_prophet_model(self, data, item_name):
        item_data = data[data['item_name'] == item_name].copy()

        if len(item_data) < 10:
            return None

        prophet_data = pd.DataFrame({
            'ds': item_data['date'],
            'y': item_data['quantity_used']
        })

        prophet_data['cap'] = prophet_data['y'].max() * 2
        prophet_data['floor'] = 0

        # Add regressors if available in the data
        available_regressors = ['admissions', 'flu_cases', 'covid_cases']
        for regressor in available_regressors:
            if regressor in item_data.columns:
                prophet_data[regressor] = item_data[regressor].values

        # Use hyperparameter optimization if enough data
        if len(prophet_data) >= 50:
            model = self.optimize_prophet_hyperparameters(prophet_data, item_name)
        else:
            print(f"Insufficient data for hyperparameter tuning for {item_name}, using default parameters")
            model = Prophet(
                growth='logistic',
                seasonality_mode='multiplicative',
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05
            )

            for regressor in available_regressors:
                if regressor in prophet_data.columns:
                    model.add_regressor(regressor)

            model.fit(prophet_data)

        return model

    def optimize_rf_hyperparameters(self, X, y):
        """Optimize Random Forest hyperparameters using RandomizedSearchCV"""

        # Define parameter distributions for random search
        param_distributions = {
            'n_estimators': [50, 100, 200, 300],
            'max_depth': [5, 10, 15, 20, None],
            'min_samples_split': [2, 5, 10, 20],
            'min_samples_leaf': [1, 2, 4, 8],
            'max_features': ['sqrt', 'log2', None],
            'bootstrap': [True, False]
        }

        # Use TimeSeriesSplit for time-based data
        tscv = TimeSeriesSplit(n_splits=3)

        # Create the base model
        rf = RandomForestRegressor(random_state=42)

        # Perform randomized search
        rf_random = RandomizedSearchCV(
            estimator=rf,
            param_distributions=param_distributions,
            n_iter=50,  # Number of parameter combinations to try
            cv=tscv,
            scoring='neg_mean_squared_error',
            random_state=42,
            n_jobs=-1,  # Use all available cores
            verbose=0
        )

        # Fit the randomized search
        rf_random.fit(X, y)

        print(f"Best RF parameters: {rf_random.best_params_}")
        print(f"Best RF score: {-rf_random.best_score_:.4f}")

        return rf_random.best_estimator_

    def train_rf_model(self, data):
        features = ['admissions', 'flu_cases', 'covid_cases', 'surgery_count',
                   'emergency_count', 'seasonal_factor', 'flu_trend', 'covid_trend',
                   'day_of_week', 'month', 'is_weekend', 'demand_factor']

        # Filter features that actually exist in the data
        available_features = [f for f in features if f in data.columns]
        if not available_features:
            available_features = ['day_of_week', 'month', 'is_weekend']  # Basic fallback features

        X = data[available_features].fillna(data[available_features].mean())
        y = data['quantity_used']

        if len(X) < 50:  # Not enough data for hyperparameter tuning
            print("Insufficient data for hyperparameter tuning, using default parameters")
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                min_samples_split=5,
                min_samples_leaf=2
            )
            model.fit(X, y)
        else:
            print("Optimizing Random Forest hyperparameters...")
            model = self.optimize_rf_hyperparameters(X, y)

        return model

    def load_or_train_model(self):
        try:
            admissions_df, usage_df, seasonal_df = self.load_data()
            prepared_data = self.prepare_features(admissions_df, usage_df, seasonal_df)

            unique_items = prepared_data['item_name'].unique()

            for item in unique_items:
                prophet_model = self.train_prophet_model(prepared_data, item)
                if prophet_model:
                    self.item_models[item] = {
                        'prophet': prophet_model,
                        'type': 'prophet'
                    }

            self.rf_model = self.train_rf_model(prepared_data)

            print(f"Trained models for {len(self.item_models)} items")

        except Exception as e:
            print(f"Error training models: {e}")
            self._create_fallback_models()

    def _create_fallback_models(self):
        items = ['N95 Masks', 'Surgical Gloves', 'Hand Sanitizer', 'Acetaminophen',
                 'Ibuprofen', 'Syringes', 'Bandages', 'IV Bags']

        for item in items:
            self.item_models[item] = {
                'prophet': None,
                'type': 'fallback'
            }

    def predict_demand(self, item_name, days_ahead=30):
        try:
            if item_name in self.item_models and self.item_models[item_name]['prophet']:
                return self._prophet_predict(item_name, days_ahead)
            elif self.rf_model:
                return self._rf_predict(item_name, days_ahead)
            else:
                return self._fallback_predict(item_name, days_ahead)

        except Exception as e:
            print(f"Prediction error for {item_name}: {e}")
            return self._fallback_predict(item_name, days_ahead)

    def _prophet_predict(self, item_name, days_ahead):
        model = self.item_models[item_name]['prophet']

        future = model.make_future_dataframe(periods=days_ahead)
        future['cap'] = future['yhat'].max() * 2 if 'yhat' in future.columns else 1000
        future['floor'] = 0

        admissions_base = 150
        flu_base = 35
        covid_base = 18

        future['admissions'] = admissions_base + np.random.normal(0, 10, len(future))
        future['flu_cases'] = flu_base + np.random.normal(0, 5, len(future))
        future['covid_cases'] = covid_base + np.random.normal(0, 3, len(future))

        forecast = model.predict(future)

        total_demand = forecast.tail(days_ahead)['yhat'].sum()
        confidence = {
            'lower': forecast.tail(days_ahead)['yhat_lower'].sum(),
            'upper': forecast.tail(days_ahead)['yhat_upper'].sum()
        }

        return {
            'demand': max(0, int(total_demand)),
            'confidence': confidence
        }

    def _rf_predict(self, item_name, days_ahead):
        future_dates = pd.date_range(start=datetime.now().date(), periods=days_ahead, freq='D')

        features = []
        for date in future_dates:
            feature = {
                'admissions': 150 + np.random.normal(0, 10),
                'flu_cases': 35 + np.random.normal(0, 5),
                'covid_cases': 18 + np.random.normal(0, 3),
                'surgery_count': 12 + np.random.normal(0, 2),
                'emergency_count': 48 + np.random.normal(0, 5),
                'seasonal_factor': 1.0 + 0.2 * np.sin(2 * np.pi * date.timetuple().tm_yday / 365),
                'flu_trend': 1.0 + 0.3 * np.sin(2 * np.pi * (date.timetuple().tm_yday - 60) / 365),
                'covid_trend': 0.8 + 0.2 * np.random.random(),
                'day_of_week': date.weekday(),
                'month': date.month,
                'is_weekend': int(date.weekday() >= 5),
                'demand_factor': 150 * 1.0 * 1.0 * 0.8
            }
            features.append(feature)

        X = pd.DataFrame(features)
        predictions = self.rf_model.predict(X)
        total_demand = predictions.sum()

        return {
            'demand': max(0, int(total_demand)),
            'confidence': {
                'lower': int(total_demand * 0.8),
                'upper': int(total_demand * 1.2)
            }
        }

    def _fallback_predict(self, item_name, days_ahead):
        base_demand = {
            'N95 Masks': 8,
            'Surgical Gloves': 15,
            'Hand Sanitizer': 1.5,
            'Acetaminophen': 4,
            'Ibuprofen': 3,
            'Syringes': 11,
            'Bandages': 6,
            'IV Bags': 2.5
        }

        daily_demand = base_demand.get(item_name, 5)
        total_demand = daily_demand * days_ahead
        noise_factor = 1 + np.random.normal(0, 0.1)
        total_demand *= noise_factor

        return {
            'demand': max(0, int(total_demand)),
            'confidence': {
                'lower': int(total_demand * 0.85),
                'upper': int(total_demand * 1.15)
            }
        }

    def evaluate_model(self, test_data):
        predictions = []
        actuals = []

        for item in test_data['item_name'].unique():
            item_data = test_data[test_data['item_name'] == item]
            for _, row in item_data.iterrows():
                pred = self.predict_demand(item, 1)
                predictions.append(pred['demand'])
                actuals.append(row['quantity_used'])

        mse = mean_squared_error(actuals, predictions)
        mae = mean_absolute_error(actuals, predictions)

        return {
            'mse': mse,
            'mae': mae,
            'rmse': np.sqrt(mse)
        }