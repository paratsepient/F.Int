import pandas as pd
from pathlib import Path
import uuid

def create_initial_cache():
    db_path = Path("Import/Structured_Asset_Base.xlsx")
    cache_path = db_path.with_suffix(".pkl")
    
    print("=== Старт підготовки бінарного кешу F.Int ===")
    
    if not db_path.exists():
        print(f"❌ Помилка: Оригінальний файл не знайдено за шляхом {db_path}")
        print("Будь ласка, покладіть Structured_Asset_Base.xlsx в папку Import/")
        return

    try:
        print(f"⏳ Зчитування {db_path} (це може зайняти кілька секунд)...")
        # Зчитуємо першу вкладку
        df = pd.read_excel(db_path, engine="openpyxl")
        print(f"✓ Успішно зчитано Excel. Знайдено рядків: {len(df)}")
        
        # Перевіряємо наявність колонки UUID, якщо немає — створюємо
        if "UUID" not in df.columns:
            print("⚠️ Колонка 'UUID' відсутня. Автоматична генерація ідентифікаторів...")
            df.insert(0, "UUID", [str(uuid.uuid4()) for _ in range(len(df))])
        else:
            # Якщо колонка є, але є порожні комірки — заповнюємо їх
            blank_uuids = df["UUID"].isna() or df["UUID"] == ""
            if blank_uuids.any():
                print(f"⚠️ Знайдено порожні UUID у {blank_uuids.sum()} рядках. Виправлення...")
                df.loc[blank_uuids, "UUID"] = [str(uuid.uuid4()) for _ in range(blank_uuids.sum())]

        # Гарантуємо наявність усіх ключових колонок, щоб groupby не падав
        required_columns = ["Найменування", "Тип", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)", "Об'єкт"]
        for col in required_columns:
            if col not in df.columns:
                df[col] = ""
                print(f"📍 Додано відсутню колонку: {col}")

        # Зберігаємо супершвидкий бінарний кеш .pkl
        df.to_pickle(cache_path)
        print(f"🚀 Успішно створено бінарний кеш: {cache_path}")
        print("=== Підготовку завершено. Тепер можете запускати python main.py ===")
        
    except Exception as e:
        print(f"❌ Критичний збій міграції: {e}")

if __name__ == "__main__":
    create_initial_cache()