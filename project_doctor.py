import os
import json
import logging
from pathlib import Path

# Налаштування логування для чіткого виводу статусу
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def heal_project_structure(base_path: str | Path = ".") -> None:
    """
    Аналізує структуру проєкту F.Int та автоматично виправляє 
    відсутні або порожні системні файли та директорії.
    """
    root = Path(base_path).resolve()
    logging.info(f"Лікування робочого простору в: {root}")

    # 1. Словник необхідних директорій
    directories = [
        root / "backend" / "core",
        root / "frontend" / "css",
        root / "frontend" / "js" / "components",
        root / "Backups",
        root / "Export",
        root / "Data"
    ]

    # Створення відсутніх папок
    for directory in directories:
        if not directory.exists():
            directory.mkdir(parents=True, exist_ok=True)
            logging.info(f"[ВИПРАВЛЕНО] Створено директорію: {directory.relative_to(root)}")
        else:
            logging.debug(f"[ОК] Директорія існує: {directory.relative_to(root)}")

    # 2. Словник необхідних файлів із базовим контентом для порожніх файлів
    # Якщо файл відсутній або має 0 байт, він буде перезаписаний базовим контентом
    files_to_check = {
        # Backend
        root / "backend" / "api.py": "",
        root / "backend" / "core" / "data_manager.py": "",
        root / "backend" / "core" / "excel_exporter.py": "",
        root / "backend" / "core" / "backup_service.py": "",
        
        # Frontend Core
        root / "frontend" / "index.html": "",
        root / "frontend" / "js" / "app.js": "// Ядро маршрутизації",
        root / "frontend" / "js" / "event-bus.js": "// Шина подій",
        root / "frontend" / "js" / "api-bridge.js": "// Зв'язок з pywebview",
        
        # Frontend Components
        root / "frontend" / "js" / "components" / "asset-table.js": "// Таблиця майна",
        root / "frontend" / "js" / "components" / "bulk-action-bar.js": "// Панель дій",
        root / "frontend" / "js" / "components" / "filter-panel.js": "// Панель фільтрів",
        root / "frontend" / "js" / "components" / "edit-modal.js": "// Вікно редагування",
        root / "frontend" / "js" / "components" / "add-modal.js": "// Вікно додавання",
        root / "frontend" / "js" / "components" / "document-editor.js": "// Редактор документів",
        root / "frontend" / "js" / "components" / "archive-panel.js": "// Архів документів",
        root / "frontend" / "js" / "components" / "settings.js": "// Логіка налаштувань",
        
        # Styles (заглушки, щоб не було 404)
        root / "frontend" / "css" / "tokens.css": "/* Базові змінні */\n:root {}",
        root / "frontend" / "css" / "bulk-actions.css": "/* Стилі масових дій */",
        
        # Entry Point
        root / "main.py": ""
    }

    # 3. JSON конфіги (обов'язковий валідний JSON)
    json_configs = {
        root / "Data" / "settings.json": {
            "theme": "System",
            "scale": 100,
            "font_size": 13,
            "backup_on_close": True,
            "backup_interval_minutes": 30,
            "max_backups_to_keep": 20,
            "export_dir": str((root / "Export").resolve()),
            "backup_dir": str((root / "Backups").resolve())
        },
        root / "Data" / "drafts.json": {}
    }

    # Аналіз та виправлення Python/JS/CSS/HTML файлів
    for file_path, fallback_content in files_to_check.items():
        if not file_path.exists():
            # Якщо файлу взагалі немає, створюємо з базовим контентом
            file_path.write_text(fallback_content, encoding="utf-8")
            logging.warning(f"[ВИПРАВЛЕНО] Створено відсутній файл: {file_path.relative_to(root)}")
        elif file_path.stat().st_size == 0 and fallback_content:
            # Якщо файл є, але він порожній (0 байт) і ми маємо що туди записати
            file_path.write_text(fallback_content, encoding="utf-8")
            logging.warning(f"[ВИПРАВЛЕНО] Заповнено порожній файл (0 байт): {file_path.relative_to(root)}")
        else:
            logging.debug(f"[ОК] Файл валідний: {file_path.relative_to(root)}")

    # Аналіз та виправлення JSON файлів
    for json_path, default_data in json_configs.items():
        needs_fix = False
        if not json_path.exists():
            needs_fix = True
            logging.warning(f"[ВИПРАВЛЕНО] Відсутній конфіг. Створено: {json_path.relative_to(root)}")
        elif json_path.stat().st_size == 0:
            needs_fix = True
            logging.warning(f"[ВИПРАВЛЕНО] Конфіг порожній (0 байт). Заповнено базовим JSON: {json_path.relative_to(root)}")
        else:
            # Перевірка на валідність JSON
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    json.load(f)
                logging.debug(f"[ОК] JSON валідний: {json_path.relative_to(root)}")
            except json.JSONDecodeError:
                needs_fix = True
                logging.error(f"[ВИПРАВЛЕНО] Битий JSON. Перезаписано базовим: {json_path.relative_to(root)}")

        if needs_fix:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(default_data, f, indent=4, ensure_ascii=False)

    logging.info("Лікування завершено. Структура відповідає стандартам APP MAP v1.1.")

if __name__ == "__main__":
    heal_project_structure()
