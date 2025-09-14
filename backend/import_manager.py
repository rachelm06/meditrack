import pandas as pd
import io
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, ValidationError, validator
import chardet
import json

class ImportResult(BaseModel):
    success: bool
    message: str
    imported_records: int = 0
    failed_records: int = 0
    errors: List[str] = []
    import_id: Optional[str] = None

class InventoryImportRecord(BaseModel):
    item_name: str
    category: str
    current_stock: int
    min_stock_level: Optional[int] = 50
    max_stock_level: Optional[int] = 1000
    cost_per_unit: float
    supplier: Optional[str] = None
    expiration_risk: Optional[str] = "Low"

    @validator('current_stock', 'min_stock_level', 'max_stock_level')
    def validate_positive_integers(cls, v):
        if v is not None and v < 0:
            raise ValueError('Stock levels must be non-negative')
        return v

    @validator('cost_per_unit')
    def validate_positive_cost(cls, v):
        if v < 0:
            raise ValueError('Cost per unit must be non-negative')
        return v

    @validator('expiration_risk')
    def validate_expiration_risk(cls, v):
        if v and v not in ['Low', 'Medium', 'High']:
            raise ValueError('Expiration risk must be Low, Medium, or High')
        return v or 'Low'

class UsageImportRecord(BaseModel):
    item_name: str
    quantity_used: int
    usage_date: str
    department: Optional[str] = None
    patient_id: Optional[str] = None
    prescription_id: Optional[str] = ""
    notes: Optional[str] = None

    @validator('quantity_used')
    def validate_positive_quantity(cls, v):
        if v < 0:
            raise ValueError('Quantity used must be non-negative')
        return v

    @validator('usage_date')
    def validate_date_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
        return v

class PrescriptionImportRecord(BaseModel):
    prescription_id: str
    patient_id: str
    item_name: str
    prescribed_quantity: int
    prescribed_date: str
    prescribing_physician: Optional[str] = None
    dosage_instructions: Optional[str] = None
    duration_days: Optional[int] = None

    @validator('prescribed_quantity')
    def validate_positive_quantity(cls, v):
        if v < 0:
            raise ValueError('Prescribed quantity must be non-negative')
        return v

    @validator('prescribed_date')
    def validate_date_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
        return v

