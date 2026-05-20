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
        """Повертає полегшений, схлопнутий список для миттєвого рендеру таблиці."""
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

    def close_app(self):
        try:
            self.data_manager.save_final_excel()
        except Exception as e:
            logger.error(f"Помилка збереження: {e}")
        if self._window is not None:
            self._window.destroy()
