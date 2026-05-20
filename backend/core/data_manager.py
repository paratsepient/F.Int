import logging
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
        if self._df is not None:
            try:
                self._df.to_pickle(self.cache_path)
            except Exception as e:
                logger.error(f"Не вдалося оновити .pkl кеш: {e}")

    def save_final_excel(self):
        if self._df is not None:
            try:
                logger.info(
                    f"⏳ Синхронізація: Збереження фінального Excel-файлу за шляхом {self.db_path}..."
                )
                self._df.to_excel(self.db_path, index=False, engine="openpyxl")
                logger.info("✅ Базу даних Excel успішно оновлено на диску.")
            except Exception as e:
                logger.error(f"Критична помилка фінального коміту в Excel: {e}")

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        """Схлопує рядки в унікальні групи за назвою, зберігаючи ВСІ колонки від A до X."""
        if self._df is None or self._df.empty:
            return []

        # Очищаємо дані від NaN (замінюємо на порожні рядки)
        df_clean = self._df.fillna("")

        if "Кількість (факт)" in df_clean.columns:
            df_clean["Кількість (факт)"] = pd.to_numeric(
                df_clean["Кількість (факт)"], errors="coerce"
            ).fillna(0)

        # ДИНАМІЧНО будуємо правила агрегації для ВСІХ наявних стовпців від A до X
        agg_rules = {}
        for col in df_clean.columns:
            if col == "Найменування":
                continue
            elif col == "Кількість (факт)":
                agg_rules[col] = "sum"
            elif col == "Об'єкт":
                agg_rules[col] = lambda x: (
                    "Згруповано..."
                    if x.nunique() > 1
                    else (x.iloc[0] if len(x) > 0 else "")
                )
            else:
                agg_rules[col] = (
                    "first"  # Прокидаємо без змін характеристики з колонок A-X
                )

        available_rules = {k: v for k, v in agg_rules.items() if k in df_clean.columns}

        if "Найменування" not in df_clean.columns:
            logger.warning("Колонка 'Найменування' відсутня в структурі файлу.")
            return []

        df_grouped = df_clean.groupby("Найменування", as_index=False).agg(
            available_rules
        )
        raw_data = df_grouped.to_dict(orient="records")

        return [{str(k): v for k, v in row.items()} for row in raw_data]

    def get_assets_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Повертає точну розбивку граф обліку зі збереженням усіх стовпців для модалки."""
        if self._df is None:
            return []
        df_filtered = self._df[self._df["Найменування"] == name].fillna("")
        raw_data = df_filtered.to_dict(orient="records")
        return [{str(k): v for k, v in row.items()} for row in raw_data]

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

        if self._df is not None:
            self._df.to_pickle(self.cache_path)
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
