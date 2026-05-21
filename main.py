import logging
from pathlib import Path
from typing import cast

import webview

from backend.api import Api
from backend.core.data_manager import DataManager
from backend.core.excel_exporter import ExcelExporter

# Налаштування логування для відстеження стану нативного діалогового вікна
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("F.Int.Main")


def main():
    # Визначення базових робочих шляхів додатка
    project_dir = Path(__file__).resolve().parent
    db_path = project_dir / "Import" / "Structured_Asset_Base.xlsx"
    frontend_dir = project_dir / "frontend"
    index_html_path = frontend_dir / "index.html"

    logger.info(f"Запуск додатка F.Int. Робоча директорія: {project_dir}")

    # 1. Ініціалізуємо менеджер даних
    data_manager = DataManager(db_path=db_path)

    # 2. ЯВНО передаємо data_manager через іменований аргумент (це 100% прибирає помилку Pylance)
    excel_exporter = ExcelExporter(data_manager=data_manager)

    # 3. Зв'язуємо сервіси ядра з об'єктом маршрутизації API (також явно)
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

    # Примусово приводимо тип до чистого webview.Window за допомогою typing.cast.
    window = cast(webview.Window, raw_window)

    # Жорстка прив'язка створеного вікна ОС до нашого екземпляра API
    api_instance.set_window(window)

    # Реєстрація системного хука на закриття програми для примусового збереження змін в Excel
    window.events.closing += api_instance.close_app

    # Запуск GUI-потоку pywebview з увімкненим контекстом інструментів розробника
    webview.start(debug=True)


if __name__ == "__main__":
    main()
