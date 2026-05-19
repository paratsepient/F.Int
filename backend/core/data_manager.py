import logging
from pathlib import Path
from typing import Tuple, List
import pandas as pd

logger = logging.getLogger(__name__)

class DataManager:
    def __init__(self, db_path: str | Path):
        """
        Ініціалізує менеджер даних та завантажує базу з Excel.
        """
        self._db_path = Path(db_path)
        self.df = pd.DataFrame()
        self._reload_from_disk()

    def _reload_from_disk(self) -> None:
        """Перезавантажує DataFrame з диску після ініціалізації або невдалого запису[cite: 144, 147]."""
        try:
            self.df = pd.read_excel(self._db_path, engine='openpyxl')
            logger.info("DataFrame reloaded from disk successfully[cite: 147].")
        except Exception as e:
            logger.critical(f"Failed to load database: {e}")
            raise

    def _save_to_disk(self) -> None:
        """Атомарний запис: збереження у тимчасовий файл із подальшим заміщенням[cite: 146]."""
        tmp_path = self._db_path.with_suffix('.tmp')
        try:
            self.df.to_excel(tmp_path, index=False, engine='openpyxl')
            tmp_path.replace(self._db_path)
        except Exception as e:
            logger.error(f"Atomic save failed: {e}")
            if tmp_path.exists():
                tmp_path.unlink()
            raise

    def bulk_move(
        self, uuids: List[str], new_mvo: str, new_object: str
    ) -> Tuple[List[str], List[str]]:
        """
        Переміщує позиції до нового МВО та Об'єкту.
        Повертає кортеж (processed_uuids, failed_uuids)[cite: 142].
        """
        processed, failed = [], []
        
        mask = self.df['UUID'].isin(uuids)
        found_uuids = set(self.df.loc[mask, 'UUID'].tolist())
        
        # Визначаємо UUID, яких немає в базі [cite: 143]
        failed.extend([u for u in uuids if u not in found_uuids])
        
        if found_uuids:
            try:
                self.df.loc[mask, 'МВО (Прізвище)'] = new_mvo
                self.df.loc[mask, "Об'єкт"] = new_object
                self._save_to_disk()
                processed = list(found_uuids)
            except Exception as e:
                logger.error(f"bulk_move write failed: {e} [cite: 143]")
                self._reload_from_disk()
                failed.extend(list(found_uuids))
                
        return processed, failed

    def bulk_write_off(
        self, uuids: List[str], reason: str, date: str
    ) -> Tuple[List[str], List[str]]:
        """
        Списує позиції: встановлює відмітку про вибуття та обнуляє кількість[cite: 145].
        Повертає кортеж (processed_uuids, failed_uuids)[cite: 145].
        """
        processed, failed = [], []
        
        mask = self.df['UUID'].isin(uuids)
        found_uuids = set(self.df.loc[mask, 'UUID'].tolist())
        failed.extend([u for u in uuids if u not in found_uuids])
        
        if found_uuids:
            try:
                stamp = f"{reason} ({date})" if date else reason
                self.df.loc[mask, 'Відмітка про вибуття'] = stamp
                self.df.loc[mask, 'Кількість (факт)'] = 0
                self._save_to_disk()
                processed = list(found_uuids)
            except Exception as e:
                logger.error(f"bulk_write_off write failed: {e} [cite: 146]")
                self._reload_from_disk()
                failed.extend(list(found_uuids))
                
        return processed, failed