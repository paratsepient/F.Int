import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import webview

# Імпорти модулів ядра знаходяться строго вгорі файлу (Відповідність Ruff E402)
from backend.api import Api
from backend.core.data_manager import DataManager
from backend.core.excel_exporter import ExcelExporter

# Налаштування системного логування
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("F.Int.Main")

_data_manager_instance: Optional[DataManager] = None
_window_instance: Optional[webview.Window] = None


def load_settings(root_dir: Path) -> dict:
    """Завантажує конфігураційний файл налаштувань користувача."""
    settings_path = root_dir / "Data" / "settings.json"
    if settings_path.exists():
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.error(f"Помилка читання settings.json: {e}")
    return {}


def create_mock_database(db_path: Path) -> None:
    """Створює тестову базу даних Excel, якщо вона відсутня на диску."""
    if db_path.exists():
        return

    logger.info(f"Базу даних не знайдено. Створення тестового шаблону: {db_path}")
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        # Генерація демонстраційних рядків майна згідно зі специфікацією APP MAP
        mock_data = [
            {
                "UUID": "550e8400-e29b-41d4-a716-446655440000",
                "Найменування": "Ноутбук Lenovo ThinkPad",
                "Інв. / Номенкл. №": "ІНВ-001245",
                "Кількість (факт)": 1,
                "Сума (балансова)": 32000,
                "МВО (Прізвище)": "Іванов А.В.",
                "Об'єкт": "Офіс 302",
                "Відмітка про вибуття": "",
            },
            {
                "UUID": "74758392-a1b2-c3d4-e5f6-7890abcdef12",
                "Найменування": "Монітор 24 Dell",
                "Інв. / Номенкл. №": "ІНВ-001246",
                "Кількість (факт)": 2,
                "Сума (балансова)": 14000,
                "МВО (Прізвище)": "Іванов А.В.",
                "Об'єкт": "Офіс 302",
                "Відмітка про вибуття": "",
            },
            {
                "UUID": "bcda1234-5678-90ab-cdef-1234567890ab",
                "Найменування": "Крісло офісне Aero",
                "Інв. / Номенкл. №": "ІНВ-001247",
                "Кількість (факт)": 5,
                "Сума (балансова)": 27500,
                "МВО (Прізвище)": "Петров С.М.",
                "Об'єкт": "Конференц-зал",
                "Відмітка про вибуття": "",
            },
        ]
        df = pd.DataFrame(mock_data)
        df.to_excel(db_path, index=False, engine="openpyxl")
        logger.info("Тестову базу даних успішно згенеровано.")
    except Exception as e:
        logger.error(f"Не вдалося створити тестову базу даних: {e}")


def on_closed() -> None:
    """
    Викликається автоматично ОС, коли графічне вікно повністю знищено.
    Усуває IPC Deadlock та примусово завершує фонові потоки Bottle і Chromium.
    """
    logger.info("[Lifecycle] Графічне вікно програми знищено.")
    try:
        if _data_manager_instance:
            logger.info(
                "[Lifecycle] Запуск дефенсивного фінального збереження бази даних..."
            )
            _data_manager_instance._save_to_disk()
    except Exception as e:
        logger.error(f"Помилка під час фінального аварійного збереження бази: {e}")
    finally:
        logger.info("[Lifecycle] Миттєва ліквідація процесу на рівні ядра ОС.")
        os._exit(0)


def main() -> None:
    """Запуск та зв'язування компонентів архітектури SPA F.Int."""
    global _data_manager_instance, _window_instance
    root_dir = Path(__file__).parent.resolve()
    db_file = root_dir / "Structured_Asset_Base.xlsx"

    # Гарантуємо наявність файлу бази даних перед ініціалізацією менеджерів
    create_mock_database(db_file)

    # Завантаження користувацьких налаштувань
    user_settings = load_settings(root_dir)
    logger.info(
        f"Конфігурація користувача завантажена: {len(user_settings)} параметрів."
    )

    # Ініціалізація інфраструктури бекенду
    _data_manager_instance = DataManager(db_path=db_file)
    excel_exporter = ExcelExporter(
        archive_dir=root_dir / "Archive", data_manager=_data_manager_instance
    )

    # Створення об'єкта API, який експортується у JavaScript
    api_instance = Api(
        data_manager=_data_manager_instance, excel_exporter=excel_exporter
    )

    html_entry_point = root_dir / "frontend" / "index.html"
    if not html_entry_point.exists():
        logger.error(
            f"Критичний файл інтерфейсу відсутній за шляхом: {html_entry_point}"
        )
        sys.exit(1)

    logger.info("Ініціалізація віконного інтерфейсу pywebview...")

    created_window = webview.create_window(
        title="F.Int — Система обліку майна v1.1",
        url=str(html_entry_point.resolve()),
        js_api=api_instance,
        width=1024,
        height=768,
        min_size=(900, 600),
        background_color="#0f172a",
    )

    # Зберігаємо інстанс вікна для глобального відстеження
    _window_instance = created_window

    # ЗАХИСТ ВІД ПЕРЕcontent_fetcher: Сувора валідація для Pylance
    if created_window is not None:
        created_window.events.closed += on_closed
    else:
        logger.critical("Не вдалося ініціалізувати графічне вікно pywebview.")
        sys.exit(1)

    # Запуск віконного рушія
    webview.start(
        debug=True,
        http_server=True,
        user_agent="F.Int Client (pywebview/Chromium Embedded)",
    )


if __name__ == "__main__":
    main()
