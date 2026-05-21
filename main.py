import logging
import os
import sys
from pathlib import Path
from typing import cast

import webview

from backend.api import Api
from backend.core.data_manager import DataManager
from backend.core.excel_exporter import ExcelExporter


def resource_path(relative_path):
    """Отримує абсолютний шлях до ресурсів для роботи в exe та dev-режимі"""
    # getattr безпечно намагається знайти '_MEIPASS' у sys.
    # Якщо не знаходить (бо ми не в exe) — повертає шлях до поточної папки.
    base_path = getattr(sys, "_MEIPASS", os.path.abspath("."))

    return os.path.join(base_path, relative_path)


# Налаштування логування для відстеження стану нативного діалогового вікна
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("F.Int.Main")


def main():
    if getattr(sys, "frozen", False):
        # Якщо додаток запущено з PyInstaller exe
        base_path = Path(sys.executable).parent
        # Створюємо папку 'Import' поряд з exe для бази даних
        db_import_dir = base_path / "Import"
        db_import_dir.mkdir(parents=True, exist_ok=True)
        db_path = db_import_dir / "Structured_Asset_Base.xlsx"

        # Створюємо папку 'Archive' поряд з exe
        archive_dir = base_path / "Archive"
        archive_dir.mkdir(parents=True, exist_ok=True)

        frontend_dir = base_path / "frontend"
        index_html_path = frontend_dir / "index.html"

        logger.info(f"Запуск додатка F.Int (EXE). Базова директорія: {base_path}, Директорія бази даних: {db_import_dir}, Директорія архіву: {archive_dir}")
    else:
        # Режим розробки
        project_dir = Path(__file__).resolve().parent
        db_path = project_dir / "Import" / "Structured_Asset_Base.xlsx"

        archive_dir = project_dir / "Archive"
        archive_dir.mkdir(parents=True, exist_ok=True)

        frontend_dir = project_dir / "frontend"
        index_html_path = frontend_dir / "index.html"

        logger.info(f"Запуск додатка F.Int (DEV). Робоча директорія: {project_dir}")

    # 1. Ініціалізуємо менеджер даних
    data_manager = DataManager(db_path=db_path)

    # 2. ВИПРАВЛЕНО: Передаємо обидва обов'язкові аргументи
    excel_exporter = ExcelExporter(data_manager=data_manager, archive_dir=archive_dir)

    # 3. Зв'язуємо сервіси ядра з об'єктом маршрутизації API
    api_instance = Api(data_manager=data_manager, excel_exporter=excel_exporter)

    # Завантаження інтерфейсу через локальний шлях движка Chromium
    raw_window = webview.create_window(
        title="F.Int — Система обліку майна",
        url=str(index_html_path),
        js_api=api_instance,
        width=1280,
        height=800,
        min_size=(1024, 768),
        resizable=True,
    )

    # Примусово приводимо тип до чистого webview.Window за допомогою typing.cast
    window = cast(webview.Window, raw_window)

    # Жорстка прив'язка створеного вікна ОС до нашого екземпляра API
    api_instance.set_window(window)

    # Реєстрація системного хука на закриття програми для примусового збереження змін в Excel
    window.events.closing += api_instance.close_app

    # Запуск GUI-потоку pywebview з увімкненим контекстом інструментів розробника
    webview.start(debug=True)


if __name__ == "__main__":
    main()
