import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

# Налаштування логера
logger = logging.getLogger("F.Int.DataManager")


class DataManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._df: Optional[pd.DataFrame] = None
        self._load_data()

    def _load_data(self):
        """Зчитує Excel-базу в пам'ять."""

        if not self.db_path.exists():
            logger.error(f"База даних не знайдена за шляхом: {self.db_path}")
            return
        try:
            self._df = pd.read_excel(self.db_path, engine="openpyxl")
            logger.info(f"Базу даних успішно завантажено ({len(self._df)} рядків).")
        except Exception as e:
            logger.error(f"Помилка при зчитуванні файлу Excel: {e}")

    def _save_to_disk(self):
        """Атомарне збереження DataFrame в Excel."""
        if self._df is not None:
            try:
                self._df.to_excel(self.db_path, index=False, engine="openpyxl")
                logger.info("Дані успішно збережено на диск.")
            except Exception as e:
                logger.error(f"Помилка при збереженні на диск: {e}")

    def get_all_assets(self) -> List[Dict[str, Any]]:
        """Повертає весь масив даних для відображення в таблиці."""
        if self._df is None:
            return []

        # Конвертуємо DataFrame у словник, замінюючи NaN на None для JSON
        data = self._df.where(pd.notnull(self._df), None).to_dict(orient="records")

        # Гарантуємо, що всі ключі словників — рядки (для безпечної передачі в JS)
        return [{str(k): v for k, v in row.items()} for row in data]

    def edit_asset(
        self, uuid: str, payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Оновлює поля конкретного активу."""
        if self._df is None:
            return {"success": False, "error": "База даних не завантажена."}

        # Знаходимо рядок за UUID
        idx = self._df.index[self._df["UUID"] == uuid]
        if len(idx) == 0:
            return {"success": False, "error": "Актив не знайдений."}

        # Оновлюємо дані
        for key, value in payload.items():
            if key in self._df.columns:
                self._df.at[idx[0], key] = value

        self._save_to_disk()
        return {"success": True}

    def bulk_move(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Логіка масового переміщення (зміна МВО та Об'єкта)."""
        if self._df is None:
            return {"success": False, "error": "База даних недоступна."}

        target_mvo = payload.get("new_mvo")
        target_object = payload.get("new_object")

        # Оновлюємо вибрані рядки
        mask = self._df["UUID"].isin(uuids)
        if mask.any():
            self._df.loc[mask, "МВО (Прізвище)"] = target_mvo
            self._df.loc[mask, "Об'єкт"] = target_object
            self._save_to_disk()
            return {"success": True, "processed": int(mask.sum())}

        return {"success": False, "error": "Жодного активу не знайдено для оновлення."}

    def bulk_write_off(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        """Логіка масового списання."""
        if self._df is None:
            return {"success": False, "error": "База даних недоступна."}

        mask = self._df["UUID"].isin(uuids)
        if mask.any():
            self._df.loc[mask, "Кількість (факт)"] = 0
            self._df.loc[mask, "Відмітка про вибуття"] = payload.get(
                "reason", "Списано"
            )
            self._save_to_disk()
            return {"success": True, "processed": int(mask.sum())}

        return {"success": False, "error": "Жодного активу не знайдено для списання."}
