import importlib.util
import os
import subprocess
import sys


def ensure_dependencies():
    """
    Автоматично перевіряє та встановлює Pillow у поточне середовище виконання.
    ВИПРАВЛЕНО: Використано find_spec замість bare-import для суворої валідації Ruff F401.
    """
    if importlib.util.find_spec("PIL") is None:
        print(
            "[Dependency Engine] Бібліотеку Pillow (PIL) не знайдено. Автоматичне встановлення..."
        )
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "Pillow"], check=True
            )
            print("[Dependency Engine] Інсталяцію Pillow успішно завершено.")
        except subprocess.CalledProcessError as e:
            print(f"[Dependency Engine] Не вдалося встановити Pillow через pip: {e}")
            sys.exit(1)


def generate_icon():
    """Конвертує базовий файл icon.png у сумісний для Windows icon.ico."""
    print("[Icon Engine] Конвертація icon.png -> icon.ico...")
    ensure_dependencies()

    # Використовуємо ізольований імпорт всередині робочого контексту
    from PIL import Image  # type: ignore

    png_path = "icon.png"
    ico_path = "icon.ico"

    if not os.path.exists(png_path):
        print(
            f"[Icon Engine] Критична помилка: Файл '{png_path}' не знайдено в корені проєкту!"
        )
        print(
            "[Icon Engine] Будь ласка, покладіть ваш логотип 'icon.png' поруч зі скриптом compile.py."
        )
        sys.exit(1)

    try:
        img = Image.open(png_path)
        # Запікаємо пул іконок стандартних розмірів Windows для провідника та панелі задач
        img.save(
            ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32)]
        )
        print("[Icon Engine] Нативну іконку 'icon.ico' успішно згенеровано.")
    except Exception as e:
        print(f"[Icon Engine] Не вдалося конвертувати PNG в ICO: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Крок 1. Генерація нативної іконки для ресурсів Windows
    generate_icon()

    # Крок 2. Очищення забагованого кешу PyInstaller
    print("[Clean Engine] Очищення проміжних папок збірки build та dist...")
    if os.path.exists("build"):
        subprocess.run(["rmdir", "/s", "/q", "build"], shell=True)
    if os.path.exists("dist"):
        subprocess.run(["rmdir", "/s", "/q", "dist"], shell=True)

    # Крок 3. Запуск компіляції виконуваного файлу
    print("[Compiler Engine] Запуск PyInstaller за маніфестом main.spec...")
    try:
        subprocess.run(["pyinstaller", "main.spec", "--clean"], check=True)
        print(
            "\n[Compiler Engine] Збірка успішно завершена! Готовий файл: dist/F.Int.exe"
        )
    except subprocess.CalledProcessError as cpe:
        print(
            f"\n[Compiler Engine] Критична помилка PyInstaller під час компіляції: {cpe}"
        )
        sys.exit(1)
