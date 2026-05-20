import logging
from pathlib import Path

import webview

# Імпортуємо наші модулі бекенду
from backend.api import Api
from backend.core.data_manager import DataManager
from backend.core.excel_exporter import ExcelExporter

# Налаштування базового логування для відстеження стану програми в консолі
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("F.Int.Main")


def run_app():
    # 1. Визначаємо шляхи до директорій згідно з архітектурою
    # База даних тепер очікується безпосередньо у папці Import
    db_path = Path("Import/Structured_Asset_Base.xlsx")
    archive_path = Path("Archive")

    # 2. Ініціалізація компонентів бекенду
    # Створюємо єдиний екземпляр DataManager для роботи з Excel
    data_manager = DataManager(db_path)

    # Передаємо ДВА аргументи в Exporter: шлях до архіву та DataManager для зв'язку
    excel_exporter = ExcelExporter(archive_path, data_manager)

    # 3. Створення API шлюзу, який зв'яже Vanilla JS та Python
    api = Api(data_manager, excel_exporter)

    # 4. Створення та конфігурація вікна pywebview
    # Передаємо інстанс api в параметр js_api, щоб він став доступний у фронтенді як window.pywebview.api
    window = webview.create_window(
        "F.Int — Система обліку майна",
        url="frontend/index.html",
        js_api=api,
        width=1200,
        height=800,
        resizable=True,
    )

    # Захист типізації (Type Guard) для Pylance:
    # Перевіряємо, чи об'єкт вікна успішно створився і не є None перед викликом set_window
    if window is not None:
        api.set_window(window)
    else:
        logger.error("Критична помилка: Не вдалося створити головне вікно pywebview")
        return

    # Запуск застосунку в режимі розробника (debug=True дозволяє відкривати інспектор по F12)
    logger.info("Запуск інтерфейсу системи F.Int...")
    webview.start(debug=True)


if __name__ == "__main__":
    run_app()
