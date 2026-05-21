import logging
from typing import Any, Dict, List, Optional, cast

import webview

logger = logging.getLogger("F.Int.Api")


class Api:
    def __init__(self, data_manager: Any, excel_exporter: Any):
        self.data_manager = data_manager
        self.excel_exporter = excel_exporter
        self._window: Optional[webview.Window] = None

    def set_window(self, window: webview.Window):
        """Зберігає пряме посилання на головне вікно для виклику системних діалогів."""
        self._window = window

    def get_assets(self) -> List[Dict[str, Any]]:
        """Повертає повний список позицій для відображення в таблиці."""
        try:
            return self.data_manager.get_aggregated_assets()
        except Exception as e:
            logger.error(f"Помилка get_assets: {e}")
            return []

    def get_details_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Запит деталей майна для модального вікна."""
        try:
            return self.data_manager.get_assets_by_name(name)
        except Exception as e:
            logger.error(f"Помилка get_details_by_name: {e}")
            return []

    def bulkAction(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Обробка масових дій (редагування, переміщення, списання)."""
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
            logger.error(f"Помилка в bulkAction: {e}")
            return {"success": False, "error": str(e)}

    def import_excel_file(self) -> Dict[str, Any]:
        """Відкриває системний діалог вибору файлу Excel."""
        active_win = self._window if self._window else webview.active_window()

        if not active_win:
            logger.error("Нативне вікно додатка недоступне.")
            return {"success": False, "error": "Вікно програми неактивне."}

        try:
            dialog_type = cast(int, webview.OPEN_DIALOG)
            file_types = ("Excel Files (*.xlsx)",)

            result = active_win.create_file_dialog(
                dialog_type=dialog_type, file_types=file_types
            )

            if not result:
                return {"success": False, "error": "Операцію скасовано"}

            chosen_path = result[0]
            logger.info(f"Імпорт файлу: {chosen_path}")

            return self.data_manager.import_and_replace_db(chosen_path)

        except Exception as e:
            logger.error(f"Помилка в API імпорту: {e}")
            return {"success": False, "error": str(e)}

    def save_and_exit(self) -> Dict[str, Any]:
        """
        ВИПРАВЛЕНО: Виконує жорстку фінальну транзакцію збереження Excel бази даних.
        Якщо файл Excel заблоковано користувачем, метод НЕ закриє додаток,
        а поверне дескриптор помилки у JavaScript.
        """
        try:
            logger.info(
                "Виклик 'Зберегти та вийти' з фронтенду. Запуск синхронізації..."
            )

            # Викликаємо збереження. Якщо файл заблоковано Excel-ем, тут підніметься Exception
            self.data_manager.save_final_excel()

            # Якщо збереження пройшло без помилок — руйнуємо вікно додатка
            if self._window:
                logger.info(
                    "Синхронізація успішна. Знищення інстансу вікна pywebview..."
                )
                self._window.destroy()
            return {"success": True}

        except Exception as e:
            logger.error(f"Неможливо виконати закриття додатка. Помилка I/O: {e}")
            # Повертаємо опис критичного блокування у UI для відображення через alert()
            return {"success": False, "error": str(e)}

    def close_app(self):
        """Фінальне збереження при закритті вікна ОС через системний хрестик."""
        try:
            logger.info("Системне закриття: виконується фінальний коміт даних.")
            self.data_manager.save_final_excel()
        except Exception as e:
            logger.error(f"Помилка фінального збереження: {e}")
