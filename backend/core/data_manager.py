import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger("F.Int.DataManager")

# ──────────────────────────────────────────────────────────────────────────────
# Стилі для красивого Excel
# ──────────────────────────────────────────────────────────────────────────────
_HEADER_FILL = PatternFill("solid", fgColor="1F3864")  # темно-синій
_ALT_ROW_FILL = PatternFill("solid", fgColor="EEF2FF")  # блідо-лавандовий
_HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF", size=10)
_DATA_FONT = Font(name="Arial", size=10)
_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
_THIN = Side(style="thin", color="B0B8D1")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)

# Ширини колонок: ключ → символів (None = авто)
_COL_WIDTHS: Dict[str, float] = {
    "UUID": 38,
    "Тип": 14,
    "Тип майна": 14,
    "Найменування": 32,
    "Інв. / Номенкл. №": 20,
    "Одиниця виміру": 12,
    "Кількість (факт)": 14,
    "МВО (Прізвище)": 22,
    "Об'єкт": 28,
    "Відмітка про вибуття": 22,
}
_DEFAULT_WIDTH = 18


def _apply_pretty_format(path: Path) -> None:
    """Відкриває збережений xlsx і додає людське форматування."""
    wb = load_workbook(path)
    ws = wb.active
    if ws is None:
        wb.save(path)
        return

    # ── Заголовки ──────────────────────────────────────────────────────────────
    for cell in ws[1]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _CENTER
        cell.border = _BORDER

    # ── Рядки даних ────────────────────────────────────────────────────────────
    for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        fill = _ALT_ROW_FILL if row_idx % 2 == 0 else None
        for cell in row:
            cell.font = _DATA_FONT
            cell.border = _BORDER
            col_num: int = cell.column  # type: ignore[assignment]
            col_name = str(ws.cell(row=1, column=col_num).value or "")
            cell.alignment = (
                _CENTER if col_name in ("Кількість (факт)", "Одиниця виміру") else _LEFT
            )
            if fill:
                cell.fill = fill

    # ── Ширини колонок ─────────────────────────────────────────────────────────
    for col_idx, _ in enumerate(ws.columns, start=1):
        header_val = str(ws.cell(row=1, column=col_idx).value or "")
        width = _COL_WIDTHS.get(header_val, _DEFAULT_WIDTH)
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width
        # UUID — прихована колонка
        if header_val == "UUID":
            ws.column_dimensions[col_letter].width = 0.1
            ws.column_dimensions[col_letter].hidden = True

    # ── Висота рядка-заголовку ─────────────────────────────────────────────────
    ws.row_dimensions[1].height = 28

    # ── Закріпити перший рядок ─────────────────────────────────────────────────
    ws.freeze_panes = "A2"

    # ── Авто-фільтр ────────────────────────────────────────────────────────────
    ws.auto_filter.ref = ws.dimensions

    wb.save(path)


# ──────────────────────────────────────────────────────────────────────────────


