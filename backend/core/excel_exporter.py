import logging
import tempfile
from pathlib import Path
from typing import List, Optional
import pandas as pd

logger = logging.getLogger(__name__)

class ExcelExporter:
    def __init__(self, archive_dir: str | Path = "F.Int/Archive"):
        """
        Ініціалізує підсистему генерації звітів та архівування документів.
        """
        self.archive_dir = Path(archive_dir)
        self.archive_dir.mkdir(parents=True, exist_ok=True)

    def generate_move_act(
        self, uuids: List[str], new_mvo: str, new_object: str, save_to_archive: bool
    ) -> Optional[str]:
        """
        Генерує 'Накладну на переміщення' в форматі Excel.
        """
        try:
            file_name = f"Накладна_Переміщення_{new_mvo.replace(' ', '_')}.xlsx"
            
            if save_to_archive:
                target_path = self.archive_dir / file_name
            else:
                target_path = Path(tempfile.gettempdir()) / file_name
            
            summary_df = pd.DataFrame({
                "UUID": uuids,
                "Статус": ["Переміщено"] * len(uuids),
                "Новий МВО": [new_mvo] * len(uuids),
                "Новий Об'єкт": [new_object] * len(uuids)
            })
            
            summary_df.to_excel(target_path, index=False, engine='openpyxl')
            logger.info(f"Документ переміщення створено: {target_path}")
            return str(target_path.resolve())
        except Exception as e:
            logger.error(f"Помилка генерації документа переміщення: {e}")
            return None

    def generate_write_off_act(
        self, uuids: List[str], reason: str, date: str, save_to_archive: bool
    ) -> Optional[str]:
        """
        Генерує 'Акт списання' активів.
        """
        try:
            file_name = f"Акт_Списання_{date}.xlsx"
            
            if save_to_archive:
                target_path = self.archive_dir / file_name
            else:
                target_path = Path(tempfile.gettempdir()) / file_name
            
            summary_df = pd.DataFrame({
                "UUID": uuids,
                "Статус": ["Списано (Кількість=0)"] * len(uuids),
                "Причина": [reason] * len(uuids),
                "Дата акту": [date] * len(uuids)
            })
            
            summary_df.to_excel(target_path, index=False, engine='openpyxl')
            logger.info(f"Документ списання створено: {target_path}")
            return str(target_path.resolve())
        except Exception as e:
            logger.error(f"Помилка генерації документа списання: {e}")
            return None

    def export_selection(self, uuids: List[str], fmt: str) -> Optional[str]:
        """
        Виконує прямий експорт виділених позицій без фіксації в базі даних та архіві.
        """
        try:
            file_name = f"Експорт_Виділеного_{len(uuids)}_позицій.{fmt}"
            temp_path = Path(tempfile.gettempdir()) / file_name
            
            export_df = pd.DataFrame({
                "UUID": uuids, 
                "Тип Експорту": [fmt.upper()] * len(uuids)
            })
            
            if fmt == "xlsx":
                export_df.to_excel(temp_path, index=False, engine='openpyxl')
            else:
                temp_path.write_text(export_df.to_string(), encoding='utf-8')
                
            logger.info(f"Експортний файл сформовано: {temp_path}")
            return str(temp_path.resolve())
        except Exception as e:
            logger.error(f"Помилка експорту виділення: {e}")
            return None