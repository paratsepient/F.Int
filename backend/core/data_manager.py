import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger("F.Int.DataManager")


class DataManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.cache_path = db_path.with_suffix(".pkl")
        self._df: Optional[pd.DataFrame] = None
        self._load_data()

    def _load_data(self):
        """Каскадне завантаження бази майна (Кеш .pkl -> Excel -> Порожня таблиця)."""
        if self.cache_path.exists():
            try:
                df_cache = pd.read_pickle(self.cache_path)
                if isinstance(df_cache, pd.DataFrame):
                    self._df = df_cache
                    if self._df is not None:
                        logger.info(
                            f"🚀 Блискавичний запуск: завантажено бінарний кеш ({len(self._df)} рядків)."
                        )
                    return
            except Exception as e:
                logger.warning(
                    f"Не вдалося зчитати швидкий кеш, переходимо до Excel: {e}"
                )

        if self.db_path.exists():
            try:
                df_excel = pd.read_excel(self.db_path, engine="openpyxl")
                if isinstance(df_excel, pd.DataFrame):
                    self._df = df_excel
                    if self._df is not None:
                        logger.info(
                            f"📥 Первинний імпорт: завантажено Excel ({len(self._df)} рядків)."
                        )
                        self._save_cache_to_disk()
                    return
            except Exception as e:
                logger.error(f"Помилка при зчитуванні файлу Excel: {e}")

        logger.warning("⚠️ Жодного файлу не знайдено. Ініціалізація порожнього реєстру.")
        self._df = pd.DataFrame(
            columns=[
                "UUID",
                "Тип",
                "Найменування",
                "Інв. / Номенкл. №",
                "Одиниця виміру",
                "Кількість (факт)",
                "МВО (Прізвище)",
                "Об'єкт",
            ]
        )

    def _save_cache_to_disk(self):
        """Зберігає поточний стан DataFrame у бінарний системний кеш."""
        if self._df is not None:
            try:
                temp_pkl = self.cache_path.with_suffix(".pkl.tmp")
                self._df.to_pickle(temp_pkl)
                os.replace(temp_pkl, self.cache_path)
            except Exception as e:
                logger.error(f"Не вдалося оновити .pkl кеш: {e}")

    def save_final_excel(self):
        """
        Атомарно та синхронно зберігає всі зміни в ОБОХ файлах:
        і в системний кеш (.pkl), і в підсумковий Excel файл (.xlsx).
        """
        if self._df is not None:
            try:
                logger.info(
                    f"⏳ Синхронізація: Збереження фінального Excel-файлу за шляхом {self.db_path}..."
                )

                # 1. Спочатку оновлюємо системний кеш
                self._save_cache_to_disk()

                # 2. Атомарно записуємо дані у Excel через тимчасовий файл
                temp_excel = self.db_path.with_suffix(".xlsx.tmp")
                self._df.to_excel(temp_excel, index=False, engine="openpyxl")
                os.replace(temp_excel, self.db_path)

                logger.info(
                    "✅ Базу даних Excel та системний кеш успішно оновлено на диску."
                )
            except Exception as e:
                logger.error(f"Критична помилка фінального коміту в Excel: {e}")
                # Виправлено Ruff E722: Намагаємося видалити тимчасовий файл у разі збою через Exception
                temp_excel = self.db_path.with_suffix(".xlsx.tmp")
                if temp_excel.exists():
                    try:
                        temp_excel.unlink()
                    except Exception:
                        pass

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        """Повертає повний список позицій для миттєвого рендеру таблиці без групування."""
        if self._df is None or self._df.empty:
            logger.warning("DataFrame порожній або не завантажений.")
            return []

        # Очищаємо дані від NaN (замінюємо на порожні рядки)
        df_clean = self._df.fillna("")

        if "Кількість (факт)" in df_clean.columns:
            df_clean["Кількість (факт)"] = pd.to_numeric(
                df_clean["Кількість (факт)"], errors="coerce"
            ).fillna(0)

        raw_data = df_clean.to_dict(orient="records")

        result = []
        for row in raw_data:
            clean_row = {str(k): v for k, v in row.items()}

            # 1. Відсікаємо непотрібні стовпці Y та Z, а також технічні стовпці
            clean_row.pop("Перекидка на Четверова", None)
            clean_row.pop("Перекидка на Іванова", None)
            keys_to_remove = [k for k in clean_row.keys() if k.startswith("Unnamed")]
            for k in keys_to_remove:
                clean_row.pop(k, None)

            # 2. Гнучка перевірка "Тип майна" -> "Тип"
            # Якщо в Excel колонка називається "Тип майна", дублюємо її в "Тип" для фронтенду
            if "Тип майна" in clean_row:
                clean_row["Тип"] = str(clean_row["Тип майна"]).strip()
            elif "Тип" not in clean_row:
                clean_row["Тип"] = ""

            # 3. НАДІЙНИЙ захист для колонки "Об'єкт" (щоб уникнути помилок на фронтенді)
            # Перевіряємо чи взагагалі існує ключ "Об'єкт" в поточному рядку
            obj_value = clean_row.get("Об'єкт", "")

            # Перетворюємо в рядок, якщо там випадково число (наприклад номер складу чи об'єкта)
            if not isinstance(obj_value, str):
                obj_value = str(obj_value) if obj_value is not None else ""

            obj_value = obj_value.strip()

            if obj_value:
                # Розбиваємо за крапкою з комою, очищаємо від пробілів та пустих значень
                objects_list = [
                    obj.strip() for obj in obj_value.split(";") if obj.strip()
                ]
                clean_row["Об'єкт_список"] = objects_list
                clean_row["Об'єкт"] = ", ".join(objects_list)
            else:
                clean_row["Об'єкт_список"] = []
                clean_row["Об'єкт"] = ""

            # 4. Перестраховка для інших базових полів (щоб фронт не падав через відсутність ключів)
            for mandatory_field in [
                "UUID",
                "Найменування",
                "Інв. / Номенкл. №",
                "МВО (Прізвище)",
            ]:
                if mandatory_field not in clean_row:
                    clean_row[mandatory_field] = ""
                else:
                    # Гарантуємо, що текстові поля віддаються як рядки
                    if mandatory_field != "UUID" and not isinstance(
                        clean_row[mandatory_field], str
                    ):
                        clean_row[mandatory_field] = str(clean_row[mandatory_field])

            result.append(clean_row)

        return result

    def get_assets_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Повертає точну розбивку граф обліку зі збереженням усіх стовпців для модалки."""
        if self._df is None:
            return []
        df_filtered = self._df[self._df["Найменування"] == name].fillna("")
        raw_data = df_filtered.to_dict(orient="records")

        result = []
        for row in raw_data:
            clean_row = {str(k): v for k, v in row.items()}

            clean_row.pop("Перекидка на Четверова", None)
            clean_row.pop("Перекидка на Іванова", None)
            keys_to_remove = [k for k in clean_row.keys() if k.startswith("Unnamed")]
            for k in keys_to_remove:
                clean_row.pop(k, None)

            if "Тип майна" in clean_row and not clean_row.get("Тип"):
                clean_row["Тип"] = clean_row["Тип майна"]

            if "Об'єкт" in clean_row and isinstance(clean_row["Об'єкт"], str):
                objects_list = [
                    obj.strip() for obj in clean_row["Об'єкт"].split(";") if obj.strip()
                ]
                clean_row["Об'єкт_список"] = objects_list
                clean_row["Об'єкт"] = ", ".join(objects_list)
            else:
                clean_row["Об'єкт_список"] = (
                    [clean_row.get("Об'єкт", "")] if clean_row.get("Об'єкт") else []
                )

            result.append(clean_row)

        return result

    def edit_asset(
        self, uuid: str, payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База не завантажена."}

        idx = self._df.index[self._df["UUID"] == uuid]
        if len(idx) == 0:
            return {"success": False, "error": "Актив не знайдений за вказаним UUID."}

        for key, value in payload.items():
            if key in self._df.columns:
                self._df.at[idx[0], key] = value

        self._save_cache_to_disk()
        return {"success": True}

    def bulk_move(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База недоступна."}
        mask = self._df["UUID"].isin(uuids)
        if mask.any():
            self._df.loc[mask, "МВО (Прізвище)"] = payload.get("new_mvo")
            self._df.loc[mask, "Об'єкт"] = payload.get("new_object")
            self._save_cache_to_disk()
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не знайдено."}

    def bulk_write_off(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База недоступна."}
        mask = self._df["UUID"].isin(uuids)
        if mask.any():
            self._df.loc[mask, "Кількість (факт)"] = 0
            self._df.loc[mask, "Відмітка про вибуття"] = payload.get(
                "reason", "Списано"
            )
            self._save_cache_to_disk()
            return {"success": True, "processed": int(mask.sum())}
        return {"success": False, "error": "Позицій не знайдено."}
