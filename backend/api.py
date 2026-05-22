import logging
import threading
import time
from typing import Any, Dict, List, Optional, cast

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
        try:
            return self.data_manager.get_aggregated_assets()
        except Exception as e:
            logger.error(f"Помилка get_assets: {e}")
            return []

    def add_asset(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            return self.data_manager.add_asset(payload)
        except Exception as e:
            logger.error(f"Помилка add_asset: {e}")
            return {"success": False, "error": str(e)}

    # ВПРОВАДЖЕНО: Маршрут для безповоротного видалення картки майна
    def delete_asset(self, asset_uuid: str) -> Dict[str, Any]:
        try:
            return self.data_manager.delete_asset(asset_uuid)
        except Exception as e:
            logger.error(f"Помилка delete_asset: {e}")
            return {"success": False, "error": str(e)}

    def add_custom_column(self, name: str) -> Dict[str, Any]:
        try:
            return self.data_manager.add_custom_column(name)
        except Exception as e:
            return {"success": False, "error": str(e)}

    def delete_custom_column(self, name: str) -> Dict[str, Any]:
        try:
            return self.data_manager.delete_custom_column(name)
        except Exception as e:
            return {"success": False, "error": str(e)}

    def bulkAction(self, config: Dict[str, Any]) -> Dict[str, Any]:
        try:
            uuids: List[str] = config.get("uuids", [])
            action_type: str = config.get("actionType", "")
            payload: Dict[str, Any] = config.get("payload", {})

            if action_type == "edit":
                if len(uuids) == 1:
                    return self.data_manager.edit_asset(uuids[0], payload, "write")
                return {"success": False, "error": "Очікується один UUID."}
            return {"success": False, "error": "Операція не підтримується."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_excel_file(self) -> Dict[str, Any]:
        active_win = self._window if self._window else webview.active_window()
        if not active_win:
            return {"success": False, "error": "Вікно програми неактивне."}
        try:
            dialog_type = cast(int, webview.OPEN_DIALOG)
            result = active_win.create_file_dialog(
                dialog_type=dialog_type, file_types=("Excel Files (*.xlsx)",)
            )
            if not result:
                return {"success": False, "error": "Операцію скасовано"}
            return self.data_manager.import_and_replace_db(result[0])
        except Exception as e:
            return {"success": False, "error": str(e)}

    def save_and_exit(self) -> Dict[str, Any]:
        try:
            self.data_manager.save_final_excel()

            def delayed_destroy():
                time.sleep(0.2)
                if self._window:
                    self._window.destroy()

            threading.Thread(target=delayed_destroy, daemon=True).start()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def close_app(self):
        try:
            self.data_manager.save_final_excel()
        except Exception as e:
            logger.error(f"Помилка close_app: {e}")
