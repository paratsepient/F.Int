import logging
from typing import Any, Dict, List, Optional

import webview

logger = logging.getLogger("F.Int.Api")


class Api:
    def __init__(self, data_manager: Any, excel_exporter: Any):
        self.data_manager = data_manager
        self.excel_exporter = excel_exporter
        self._window: Optional[webview.Window] = None

    def set_window(self, window: webview.Window):
        self._window = window

    def get_assets(self) -> List[Dict[str, Any]]:
        """Повертає повний, розгорнутий список позицій для миттєвого рендеру таблиці."""
        try:
            return self.data_manager.get_aggregated_assets()
        except Exception as e:
            logger.error(f"Помилка get_assets: {e}")
            return []

    def get_details_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Точковий швидкий запит граф (МВО/Локацій) для модалки при кліку на майно."""
        try:
            return self.data_manager.get_assets_by_name(name)
        except Exception as e:
            logger.error(f"Помилка get_details_by_name: {e}")
            return []

    def bulkAction(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Обробка масових дій над майном (редагування, переміщення, списання, експорт)."""
        try:
            uuids: List[str] = config.get("uuids", [])
            action_type: str = config.get("actionType", "")
            mode: str = config.get("mode", "preview")
            payload: Dict[str, Any] = config.get("payload", {})

            match action_type:
                case "edit":
                    if len(uuids) == 1:
                        return self.data_manager.edit_asset(uuids[0], payload, mode)
                    return {"success": False, "error": "Очікується один UUID."}
                case "move":
                    return self.data_manager.bulk_move(uuids, payload, mode)
                case "write_off":
                    return self.data_manager.bulk_write_off(uuids, payload, mode)
                case "export":
                    return self.excel_exporter.generate_document(uuids, payload, mode)
                case _:
                    return {"success": False, "error": "Невідома операція."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def save_and_exit(self) -> Dict[str, Any]:
        """
        Явний міст для кнопки 'Зберегти та вийти' в інтерфейсі.
        Викликає повну синхронізацію файлів та закриває вікно додатка.
        """
        try:
            logger.info(
                "Виклик 'Зберегти та вийти' з фронтенду. Синхронізація даних..."
            )
            self.data_manager.save_final_excel()

            if self._window is not None:
                self._window.destroy()
            return {"success": True}
        except Exception as e:
            logger.error(f"Критична помилка при збереженні та виході: {e}")
            return {"success": False, "error": str(e)}

    def close_app(self):
        """
        Автоматичний тригер закриття додатка (перехоплює клік на системний хрестик вікна).
        Виконує фінальне атомарне збереження. Вікно закриється автоматично після завершення методу.
        """
        try:
            logger.info(
                "🚨 Системний сигнал закриття вікна! Виконуємо автоматичний фінальний коміт даних у кеш та Excel..."
            )
            self.data_manager.save_final_excel()
        except Exception as e:
            logger.error(f"Помилка фінального збереження: {e}")
