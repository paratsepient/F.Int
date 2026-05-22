import logging
import os
import sys
from pathlib import Path
from typing import cast

import webview

from backend.api import Api
from backend.core.data_manager import DataManager
from backend.core.excel_exporter import ExcelExporter

# Налаштування логування для моніторингу станів
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("F.Int.Main")


def get_resource_path(relative_path: str) -> str:
    """
    Повертає суворий абсолютний шлях до статичних ресурсів додатка.
    Захищено директивою аналізу типів лінтера для віртуального диска PyInstaller.
    """
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        base_path = Path(str(sys._MEIPASS))  # type: ignore
    else:
        base_path = Path(os.path.abspath(__file__)).parent

    full_path = base_path / relative_path
    return str(full_path.resolve())


def main():
    logger.info("=== Ініціалізація системи обліку майна F.Int ===")

    # Ініціалізація бізнес-логіки бекенду
    data_manager = DataManager()

    # Визначаємо шлях до архіву документів
    archive_directory = data_manager.info_dir / "archive"
    excel_exporter = ExcelExporter(
        archive_dir=archive_directory, data_manager=data_manager
    )

    # Створення об'єкта API-мосту
    api = Api(data_manager, excel_exporter)
    html_entry_point = get_resource_path("frontend/index.html")

    if not os.path.exists(html_entry_point):
        logger.critical(
            f"Критична помилка: Файл фронтенду відсутній за шляхом: {html_entry_point}"
        )
        sys.exit(1)

    # Створення нативного вікна додатка pywebview
    raw_window = webview.create_window(
        title="F.Int — Система обліку майна",
        url=html_entry_point,
        js_api=api,  # type: ignore
        width=1280,
        height=800,
        min_size=(1024, 728),
        text_select=True,
    )

    # Захисний Type Guard для валідації типів у Pylance
    if raw_window is not None:
        window = cast(webview.Window, raw_window)
        api.set_window(window)
        # Реєструємо автоматичне збереження змін при натисканні на системний хрестик ОС
        window.events.closing += api.close_app
    else:
        logger.critical("Не вдалося створити вікно додатка pywebview.")
        sys.exit(1)

    # Запуск головного циклу подій вікна
    # СУВОРЕ ВИМКНЕННЯ DEVTOOLS: debug=False повністю блокує інструменти розробника та контекстне меню
    webview.start(debug=False)


if __name__ == "__main__":
    main()
