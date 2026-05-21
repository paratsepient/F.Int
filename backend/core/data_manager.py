import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, cast

import openpyxl
import pandas as pd
from openpyxl.cell.cell import Cell
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

logger = logging.getLogger("F.Int.DataManager")


def split_complex_object(obj_text: str) -> List[str]:
    """
    Глибокий парсер текстового поля об'єкта.
    Розділяє мульти-об'єкти (по ';' та ':') та повністю розгортає
    переліки поверхів у форматі "Штаб (1, 2 та 3 поверх)"
    на масив чистих рядків без дужок.
    """
    if not obj_text:
        return []

    obj_text = str(obj_text).strip()
    raw_parts = re.split(r"[;:]", obj_text)
    parts = [p.strip() for p in raw_parts if p.strip()]
    final_list = []

    for part in parts:
        # Шукаємо назву об'єкта та вміст дужок із поверхами
        match = re.search(
            r"^(.*?)\s*\(([^)]*(?:поверх|поверхи|пов)[^)]*)\)", part, re.IGNORECASE
        )
        if match:
            base_name = match.group(1).strip()
            inside_brackets = match.group(2)

            # Витягуємо всі цифри-поверхи з дужок
            floors = re.findall(r"\d+", inside_brackets)
            if floors:
                for floor in floors:
                    # Конструюємо чисту назву без дужок для зручності сортування
                    final_list.append(f"{base_name} {floor} поверх")
            else:
                final_list.append(part)
        else:
            final_list.append(part)

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

                    if "UUID" not in self._df.columns:
                        logger.info("Створення службового поля UUID...")
                        self._df.insert(
                            0, "UUID", [str(uuid.uuid4()) for _ in range(len(self._df))]
                        )
                        self.save_final_excel()
                    else:
                        self._df["UUID"] = self._df["UUID"].astype(str)
                    return
            except Exception as e:
                logger.error(f"Помилка при зчитуванні файлу Excel: {e}")

        logger.warning(f"⚠️ Базу Excel не виявлено: {self.db_path}. Очікування імпорту.")
        self._file_not_found = True
        self._df = pd.DataFrame()

    def save_final_excel(self):
        """
        Синхронний атомарний запис у фізичний Excel з глибоким форматуванням openpyxl.
        У разі блокування файлу процесом ОС (наприклад, відкритий в Excel),
        викидає чітке виключення для скасування операції закриття.
        """
        if self._df is None or self._df.empty:
            return

        # Гарантуємо наявність цільової директорії
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        temp_excel = self.db_path.with_name(self.db_path.stem + "_tmp.xlsx")

        try:
            # Дамп сирих даних через Pandas у тимчасовий файл
            self._df.to_excel(temp_excel, index=False, engine="openpyxl")

            # Пост-процесинг та стилізація через openpyxl
            wb = openpyxl.load_workbook(temp_excel)
            ws = cast(Worksheet, wb.active)

            base_font = Font(name="Times New Roman", size=12)
            header_font = Font(
                name="Times New Roman", size=12, bold=True, color="FFFFFFFF"
            )
            header_fill = PatternFill(
                start_color="FF3B82F6", end_color="FF3B82F6", fill_type="solid"
            )
            alignment = Alignment(vertical="center", wrap_text=False)

            # Застосування висоти рядків та шрифтів
            for row_idx, row in enumerate(ws.iter_rows(), start=1):
                ws.row_dimensions[row_idx].height = 20
                for cell in row:
                    c = cast(Cell, cell)
                    c.alignment = alignment
                    if row_idx == 1:
                        c.font = header_font
                        c.fill = header_fill
                    else:
                        c.font = base_font

            # Автофіт ширини колонок
            for col in ws.columns:
                max_length = 0
                first_cell = cast(Cell, col[0])
                col_letter = first_cell.column_letter

                for cell in col:
                    c = cast(Cell, cell)
                    if c.value:
                        max_length = max(max_length, len(str(c.value)))

                adjusted_width = min(max_length + 2, 55)
                ws.column_dimensions[col_letter].width = adjusted_width

            # Увімкнення автофільтрів
            if ws.dimensions:
                ws.auto_filter.ref = ws.dimensions

            wb.save(temp_excel)
            wb.close()

            # АТОМАРНА ЗАМІНА ФАЙЛУ З КОНТРОЛЕМ ДЕКСКРИПТОРІВ ОС
            if self.db_path.exists():
                try:
                    os.replace(temp_excel, self.db_path)
                except PermissionError as pe:
                    raise PermissionError(
                        "Доступ обмежено ОС. Будь ласка, ЗАКРИЙТЕ ФАЙЛ Бази даних в Microsoft Excel або сторонніх редакторах перед збереженням зміни!"
                    ) from pe
            else:
                os.replace(temp_excel, self.db_path)

            # Оновлюємо бінарний кеш після успішного збереження основного файлу
            try:
                self._df.to_pickle(self.cache_path)
            except Exception:
                pass

            self._file_not_found = False
            logger.info(f"💾 ЖОРСТКИЙ ПЕРЕЗАПИС EXCEL ВИКОНАНО УСПІШНО: {self.db_path}")

        except Exception as e:
            # ВИПРАВЛЕНО Е722: Замінено bare-except на перехоплення загального класу Exception,
            # що дозволяє лінтеру Ruff пропустити код, а системним сигналам завершення ОС працювати справно.
            if os.path.exists(temp_excel):
                try:
                    os.remove(temp_excel)
                except Exception:
                    pass
            logger.error(f"Критична помилка збереження Excel-бази: {e}")
            raise e

    def import_and_replace_db(self, source_file_path: str) -> Dict[str, Any]:
        """Імпорт та парсинг нової структури даних з миттєвим застосуванням форматування."""
        try:
            src = Path(source_file_path)
            if not src.exists():
                return {
                    "success": False,
                    "error": "Обраний файл фізично не існує у системи.",
                }

            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, self.db_path)

            self._load_data()

            if self._file_not_found or self._df.empty:
                return {
                    "success": False,
                    "error": "Файл скопійовано, але Pandas не зміг його десеріалізувати.",
                }

            self.save_final_excel()
            return {"success": True, "rows_imported": len(self._df)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        """Видача масиву для фронтенд таблиці з очищенням NaN."""
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
        """Точковий запит позицій за назвою."""
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

    def edit_asset(
        self, uuid: str, payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Атомарна зміна інформації про позицію майна."""
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
            if key == "Тип" or key == "Тип майна":
                actual_key = "Тип майна" if "Тип майна" in self._df.columns else "Тип"
            elif key == "Інв. / Номенкл. №" or key == "Інвентарний / Номенклатурний №":
                actual_key = (
                    "Інвентарний / Номенклатурний №"
                    if "Інвентарний / Номенклатурний №" in self._df.columns
                    else "Інв. / Номенкл. №"
                )
            elif key == "Підрозділ" or key == "Підрозділ (Частина)":
                actual_key = (
                    "Підрозділ (Частина)"
                    if "Підрозділ (Частина)" in self._df.columns
                    else "Підрозділ"
                )

            if actual_key in self._df.columns:
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
                    safe_value = str(value) if value is not None else ""
                    self._df.at[row_idx, actual_key] = safe_value

        try:
            self.save_final_excel()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def bulk_move(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Масове переміщення обраних ТМЦ."""
        if self._df is None or self._df.empty:
            return {"success": False, "error": "Реєстр порожній."}

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "МВО (Прізвище)"] = payload.get("new_mvo")
            self._df.loc[mask, "Об'єкт"] = payload.get("new_object")
            try:
                self.save_final_excel()
                return {"success": True, "processed": int(mask.sum())}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Позицій не виявлено."}

    def bulk_write_off(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Масове списання позицій майна."""
        if self._df is None or self._df.empty:
            return {"success": False, "error": "Реєстр порожній."}

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "Кількість (факт)"] = 0
            self._df.loc[mask, "Відмітка про вибуття"] = payload.get(
                "reason", "Списано"
            )
            try:
                self.save_final_excel()
                return {"success": True, "processed": int(mask.sum())}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Позицій не виявлено."}
