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
        """Каскадне завантаження бази (Кеш .pkl -> Excel)."""
        if self.cache_path.exists():
            try:
                df_cache = pd.read_pickle(self.cache_path)
                if isinstance(df_cache, pd.DataFrame):
                    self._df = df_cache
                    logger.info(
                        f"🚀 Блискавичний запуск: завантажено кеш ({len(self._df)} рядків)."
                    )
                    return
            except Exception as e:
                logger.warning(f"Не вдалося зчитати .pkl, переходимо до Excel: {e}")

        if self.db_path.exists():
            try:
                df_excel = pd.read_excel(self.db_path, engine="openpyxl")
                if isinstance(df_excel, pd.DataFrame):
                    self._df = df_excel
                    logger.info(f"📥 Первинний імпорт Excel ({len(self._df)} рядків).")
                    self._save_cache_to_disk()
                    return
            except Exception as e:
                logger.error(f"Помилка зчитування Excel: {e}")

        # Порожня структура
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
            self._df.to_pickle(self.cache_path)

    def save_final_excel(self):
        if self._df is not None:
            logger.info("⏳ Скидання даних у фінальний Excel...")
            self._df.to_excel(self.db_path, index=False, engine="openpyxl")
            logger.info("✅ Excel успішно оновлено.")

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        """
        [ОПТИМІЗАЦІЯ] Схлопує 860 рядків в унікальні групи за назвою.
        Фронтенд отримує легкий масив і літає!
        """
        if self._df is None or self._df.empty:
            return []

        # Замінюємо NaN на порожні рядки
        df_clean = self._df.fillna("")

        # Групуємо за 'Найменування', збираючи перші значення характеристик та сумуючи кількість
        agg_rules = {
            "UUID": "first",
            "Тип": "first",
            "Інв. / Номенкл. №": "first",
            "Одиниця виміру": "first",
            "Кількість (факт)": "sum",
            "Об'єкт": lambda x: "Згруповано..." if x.nunique() > 1 else x.iloc[0],
        }

        df_grouped = df_clean.groupby("Найменування", as_index=False).agg(agg_rules)
        raw_data = df_grouped.to_dict(orient="records")

        # Конвертуємо ключі в str для задоволення Pylance
        return [{str(k): v for k, v in row.items()} for row in raw_data]

    def get_assets_by_name(self, name: str) -> List[Dict[str, Any]]:
        """
        Повертає точну розбивку по графах (МВО/Об'єкти) для конкретного імені.
        Викликається при кліку на рядок.
        """
        if self._df is None:
            return []
        df_filtered = self._df[self._df["Найменування"] == name].fillna("")
        raw_data = df_filtered.to_dict(orient="records")

        # Конвертуємо ключі в str для задоволення Pylance
        return [{str(k): v for k, v in row.items()} for row in raw_data]

    def edit_asset(
        self, uuid: str, payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База не завантажена."}

        idx = self._df.index[self._df["UUID"] == uuid]
        if len(idx) == 0:
            return {"success": False, "error": "Актив не знайдений."}

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
        return {"success": False}

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
        return {"success": False}
