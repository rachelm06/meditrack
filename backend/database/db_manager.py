import sqlite3
import pandas as pd
import os
from datetime import datetime, timedelta
import numpy as np

class DatabaseManager:
    def __init__(self, db_path="healthcare_inventory.db"):
        self.db_path = db_path
        self.connection = None

    def get_connection(self):
        if self.connection is None:
            self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
        return self.connection

    def initialize_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                current_stock INTEGER NOT NULL,
                min_stock_level INTEGER DEFAULT 50,
                max_stock_level INTEGER DEFAULT 1000,
                cost_per_unit REAL NOT NULL,
                supplier TEXT,
                last_reorder_date DATE,
                expiration_risk TEXT DEFAULT 'Low',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                quantity_used INTEGER NOT NULL,
                usage_date DATE NOT NULL,
                department TEXT,
                cost REAL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                predicted_demand INTEGER NOT NULL,
                prediction_date DATE NOT NULL,
                forecast_period INTEGER NOT NULL,
                confidence_lower INTEGER,
                confidence_upper INTEGER,
                actual_usage INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_cost REAL NOT NULL,
                total_cost REAL NOT NULL,
                supplier TEXT,
                order_date DATE NOT NULL,
                delivery_date DATE,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id TEXT NOT NULL UNIQUE,
                import_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                status TEXT NOT NULL,
                imported_records INTEGER DEFAULT 0,
                failed_records INTEGER DEFAULT 0,
                error_details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS prescriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prescription_id TEXT NOT NULL,
                patient_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                prescribed_quantity INTEGER NOT NULL,
                prescribed_date DATE NOT NULL,
                prescribing_physician TEXT,
                dosage_instructions TEXT,
                duration_days INTEGER,
                status TEXT DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        self._seed_initial_data()

    def _seed_initial_data(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM inventory")
        if cursor.fetchone()[0] > 0:
            return

        initial_inventory = [
            ('N95 Masks', 'PPE', 2500, 500, 5000, 2.50, 'MedSupply Co', 'Low'),
            ('Surgical Gloves', 'PPE', 4800, 1000, 10000, 0.35, 'SafeHands Inc', 'Low'),
            ('Hand Sanitizer', 'PPE', 150, 30, 300, 8.99, 'CleanCorp', 'Medium'),
            ('Acetaminophen', 'Medication', 800, 100, 2000, 0.15, 'PharmaCorp', 'High'),
            ('Ibuprofen', 'Medication', 650, 100, 1500, 0.22, 'MediCare Supply', 'Medium'),
            ('Syringes', 'General Supplies', 3200, 500, 8000, 0.08, 'MedEquip Ltd', 'Low'),
            ('Bandages', 'General Supplies', 1800, 200, 4000, 0.45, 'FirstAid Pro', 'Low'),
            ('IV Bags', 'General Supplies', 450, 50, 1000, 12.50, 'FluidTech', 'Medium'),
            ('Surgical Masks', 'PPE', 3500, 700, 7000, 0.75, 'MedSupply Co', 'Low'),
            ('Thermometers', 'General Supplies', 85, 20, 200, 25.00, 'MedTech Inc', 'Low'),
        ]

        for item in initial_inventory:
            cursor.execute('''
                INSERT INTO inventory (item_name, category, current_stock, min_stock_level,
                                     max_stock_level, cost_per_unit, supplier, expiration_risk)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', item)

        usage_data = pd.read_csv('../data/inventory_usage.csv')
        for _, row in usage_data.iterrows():
            cursor.execute('''
                INSERT INTO usage_history (item_name, quantity_used, usage_date, cost)
                VALUES (?, ?, ?, ?)
            ''', (row['item_name'], row['quantity_used'], row['date'],
                  row['quantity_used'] * row['cost_per_unit']))

        conn.commit()

    def get_current_inventory(self):
        conn = self.get_connection()

        query = '''
            SELECT
                item_name,
                category,
                current_stock,
                min_stock_level,
                max_stock_level,
                cost_per_unit,
                supplier,
                expiration_risk,
                COALESCE(avg_usage.daily_usage, 0) as usage_rate
            FROM inventory i
            LEFT JOIN (
                SELECT
                    item_name,
                    AVG(quantity_used) as daily_usage
                FROM usage_history
                WHERE usage_date >= date('now', '-30 days')
                GROUP BY item_name
            ) avg_usage ON i.item_name = avg_usage.item_name
        '''

        df = pd.read_sql_query(query, conn)
        return df.to_dict('records')

    def get_usage_analytics(self):
        conn = self.get_connection()

        waste_query = '''
            SELECT
                i.item_name,
                i.category,
                i.current_stock,
                i.cost_per_unit,
                COALESCE(avg_usage.daily_usage, 0) as daily_usage,
                CASE
                    WHEN COALESCE(avg_usage.daily_usage, 0) = 0 THEN 0
                    ELSE i.current_stock / avg_usage.daily_usage
                END as days_supply,
                CASE
                    WHEN i.expiration_risk = 'High' AND
                         (i.current_stock / COALESCE(avg_usage.daily_usage, 1)) > 30
                    THEN i.current_stock * i.cost_per_unit * 0.1
                    ELSE 0
                END as waste_cost
            FROM inventory i
            LEFT JOIN (
                SELECT
                    item_name,
                    AVG(quantity_used) as daily_usage
                FROM usage_history
                WHERE usage_date >= date('now', '-30 days')
                GROUP BY item_name
            ) avg_usage ON i.item_name = avg_usage.item_name
        '''

        waste_df = pd.read_sql_query(waste_query, conn)

        optimization_opportunities = []
        waste_analysis = []

        for _, row in waste_df.iterrows():
            if row['days_supply'] > 60:
                optimization_opportunities.append({
                    'item_name': row['item_name'],
                    'category': row['category'],
                    'current_stock': row['current_stock'],
                    'optimal_stock': int(row['daily_usage'] * 30) if row['daily_usage'] > 0 else row['current_stock'],
                    'potential_savings': (row['current_stock'] - int(row['daily_usage'] * 30)) * row['cost_per_unit'] if row['daily_usage'] > 0 else 0,
                    'recommendation': 'Reduce order quantity'
                })

            if row['waste_cost'] > 0:
                waste_analysis.append({
                    'item_name': row['item_name'],
                    'category': row['category'],
                    'waste_cost': row['waste_cost'],
                    'waste_reason': 'Excess stock with high expiration risk'
                })

        return {
            'waste_analysis': waste_analysis,
            'optimization_opportunities': optimization_opportunities
        }

    def get_all_inventory_items(self):
        conn = self.get_connection()
        query = "SELECT item_name, category FROM inventory"
        df = pd.read_sql_query(query, conn)
        return df.to_dict('records')

    def update_stock(self, item_name, new_stock):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE inventory
            SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
            WHERE item_name = ?
        ''', (new_stock, item_name))

        conn.commit()
        return cursor.rowcount > 0

    def add_usage_record(self, item_name, quantity_used, usage_date=None, department=None):
        if usage_date is None:
            usage_date = datetime.now().date()

        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO usage_history (item_name, quantity_used, usage_date, department)
            VALUES (?, ?, ?, ?)
        ''', (item_name, quantity_used, usage_date, department))

        cursor.execute('''
            UPDATE inventory
            SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
            WHERE item_name = ?
        ''', (quantity_used, item_name))

        conn.commit()
        return cursor.rowcount > 0

    def get_low_stock_items(self, threshold_days=14):
        conn = self.get_connection()

        query = '''
            SELECT
                i.*,
                COALESCE(avg_usage.daily_usage, 0) as daily_usage,
                CASE
                    WHEN COALESCE(avg_usage.daily_usage, 0) = 0 THEN 999
                    ELSE i.current_stock / avg_usage.daily_usage
                END as days_remaining
            FROM inventory i
            LEFT JOIN (
                SELECT
                    item_name,
                    AVG(quantity_used) as daily_usage
                FROM usage_history
                WHERE usage_date >= date('now', '-30 days')
                GROUP BY item_name
            ) avg_usage ON i.item_name = avg_usage.item_name
            HAVING days_remaining <= ?
            ORDER BY days_remaining
        '''

        df = pd.read_sql_query(query, conn, params=[threshold_days])
        return df.to_dict('records')

    def close_connection(self):
        if self.connection:
            self.connection.close()
            self.connection = None