class DataManager:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.cache_path = db_path.with_suffix(".pkl")
        self._df: Optional[pd.DataFrame] = None
        self._load_data()

    # ── Завантаження ───────────────────────────────────────────────────────────

    def _load_data(self):
        """Каскадне завантаження: .pkl → Excel → порожня таблиця."""
        if self.cache_path.exists():
            try:
                df_cache = pd.read_pickle(self.cache_path)
                if isinstance(df_cache, pd.DataFrame):
                    self._df = df_cache
                    logger.info(f"🚀 Кеш: {len(self._df)} рядків.")
            except Exception as e:
                logger.warning(f"Кеш пошкоджено, читаємо Excel: {e}")

        if self._df is None and self.db_path.exists():
            try:
                self._df = pd.read_excel(self.db_path, engine="openpyxl")
                logger.info(f"📥 Excel: {len(self._df)} рядків.")
            except Exception as e:
                logger.error(f"Помилка читання Excel: {e}")

        if self._df is None:
            logger.warning("⚠️ Ініціалізація порожнього реєстру.")
            self._df = pd.DataFrame(
                columns=[
                    "Тип",
                    "Найменування",
                    "Інв. / Номенкл. №",
                    "Одиниця виміру",
                    "Кількість (факт)",
                    "МВО (Прізвище)",
                    "Об'єкт",
                ]
            )

        if "UUID" not in self._df.columns:
            logger.info("Генерація UUID...")
            self._df.insert(
                0, "UUID", [str(uuid.uuid4()) for _ in range(len(self._df))]
            )
            # Одразу синхронізуємо обидва файли при першому запуску
            self.save_final_excel()
        else:
            self._df["UUID"] = self._df["UUID"].astype(str)

    # ── Збереження ─────────────────────────────────────────────────────────────

    def _save_cache_to_disk(self):
        """Швидкий бінарний кеш (.pkl)."""
        if self._df is None:
            return
        try:
            tmp = self.cache_path.with_suffix(".pkl.tmp")
            self._df.to_pickle(tmp)
            os.replace(tmp, self.cache_path)
        except Exception as e:
            logger.error(f"Помилка pkl-кешу: {e}")

    def save_final_excel(self):
        """
        Атомарно зберігає DataFrame → Excel (.xlsx) + pkl-кеш,
        потім застосовує людське форматування.
        """
        if self._df is None:
            return
        tmp_excel = self.db_path.with_suffix(".xlsx.tmp")
        try:
            logger.info(f"⏳ Запис Excel → {self.db_path} ...")
            self._save_cache_to_disk()
            self._df.to_excel(tmp_excel, index=False, engine="openpyxl")
            os.replace(tmp_excel, self.db_path)
            _apply_pretty_format(self.db_path)
            logger.info("✅ Excel та кеш оновлено.")
        except Exception as e:
            logger.error(f"Помилка запису Excel: {e}")
            if tmp_excel.exists():
                try:
                    tmp_excel.unlink()
                except Exception:
                    pass

    # ── Читання ────────────────────────────────────────────────────────────────

    def get_aggregated_assets(self) -> List[Dict[str, Any]]:
        if self._df is None or self._df.empty:
            return []

        df_clean = self._df.fillna("")
        if "Кількість (факт)" in df_clean.columns:
            df_clean["Кількість (факт)"] = pd.to_numeric(
                df_clean["Кількість (факт)"], errors="coerce"
            ).fillna(0)

        result = []
        for row in df_clean.to_dict(orient="records"):
            clean = {str(k): v for k, v in row.items()}
            clean.pop("Перекидка на Четверова", None)
            clean.pop("Перекидка на Іванова", None)
            for k in list(clean.keys()):
                if k.startswith("Unnamed"):
                    clean.pop(k, None)

            if "Тип майна" in clean:
                clean["Тип"] = str(clean["Тип майна"]).strip()
            elif "Тип" not in clean:
                clean["Тип"] = ""

            obj = clean.get("Об'єкт", "") or ""
            obj = obj.strip() if isinstance(obj, str) else str(obj).strip()
            if obj:
                lst = [o.strip() for o in obj.split(";") if o.strip()]
                clean["Об'єкт_список"] = lst
                clean["Об'єкт"] = ", ".join(lst)
            else:
                clean["Об'єкт_список"] = []
                clean["Об'єкт"] = ""

            for f in ("Найменування", "Інв. / Номенкл. №", "МВО (Прізвище)", "UUID"):
                clean.setdefault(f, "")
                if not isinstance(clean[f], str):
                    clean[f] = str(clean[f])

            result.append(clean)
        return result

    def get_assets_by_name(self, name: str) -> List[Dict[str, Any]]:
        if self._df is None:
            return []
        rows = (
            self._df[self._df["Найменування"] == name]
            .fillna("")
            .to_dict(orient="records")
        )
        result = []
        for row in rows:
            clean = {str(k): v for k, v in row.items()}
            clean.pop("Перекидка на Четверова", None)
            clean.pop("Перекидка на Іванова", None)
            for k in list(clean.keys()):
                if k.startswith("Unnamed"):
                    clean.pop(k, None)
            if "Тип майна" in clean and not clean.get("Тип"):
                clean["Тип"] = clean["Тип майна"]
            obj = clean.get("Об'єкт", "")
            if isinstance(obj, str):
                lst = [o.strip() for o in obj.split(";") if o.strip()]
                clean["Об'єкт_список"] = lst
                clean["Об'єкт"] = ", ".join(lst)
            else:
                clean["Об'єкт_список"] = [str(obj)] if obj else []
            result.append(clean)
        return result

    # ── Мутації — КОЖНА викликає save_final_excel() ───────────────────────────

    def edit_asset(
        self, uuid: str, payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База не завантажена."}

        idx = self._df.index[self._df["UUID"] == str(uuid)]
        if len(idx) == 0:
            logger.warning(f"⚠️ UUID {uuid} не знайдено.")
            return {"success": False, "error": f"Актив не знайдений: {uuid}"}

        row_idx = idx[0]
        for key, value in payload.items():
            if key in ("UUID", "Об'єкт_список"):
                continue
            actual_key = key
            if (
                key == "Тип"
                and "Тип" not in self._df.columns
                and "Тип майна" in self._df.columns
            ):
                actual_key = "Тип майна"
            if actual_key in self._df.columns:
                self._df.at[row_idx, actual_key] = value

        # ✅ Зберігаємо одразу і в .pkl, і в .xlsx
        self.save_final_excel()
        logger.info(f"✅ UUID {uuid} оновлено і збережено на диск.")
        return {"success": True}

    def bulk_move(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База недоступна."}

        mask = self._df["UUID"].astype(str).isin([str(u) for u in uuids])
        if not mask.any():
            return {"success": False, "error": "Позицій не знайдено."}

        self._df.loc[mask, "МВО (Прізвище)"] = payload.get("new_mvo")
        self._df.loc[mask, "Об'єкт"] = payload.get("new_object")

        # ✅ Зберігаємо одразу
        self.save_final_excel()
        return {"success": True, "processed": int(mask.sum())}

    def bulk_write_off(
        self, uuids: List[str], payload: Dict[str, Any], mode: str
    ) -> Dict[str, Any]:
        if self._df is None:
            return {"success": False, "error": "База недоступна."}

        mask = self._df["UUID"].astype(str).isin([str(u) for u in uuids])
        if not mask.any():
            return {"success": False, "error": "Позицій не знайдено."}

        self._df.loc[mask, "Кількість (факт)"] = 0
        self._df.loc[mask, "Відмітка про вибуття"] = payload.get("reason", "Списано")

        # ✅ Зберігаємо одразу
        self.save_final_excel()
        return {"success": True, "processed": int(mask.sum())}

    def commit_to_excel(self) -> Dict[str, Any]:
        """
        Явний endpoint для примусового збереження з JS (наприклад, кнопка «Зберегти»).
        Викликається через ApiBridge.bulkAction з actionType='commit'.
        """
        try:
            self.save_final_excel()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
