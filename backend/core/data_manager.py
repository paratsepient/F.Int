import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List
import pandas as pd

logger = logging.getLogger("F.Int.DataManager")


def split_complex_object(obj_text: str) -> List[str]:
    """
    Аналізує текстове поле об'єкта. Розділяє складні комбіновані записи 
    за двома типами сплітерів (крапка з комою ';' та двокрапка ':').
    Додатково розгортає поверхи на кшталт (1 та 4 поверх) для ідеальної фільтрації.
    """
    if not obj_text:
        return []

    # Перетворюємо в рядок для стабільності типів даних Pandas
    obj_text = str(obj_text).strip()

    # Розділяємо рядок як по крапці з комою, так і по двокрапці
    raw_parts = re.split(r'[;:]', obj_text)
    
    # Видаляємо пробіли по краях кожного елемента та відсікаємо пусті рядки
    parts = [p.strip() for p in raw_parts if p.strip()]
    final_list = []

    for part in parts:
        # Регулярний вираз шукає згадки поверхів у круглих дужках
        match = re.search(
            r"^(.*?)\s*\(([^)]*(?:поверх|поверхи|пов)[^)]*)\)", part, re.IGNORECASE
        )
        if match:
            base_name = match.group(1).strip()
            inside_brackets = match.group(2)

            # Витягуємо номери поверхів
            floors = re.findall(r"\d+", inside_brackets)
            if floors:
                for floor in floors:
                    final_list.append(f"{base_name} ({floor} поверх)")
            else:
                final_list.append(part)
        else:
            final_list.append(part)

    # Видаляємо дублікати об'єктів всередині одного запису
    unique_list = []
    for item in final_list:
        if item not in unique_list:
            unique_list.append(item)

    return unique_list


class DataManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.cache_path = db_path.with_suffix(".pkl")
        self._df: pd.DataFrame = pd.DataFrame()
        self._file_not_found: bool = False
        self._load_data()

    def _load_data(self):
        """Пряме завантаження бази майна з Excel з жорстким захистом структури."""
        if self.db_path.exists():
            try:
                df_excel = pd.read_excel(self.db_path, engine="openpyxl")
                if df_excel is not None and isinstance(df_excel, pd.DataFrame):
                    self._df = df_excel
                    self._file_not_found = False
                    logger.info(
                        f"📥 Базу даних успішно зчитано з диска: {self.db_path} ({len(self._df)} рядків)."
                    )

                    # Гарантуємо наявність службового індексу UUID
                    if "UUID" not in self._df.columns:
                        logger.info(
                            "Створення службового поля UUID для зв'язку рядків із фронтендом..."
                        )
                        self._df.insert(
                            0, "UUID", [str(uuid.uuid4()) for _ in range(len(self._df))]
                        )
                        self.save_final_excel()
                    else:
                        self._df["UUID"] = self._df["UUID"].astype(str)
                    return
            except Exception as e:
                logger.error(f"Помилка при зчитуванні файлу Excel: {e}")

        logger.warning(f"⚠️ Базу Excel не виявлено: {self.db_path}. Перехід у режим очікування імпорту.")
        self._file_not_found = True
        self._df = pd.DataFrame()

    def save_final_excel(self):
        """
        Виконує прямий, синхронний та атомарний перезапис
        оригінального Excel-файлу на диску в реальному часі.
        """
        if self._df is not None and not self._df.empty:
            try:
                try:
                    self._df.to_pickle(self.cache_path)
                except Exception:
                    pass

                self.db_path.parent.mkdir(parents=True, exist_ok=True)

                temp_excel = self.db_path.with_suffix(".xlsx.tmp")
                self._df.to_excel(temp_excel, index=False, engine="openpyxl")
                os.replace(temp_excel, self.db_path)
                self._file_not_found = False
                logger.info(f"💾 ЖОРСТКИЙ ПЕРЕЗАПИС EXCEL ВИКОНАНО: {self.db_path}")
            except Exception as e:
                logger.error(f"Критична помилка запису фінального Excel на диск: {e}")

    def import_and_replace_db(self, source_file_path: str) -> Dict[str, Any]:
        """
        Переміщує обраний користувачем файл у робочу директорію програми,
        ініціалізує новий реєстр і парсить структуру даних.
        """
        try:
            src = Path(source_file_path)
            if not src.exists():
                return {"success": False, "error": "Обраний файл фізично не існує у системі."}

            self.db_path.parent.mkdir(parents=True, exist_ok=True)

            # Атомарне копіювання з файлової системи ОС у робочий каталог
            shutil.copy2(src, self.db_path)
            logger.info(f"Файлю бази успішно імпортовано з {src} за шляхом {self.db_path}")

            # Форсуємо перезапуск зчитування
            self._load_data()

            if self._file_not_found or self._df.empty:
                return {"success": False, "error": "Файл скопійовано, але Pandas не зміг його десеріалізувати."}

            return {"success": True, "rows_imported": len(self._df)}
        except Exception as e:
            logger.error(f"Помилка виконання import_and_replace_db: {e}")
            return {"success": False, "error": str(e)}

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        """
        Формує розгорнутий масив майна для миттєвого відображення у таблиці.
        Виконує глибоке очищення та мульти-розділення об'єктів для фронтенду.
        """
        if self._file_not_found or self._df is None or self._df.empty:
            if not self.db_path.exists():
                return [{"__SYSTEM_STATUS__": "FILE_NOT_FOUND"}]
            self._load_data()
            if self._df.empty:
                return []

        df_clean = self._df.fillna("")
        if "Кількість (факт)" in df_clean.columns:
            df_clean["Кількість (факт)"] = pd.to_numeric(
                df_clean["Кількість (факт)"], errors="coerce"
            ).fillna(0)

        raw_data = df_clean.to_dict(orient="records")
        result = []

        for row in raw_data:
            clean_row = {str(k): v for k, v in row.items()}
            clean_row.pop("Перекидка на Четверова", None)
            clean_row.pop("Перекидка на Іванова", None)

            for k in list(clean_row.keys()):
                if k.startswith("Unnamed"):
                    clean_row.pop(k, None)

            if "Тип майна" in clean_row:
                clean_row["Тип"] = str(clean_row["Тип майна"]).strip()
            elif "Тип" not in clean_row:
                clean_row["Тип"] = ""

            obj_value = clean_row.get("Об'єкт", "")
            if not isinstance(obj_value, str):
                obj_value = str(obj_value) if obj_value is not None else ""

            # Динамічне розділення об'єктів по ';' та ':'
            objects_list = split_complex_object(obj_value)
            clean_row["Об'єкт_список"] = objects_list  
            clean_row["Об'єкт"] = ", ".join(objects_list)  

            for mandatory_field in [
                "Найменування",
                "Інв. / Номенкл. №",
                "МВО (Прізвище)",
                "UUID",
            ]:
                if mandatory_field not in clean_row:
                    clean_row[mandatory_field] = ""
                else:
                    if not isinstance(clean_row[mandatory_field], str):
                        clean_row[mandatory_field] = str(clean_row[mandatory_field])

            result.append(clean_row)

        return result

    def get_assets_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Точковий запит усіх позицій за назвою для відображення деталей."""
        if self._df is None or self._df.empty:
            return []

        df_filtered = self._df[self._df["Найменування"] == name].fillna("")
        raw_data = df_filtered.to_dict(orient="records")

        result = []
        for row in raw_data:
            clean_row = {str(k): v for k, v in row.items()}
            clean_row.pop("Перекидка на Четверова", None)
            clean_row.pop("Перекидка на Іванова", None)

            for k in list(clean_row.keys()):
                if k.startswith("Unnamed"):
                    clean_row.pop(k, None)

            if "Тип майна" in clean_row:
                clean_row["Тип"] = str(clean_row["Тип майна"]).strip()
            elif "Тип" not in clean_row:
                clean_row["Тип"] = ""

            obj_value = clean_row.get("Об'єкт", "")
            if isinstance(obj_value, str):
                objects_list = split_complex_object(obj_value)
                clean_row["Об'єкт_список"] = objects_list
                clean_row["Об'єкт"] = ", ".join(objects_list)
            else:
                clean_row["Об'єкт_список"] = []

            result.append(clean_row)

        return result

    def edit_asset(self, uuid: str, payload: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Атомарна зміна інформації про одну позицію майна з жорстким Type Guarding."""
        if self._df is None or self._df.empty:
            return {"success": False, "error": "Реєстр порожній."}

        idx = self._df.index[self._df["UUID"].astype(str) == str(uuid)]
        if len(idx) == 0:
            return {"success": False, "error": f"Актив не знайдений: {uuid}"}

        row_idx = idx[0]
        for key, value in payload.items():
            if key in ["UUID", "Об'єкт_список"]:
                continue

            actual_key = key
            
            # Мапінг гнучких імен полів форми на колонки реєстру DataFrame
            if key == "Тип" or key == "Тип майна":
                actual_key = "Тип майна" if "Тип майна" in self._df.columns else "Тип"
            elif key == "Інв. / Номенкл. №" or key == "Інвентарний / Номенклатурний №":
                actual_key = "Інвентарний / Номенклатурний №" if "Інвентарний / Номенклатурний №" in self._df.columns else "Інв. / Номенкл. №"
            elif key == "Підрозділ" or key == "Підрозділ (Частина)":
                actual_key = "Підрозділ (Частина)" if "Підрозділ (Частина)" in self._df.columns else "Підрозділ"

            if actual_key in self._df.columns:
                # КРИТИЧНЕ ВИПРАВЛЕННЯ: Захист від помилки invalid value for dtype float64
                if pd.api.types.is_numeric_dtype(self._df[actual_key]):
                    if value == "" or value is None:
                        safe_value = 0.0
                    else:
                        try:
                            safe_value = float(value)
                        except ValueError:
                            safe_value = 0.0
                    self._df.at[row_idx, actual_key] = safe_value
                else:
                    # Захист текстових полів
                    safe_value = str(value) if value is not None else ""
                    self._df.at[row_idx, actual_key] = safe_value

        self.save_final_excel()
        return {"success": True}

    def bulk_move(self, uuids: List[str], payload: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Масове переміщення обраних ТМЦ на нове МВО чи локацію."""
        if self._df is None or self._df.empty:
            return {"success": False, "error": "Реєстр порожній."}

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "МВО (Прізвище)"] = payload.get("new_mvo")
            self._df.loc[mask, "Об'єкт"] = payload.get("new_object")
            self.save_final_excel()
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не виявлено."}

    def bulk_write_off(self, uuids: List[str], payload: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Масове списання позицій майна."""
        if self._df is None or self._df.empty:
            return {"success": False, "error": "Реєстр порожній."}

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "Кількість (факт)"] = 0
            self._df.loc[mask, "Відмітка про вибуття"] = payload.get("reason", "Списано")
            self.save_final_excel()
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не виявлено."}