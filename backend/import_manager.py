import pandas as pd
import io
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, ValidationError, validator
import chardet
import json
from universal_parser import UniversalFileParser

class ImportResult(BaseModel):
    success: bool
    message: str
    imported_records: int = 0
    failed_records: int = 0
    errors: List[str] = []
    import_id: Optional[str] = None
    confidence: float = 0.0
    accuracy_assessment: Optional[Dict[str, Any]] = None

class InventoryImportRecord(BaseModel):
    item_name: str
    category: str
    number_items: int  # Changed from current_stock to number_items for additive imports
    min_stock_level: Optional[int] = 50
    max_stock_level: Optional[int] = 1000
    cost_per_unit: float
    supplier: Optional[str] = None
    expiration_risk: Optional[str] = "Low"

    @validator('number_items', 'min_stock_level', 'max_stock_level')
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
        self.parser = UniversalFileParser()

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def _detect_encoding(self, file_content: bytes) -> str:
        """Detect file encoding"""
        result = chardet.detect(file_content)
        return result['encoding'] or 'utf-8'

    def _read_file_content(self, file_content: bytes, filename: str, data_type: str = 'inventory') -> Tuple[pd.DataFrame, Dict]:
        """Read file content using universal parser and return DataFrame and metadata"""
        try:
            result = self.parser.parse_file(file_content, filename, data_type)

            if not result['success']:
                raise ValueError(result['error'])

            df = pd.DataFrame(result['data'])
            metadata = result['metadata']

            if df.empty:
                raise ValueError("No data found in file")

            return df, metadata

        except Exception as e:
            raise ValueError(f"Error parsing file: {str(e)}")

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
            df, metadata = self._read_file_content(file_content, filename, 'inventory')

            # Check confidence level from universal parser
            confidence = metadata.get('confidence', 0)
            if confidence < 50:
                error_msg = f"Low confidence ({confidence:.1f}%) in data parsing. Please check file format and column headers."
                errors.append(error_msg)

            # Validate required columns (using mapped columns)
            required_columns = ['item_name']
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                error_msg = f"Missing required columns: {', '.join(missing_columns)}. Parsed columns: {list(df.columns)}"
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
                    # Create record dict with defaults for missing fields
                    record_dict = {}
                    record_dict['item_name'] = str(row.get('item_name', '')) if pd.notna(row.get('item_name')) else ''
                    record_dict['category'] = str(row.get('category', 'Unknown')) if pd.notna(row.get('category')) else 'Unknown'
                    # Support both number_items (new) and current_stock (legacy) column names
                    if 'number_items' in row and pd.notna(row.get('number_items')):
                        record_dict['number_items'] = int(float(row.get('number_items', 0)))
                    elif 'current_stock' in row and pd.notna(row.get('current_stock')):
                        record_dict['number_items'] = int(float(row.get('current_stock', 0)))
                    else:
                        record_dict['number_items'] = 0
                    record_dict['min_stock_level'] = int(float(row.get('min_stock_level', 50))) if pd.notna(row.get('min_stock_level')) else 50
                    record_dict['max_stock_level'] = int(float(row.get('max_stock_level', 1000))) if pd.notna(row.get('max_stock_level')) else 1000
                    record_dict['cost_per_unit'] = float(row.get('cost_per_unit', 0)) if pd.notna(row.get('cost_per_unit')) else 0.0
                    record_dict['supplier'] = str(row.get('supplier', '')) if pd.notna(row.get('supplier')) else None
                    record_dict['expiration_risk'] = str(row.get('expiration_risk', 'Low')) if pd.notna(row.get('expiration_risk')) else 'Low'

                    # Validate record using Pydantic
                    record = InventoryImportRecord(**record_dict)

                    # Check if item already exists
                    cursor.execute('SELECT id FROM inventory WHERE item_name = ?', (record.item_name,))
                    existing = cursor.fetchone()

                    if existing:
                        # Update existing item - ADD to current stock (additive)
                        cursor.execute('''
                            UPDATE inventory
                            SET category = ?, current_stock = current_stock + ?, min_stock_level = ?,
                                max_stock_level = ?, cost_per_unit = ?, supplier = ?,
                                expiration_risk = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE item_name = ?
                        ''', (record.category, record.number_items, record.min_stock_level,
                              record.max_stock_level, record.cost_per_unit, record.supplier,
                              record.expiration_risk, record.item_name))
                    else:
                        # Insert new item - initialize with number_items
                        cursor.execute('''
                            INSERT INTO inventory
                            (item_name, category, current_stock, min_stock_level,
                             max_stock_level, cost_per_unit, supplier, expiration_risk)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (record.item_name, record.category, record.number_items,
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
                import_id=import_id,
                confidence=metadata.get('confidence', 0),
                accuracy_assessment=metadata.get('accuracy_assessment', {})
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
            df, metadata = self._read_file_content(file_content, filename, 'usage')

            # Check confidence level from universal parser
            confidence = metadata.get('confidence', 0)
            if confidence < 50:
                error_msg = f"Low confidence ({confidence:.1f}%) in data parsing. Please check file format and column headers."
                errors.append(error_msg)

            # Validate required columns (using mapped columns)
            required_columns = ['item_name', 'quantity_used']
            missing_columns = [col for col in required_columns if col not in df.columns]

            if missing_columns:
                error_msg = f"Missing required columns: {', '.join(missing_columns)}. Parsed columns: {list(df.columns)}"
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
                    # Create record dict with defaults for missing fields
                    record_dict = {}
                    record_dict['item_name'] = str(row.get('item_name', '')) if pd.notna(row.get('item_name')) else ''
                    record_dict['quantity_used'] = int(float(row.get('quantity_used', 0))) if pd.notna(row.get('quantity_used')) else 0
                    record_dict['usage_date'] = str(row.get('usage_date', datetime.now().strftime('%Y-%m-%d'))) if pd.notna(row.get('usage_date')) else datetime.now().strftime('%Y-%m-%d')
                    record_dict['department'] = str(row.get('department', '')) if pd.notna(row.get('department')) else None
                    record_dict['patient_id'] = str(row.get('patient_id', '')) if pd.notna(row.get('patient_id')) else None
                    record_dict['prescription_id'] = str(row.get('prescription_id', '')) if pd.notna(row.get('prescription_id')) else ''
                    record_dict['notes'] = str(row.get('notes', '')) if pd.notna(row.get('notes')) else None

                    # Validate record using Pydantic
                    record = UsageImportRecord(**record_dict)

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
                import_id=import_id,
                confidence=metadata.get('confidence', 0),
                accuracy_assessment=metadata.get('accuracy_assessment', {})
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