class ImportManager:
    def __init__(self, db_path: str = "healthcare_inventory.db"):
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def _detect_encoding(self, file_content: bytes) -> str:
        """Detect file encoding"""
        result = chardet.detect(file_content)
        return result['encoding'] or 'utf-8'

    def _read_file_content(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """Read file content and return DataFrame"""
        encoding = self._detect_encoding(file_content)

        try:
            if filename.endswith('.csv'):
                return pd.read_csv(io.StringIO(file_content.decode(encoding)))
            elif filename.endswith('.xlsx') or filename.endswith('.xls'):
                return pd.read_excel(io.BytesIO(file_content))
            else:
                raise ValueError(f"Unsupported file format. Please use CSV or Excel files.")
        except Exception as e:
            raise ValueError(f"Error reading file: {str(e)}")

    def _create_import_record(self, import_type: str, filename: str, status: str) -> str:
        """Create an import record and return the import ID"""
        conn = self._get_connection()
        cursor = conn.cursor()

        import_id = f"{import_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        cursor.execute('''
            INSERT INTO import_history (import_id, import_type, filename, status, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (import_id, import_type, filename, status, datetime.now()))

        conn.commit()
        conn.close()
        return import_id

    def _update_import_record(self, import_id: str, status: str, imported_records: int = 0,
                             failed_records: int = 0, error_details: str = None):
        """Update import record with results"""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE import_history
            SET status = ?, imported_records = ?, failed_records = ?,
                error_details = ?, updated_at = ?
            WHERE import_id = ?
        ''', (status, imported_records, failed_records, error_details, datetime.now(), import_id))

        conn.commit()
        conn.close()

    def import_inventory_data(self, file_content: bytes, filename: str) -> ImportResult:
        """Import inventory data from uploaded file"""
        import_id = self._create_import_record("inventory", filename, "processing")
        errors = []
        imported_records = 0
        failed_records = 0

        try:
            df = self._read_file_content(file_content, filename)

            # Validate required columns
            required_columns = ['item_name', 'category', 'current_stock', 'cost_per_unit']
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                error_msg = f"Missing required columns: {', '.join(missing_columns)}"
                self._update_import_record(import_id, "failed", 0, len(df), error_msg)
                return ImportResult(
                    success=False,
                    message=error_msg,
                    errors=[error_msg],
                    import_id=import_id
                )

            conn = self._get_connection()
            cursor = conn.cursor()

            for index, row in df.iterrows():
                try:
                    # Validate record using Pydantic
                    record = InventoryImportRecord(**row.to_dict())

                    # Check if item already exists
                    cursor.execute('SELECT id FROM inventory WHERE item_name = ?', (record.item_name,))
                    existing = cursor.fetchone()

                    if existing:
                        # Update existing item
                        cursor.execute('''
                            UPDATE inventory
                            SET category = ?, current_stock = ?, min_stock_level = ?,
                                max_stock_level = ?, cost_per_unit = ?, supplier = ?,
                                expiration_risk = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE item_name = ?
                        ''', (record.category, record.current_stock, record.min_stock_level,
                              record.max_stock_level, record.cost_per_unit, record.supplier,
                              record.expiration_risk, record.item_name))
                    else:
                        # Insert new item
                        cursor.execute('''
                            INSERT INTO inventory
                            (item_name, category, current_stock, min_stock_level,
                             max_stock_level, cost_per_unit, supplier, expiration_risk)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (record.item_name, record.category, record.current_stock,
                              record.min_stock_level, record.max_stock_level, record.cost_per_unit,
                              record.supplier, record.expiration_risk))

                    imported_records += 1

                except ValidationError as e:
                    error_details = '; '.join([f"{err['loc'][0]}: {err['msg']}" for err in e.errors()])
                    error_msg = f"Row {index + 1}: {error_details}"
                    errors.append(error_msg)
                    failed_records += 1
                except Exception as e:
                    error_msg = f"Row {index + 1}: {str(e)}"
                    errors.append(error_msg)
                    failed_records += 1

            conn.commit()
            conn.close()

            status = "completed" if failed_records == 0 else "completed_with_errors"
            self._update_import_record(import_id, status, imported_records, failed_records,
                                     json.dumps(errors) if errors else None)

            return ImportResult(
                success=True,
                message=f"Import completed. {imported_records} records imported, {failed_records} failed.",
                imported_records=imported_records,
                failed_records=failed_records,
                errors=errors,
                import_id=import_id
            )

        except Exception as e:
            self._update_import_record(import_id, "failed", 0, 0, str(e))
            return ImportResult(
                success=False,
                message=f"Import failed: {str(e)}",
                errors=[str(e)],
                import_id=import_id
            )

    def import_usage_data(self, file_content: bytes, filename: str) -> ImportResult:
        """Import usage/prescription data from uploaded file"""
        import_id = self._create_import_record("usage", filename, "processing")
        errors = []
        imported_records = 0
        failed_records = 0

        try:
            df = self._read_file_content(file_content, filename)

            # Validate required columns
            required_columns = ['item_name', 'quantity_used', 'usage_date']
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                error_msg = f"Missing required columns: {', '.join(missing_columns)}"
                self._update_import_record(import_id, "failed", 0, len(df), error_msg)
                return ImportResult(
                    success=False,
                    message=error_msg,
                    errors=[error_msg],
                    import_id=import_id
                )

            conn = self._get_connection()
            cursor = conn.cursor()

            for index, row in df.iterrows():
                try:
                    # Validate record using Pydantic
                    record = UsageImportRecord(**row.to_dict())

                    # Get cost per unit for calculation
                    cursor.execute('SELECT cost_per_unit FROM inventory WHERE item_name = ?',
                                 (record.item_name,))
                    cost_result = cursor.fetchone()
                    cost = cost_result[0] if cost_result else 0

                    # Insert usage record
                    cursor.execute('''
                        INSERT INTO usage_history
                        (item_name, quantity_used, usage_date, department, cost, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (record.item_name, record.quantity_used, record.usage_date,
                          record.department, record.quantity_used * cost, record.notes))

                    # Update inventory if item exists
                    if cost_result:
                        cursor.execute('''
                            UPDATE inventory
                            SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
                            WHERE item_name = ? AND current_stock >= ?
                        ''', (record.quantity_used, record.item_name, record.quantity_used))

                    imported_records += 1

                except ValidationError as e:
                    error_details = '; '.join([f"{err['loc'][0]}: {err['msg']}" for err in e.errors()])
                    error_msg = f"Row {index + 1}: {error_details}"
                    errors.append(error_msg)
                    failed_records += 1
                except Exception as e:
                    error_msg = f"Row {index + 1}: {str(e)}"
                    errors.append(error_msg)
                    failed_records += 1

            conn.commit()
            conn.close()

            status = "completed" if failed_records == 0 else "completed_with_errors"
            self._update_import_record(import_id, status, imported_records, failed_records,
                                     json.dumps(errors) if errors else None)

            return ImportResult(
                success=True,
                message=f"Import completed. {imported_records} records imported, {failed_records} failed.",
                imported_records=imported_records,
                failed_records=failed_records,
                errors=errors,
                import_id=import_id
            )

        except Exception as e:
            self._update_import_record(import_id, "failed", 0, 0, str(e))
            return ImportResult(
                success=False,
                message=f"Import failed: {str(e)}",
                errors=[str(e)],
                import_id=import_id
            )

    def get_import_history(self, limit: int = 50) -> List[Dict]:
        """Get import history records"""
        conn = self._get_connection()
        query = '''
            SELECT import_id, import_type, filename, status, imported_records,
                   failed_records, error_details, created_at, updated_at
            FROM import_history
            ORDER BY created_at DESC
            LIMIT ?
        '''
        df = pd.read_sql_query(query, conn, params=[limit])
        conn.close()
        return df.to_dict('records')

    def get_import_status(self, import_id: str) -> Optional[Dict]:
        """Get status of specific import"""
        conn = self._get_connection()
        query = '''
            SELECT import_id, import_type, filename, status, imported_records,
                   failed_records, error_details, created_at, updated_at
            FROM import_history
            WHERE import_id = ?
        '''
        df = pd.read_sql_query(query, conn, params=[import_id])
        conn.close()

        if len(df) > 0:
            return df.iloc[0].to_dict()
        return None