import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import webview

# Налаштування логера для API-шлюзу
logger = logging.getLogger("F.Int.API")


class Api:
    """
    Головний шлюз зв'язку між фронтендом (Vanilla JS) та бекендом (Python).
    Усі методи цього класу автоматично публікуються у window.pywebview.api.
    """

    def __init__(self, data_manager: Any, excel_exporter: Any) -> None:
        self.data_manager = data_manager
        self.excel_exporter = excel_exporter
        self._window: Optional[webview.Window] = None

    def set_window(self, window: webview.Window) -> None:
        """Зберігає посилання на графічне вікно для керування його життєвим циклом."""
        self._window = window

    def get_assets(self) -> List[Dict[str, Any]]:
        """
        Віддає фронтенду масив активів для рендерингу в AssetTable.
        Повертає список словників (рядків з Excel-бази).
        """
        logger.info("Отримано запит get_assets() від інтерфейсу.")
        try:
            # Цей метод ми реалізуємо на наступному кроці у data_manager.py
            return self.data_manager.get_all_assets()
        except Exception as e:
            logger.error(f"Помилка отримання майна з бази: {e}")
            return []

    def bulk_action(
        self, uuids: List[str], action_type: str, mode: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Єдина точка входу для всіх операцій з даними.
        Використовує сучасний синтаксис match/case для безпечної маршрутизації запитів.
        """
        logger.info(
            f"Ініційовано транзакцію | Тип: {action_type} | Режим: {mode} | Позицій: {len(uuids)}"
        )

        try:
            match action_type:
                case "edit":
                    # Редагування однієї картки майна з модального вікна
                    if not uuids:
                        return {
                            "success": False,
                            "error": "Не передано UUID для редагування.",
                        }
                    return self.data_manager.edit_asset(uuids[0], payload, mode)

                case "move":
                    # Масове або одиничне переміщення/зміна МВО
                    return self.data_manager.bulk_move(uuids, payload, mode)

                case "write_off":
                    # Масове або одиничне списання
                    return self.data_manager.bulk_write_off(uuids, payload, mode)

                case "export":
                    # Системний хук: збереження налаштувань користувача з вкладки "Налаштування"
                    if "SYSTEM_CONFIG" in uuids:
                        return self._save_system_config(payload)

                    # Генерація актів та інвентаризаційних описів у вкладці "Документи"
                    return self.excel_exporter.generate_document(uuids, payload, mode)

                case _:
                    logger.warning(
                        f"Відхилено: Невідомий тип операції '{action_type}'."
                    )
                    return {
                        "success": False,
                        "error": f"Невідомий action_type: {action_type}",
                    }

        except Exception as e:
            logger.error(
                f"Критичний збій під час виконання {action_type}: {e}", exc_info=True
            )
            return {"success": False, "error": str(e)}

    def _save_system_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Зберігає налаштування теми та масштабу у файл Data/settings.json"""
        try:
            data_dir = Path("Data")
            data_dir.mkdir(exist_ok=True)
            config_path = data_dir / "settings.json"

            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=4)

            logger.info("Системні налаштування успішно зафіксовано.")
            return {"success": True}
        except Exception as e:
            logger.error(f"Помилка запису settings.json: {e}")
            return {"success": False, "error": str(e)}

    def close_application(self) -> None:
        """
        Нативний виклик із JS.
        Знищує вікно, що автоматично тригерить подію 'closed' у main.py
        для дефенсивного збереження бази і миттєвого виходу.
        """
        logger.info("Отримано команду close_application() від інтерфейсу.")
        if self._window:
            self._window.destroy()
