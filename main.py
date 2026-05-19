import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import webview

# Імпорти модулів ядра тепер знаходяться строго вгорі файлу (Виправлено E402)
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


def trigger_backup_procedure(root_dir: Path) -> None:
    """Виконує автоматичне резервне копіювання сховища баз даних."""
    global _data_manager_instance
    if _data_manager_instance is None:
        return

    try:
        import shutil
        from datetime import datetime

        settings = load_settings(root_dir)
        backup_dir_str = settings.get("backup_dir", str(root_dir / "Backups"))
        backup_dir = Path(backup_dir_str)
        backup_dir.mkdir(parents=True, exist_ok=True)

        _data_manager_instance._save_to_disk()

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
        backup_filename = f"F.Int_backup_{timestamp}.xlsx"
        backup_path = backup_dir / backup_filename

        shutil.copy2(_data_manager_instance._db_path, backup_path)
        logger.info(f"[Backup] Резервну копію успішно створено: {backup_path}")

        max_backups = settings.get("max_backups_to_keep", 20)
        backup_files = sorted(
            backup_dir.glob("F.Int_backup_*.xlsx"),
            key=lambda f: f.stat().st_mtime,
        )
        while len(backup_files) > max_backups:
            oldest_file = backup_files.pop(0)
            oldest_file.unlink()
            logger.info(f"[Backup] Видалено стару резервну копію: {oldest_file.name}")

    except Exception as e:
        logger.error(f"Критична помилка під час створення резервної копії: {e}")


def on_closing() -> bool:
    """Обробник події перед закриттям вікна програми."""
    global _window_instance
    if _window_instance is None:
        return True

    root_dir = Path(__file__).parent.resolve()

    try:
        logger.info(
            "[Lifecycle] Ініційовано закриття програми. Перевірка стану чернеток..."
        )

        has_drafts = False
        drafts_path = root_dir / "Data" / "drafts.json"

        if drafts_path.exists() and drafts_path.stat().st_size > 0:
            try:
                with open(drafts_path, "r", encoding="utf-8") as f:
                    drafts_data = json.load(f)
                    if isinstance(drafts_data, dict) and len(drafts_data) > 0:
                        has_drafts = True
            except json.JSONDecodeError:
                pass

        if has_drafts:
            confirmed = _window_instance.create_confirmation_dialog(
                "Незбережені дані",
                "У вас є незбережені чернетки документів. Ви впевнені, що хочете закрити програму?",
            )
            if not confirmed:
                logger.info("[Lifecycle] Закриття скасовано користувачем.")
                return False

        trigger_backup_procedure(root_dir)
        logger.info(
            "[Lifecycle] Резервне копіювання виконано. Руйнування контексту програми."
        )
        return True

    except Exception as e:
        logger.error(f"Помилка в обробнику закриття: {e}")
        return True


def on_closed() -> None:
    """Фінальний деструктор рантайму."""
    logger.info("[Lifecycle] Вікно закрито. Примусове завершення потоків веб-сервера.")
    os._exit(0)


def create_mock_database(db_path: Path) -> None:
    """Створює демонстраційну базу даних XLSX при першому запуску середовища."""
    if not db_path.exists():
        logger.info(f"Створення тестового набору даних у {db_path}")
        db_path.parent.mkdir(parents=True, exist_ok=True)
        mock_data = {
            "UUID": [f"uuid-00{i}" for i in range(1, 11)],
            "Найменування": [f"Комп'ютерний стіл серія СЛ-00{i}" for i in range(1, 11)],
            "МВО (Прізвище)": ["Іваненко О.П."] * 5 + ["Петренко В.С."] * 5,
            "Об'єкт": ["Кімната 101"] * 5 + ["Кімната 102"] * 5,
            "Кількість (факт)": [1] * 10,
            "Відмітка про вибуття": [""] * 10,
        }
        df = pd.DataFrame(mock_data)
        df.to_excel(db_path, index=False, engine="openpyxl")


def main() -> None:
    """Запуск та зв'язування компонентів архітектури SPA F.Int."""
    global _data_manager_instance, _window_instance
    root_dir = Path(__file__).parent.resolve()
    db_file = root_dir / "Structured_Asset_Base.xlsx"

    create_mock_database(db_file)

    _data_manager_instance = DataManager(db_path=db_file)
    excel_exporter = ExcelExporter(archive_dir=root_dir / "Archive")

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
        resizable=True,
    )

    if created_window is not None:
        _window_instance = created_window
        _window_instance.events.closing += on_closing
        _window_instance.events.closed += on_closed
    else:
        logger.critical("Не вдалося створити вікно pywebview.")
        sys.exit(1)

    webview.start(debug=True, http_server=True)


if __name__ == "__main__":
    main()
