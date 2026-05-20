import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger("F.Int.DataManager")


def split_complex_object(obj_text: str) -> List[str]:
    """
    Аналізує текстове поле об'єкта. Якщо знаходить складні формати поверхів,
    наприклад: "Штаб Адміністрації (1 та 4 поверх)" або "Штаб (1, 2 поверх)",
    розділяє їх на самостійні записи для ідеального сортування та фільтрації:
    ["Штаб Адміністрації (1 поверх)", "Штаб Адміністрації (4... поверх)"]
    """
    if not obj_text:
        return []

    # Ділимо спочатку по стандартній крапці з комою
    parts = [p.strip() for p in obj_text.split(";") if p.strip()]
    final_list = []

    for part in parts:
        # Регулярний вираз шукає згадки поверхів всередині круглих дужок
        match = re.search(
            r"^(.*?)\s*\(([^)]*(?:поверх|поверхи|пов)[^)]*)\)", part, re.IGNORECASE
        )
        if match:
            base_name = match.group(1).strip()
            inside_brackets = match.group(2)

            # Витягуємо всі послідовні цифри (номери поверхів)
            floors = re.findall(r"\d+", inside_brackets)
            if floors:
                for floor in floors:
                    final_list.append(f"{base_name} ({floor} поверх)")
            else:
                final_list.append(part)
        else:
            final_list.append(part)

    return final_list


class DataManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.cache_path = db_path.with_suffix(".pkl")
        self._df: pd.DataFrame = pd.DataFrame()
        self._load_data()

    def _load_data(self):
        """Пряме завантаження бази майна з Excel з жорстким захистом структури."""
        if self.db_path.exists():
            try:
                df_excel = pd.read_excel(self.db_path, engine="openpyxl")
                if df_excel is not None and isinstance(df_excel, pd.DataFrame):
                    self._df = df_excel
                    logger.info(
                        f"📥 Базу даних успішно зчитано з диска: {self.db_path} ({len(self._df)} рядків)."
                    )

                    # Гарантуємо наявність та незмінність колонки UUID в Excel
                    if "UUID" not in self._df.columns:
                        logger.info(
                            "Створення службового поля UUID для зв'язку рядків із фронтендом..."
                        )
                        self._df.insert(
                            0, "UUID", [str(uuid.uuid4()) for _ in range(len(self._df))]
                        )
                        self.save_final_excel()  # Відразу записуємо UUID на диск
                    else:
                        self._df["UUID"] = self._df["UUID"].astype(str)
                    return
            except Exception as e:
                logger.error(f"Помилка при зчитуванні файлу Excel: {e}")

        logger.warning(
            "⚠️ Файл бази даних Excel не знайдено. Ініціалізація порожнього реєстру."
        )
        self._df = pd.DataFrame(
            columns=[
                "UUID",
                "Тип майна",
                "Найменування",
                "Інв. / Номенкл. №",
                "Одиниця виміру",
                "Кількість (факт)",
                "МВО (Прізвище)",
                "Об'єкт",
            ]
        )

    def save_final_excel(self):
        """
        КРИТИЧНА ФУНКЦІЯ: Виконує прямий, синхронний та атомарний перезапис
        оригінального Excel-файлу на диску поруч із програмою.
        """
        if self._df is not None and isinstance(self._df, pd.DataFrame):
            try:
                # Зберігаємо також бінарний кеш на випадок каскадних операцій
                try:
                    self._df.to_pickle(self.cache_path)
                except Exception:
                    pass

                # Атомарний безпечний запис Excel через тимчасовий файл
                temp_excel = self.db_path.with_suffix(".xlsx.tmp")
                self._df.to_excel(temp_excel, index=False, engine="openpyxl")
                os.replace(temp_excel, self.db_path)
                logger.info(
                    f"💾 ЖОРСТКИЙ ПЕРЕЗАПИС EXCEL ВИКОНАНО У РЕАЛЬНОМУ ЧАСІ: {self.db_path}"
                )
            except Exception as e:
                logger.error(f"Критична помилка запису фінального Excel на диск: {e}")

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        if self._df is None or self._df.empty:
            self._load_data()

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

            # Формуємо лаконічний 'Тип' для 7-колонкового фронтенду
            if "Тип майна" in clean_row:
                clean_row["Тип"] = str(clean_row["Тип майна"]).strip()
            elif "Тип" not in clean_row:
                clean_row["Тип"] = ""

            obj_value = clean_row.get("Об'єкт", "")
            if not isinstance(obj_value, str):
                obj_value = str(obj_value) if obj_value is not None else ""
            obj_value = obj_value.strip()

            # Динамічне автоматичне розділення поверхів для сортування в таблиці
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
        if self._df is None or self._df.empty:
            self._load_data()

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
        if self._df is None or self._df.empty:
            self._load_data()

        # Точковий пошук індексу рядка за незмінним UUID
        idx = self._df.index[self._df["UUID"].astype(str) == str(uuid)]
        if len(idx) == 0:
            logger.warning(f"⚠️ Рядок з UUID {uuid} не знайдено.")
            return {"success": False, "error": f"Актив не знайдений: {uuid}"}

        row_idx = idx[0]
        for key, value in payload.items():
            if key in ["UUID", "Об'єкт_список"]:
                continue

            # Співвідношення фронтенд-поля 'Тип' з колонкою 'Тип майна' всередині Excel
            actual_key = key
            if (
                key == "Тип"
                and "Тип" not in self._df.columns
                and "Тип майна" in self._df.columns
            ):
                actual_key = "Тип майна"

            if actual_key in self._df.columns:
                self._df.at[row_idx, actual_key] = value

        # 💡 КРИТИЧНЕ ВИПРАВЛЕННЯ: Кожне збереження картки майна тепер ОДРАЗУ
        # перезаписує фізичний .xlsx файл на вашому диску в реальному часі!
        self.save_final_excel()
        return {"success": True}

    def bulk_move(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None or self._df.empty:
            self._load_data()

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "МВО (Прізвище)"] = payload.get("new_mvo")
            self._df.loc[mask, "Об'єкт"] = payload.get("new_object")
            self.save_final_excel()  # Відразу пишемо масове переміщення в Excel файл
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не знайдено."}

    def bulk_write_off(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None or self._df.empty:
            self._load_data()

        str_uuids = [str(u) for u in uuids]
        mask = self._df["UUID"].astype(str).isin(str_uuids)
        if mask.any():
            self._df.loc[mask, "Кількість (факт)"] = 0
            self._df.loc[mask, "Відмітка про вибуття"] = payload.get(
                "reason", "Списано"
            )
            self.save_final_excel()  # Відразу пишемо масове списання в Excel файл
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не знайдено."}
