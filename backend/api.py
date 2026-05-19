import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class Api:
    def __init__(self, data_manager, excel_exporter):
        # ВИПРАВЛЕНО: Робимо інстанси приватними (з _), щоб pywebview 
        # не намагався рекурсивно серіалізувати pandas DataFrame у JS.
        self._data_manager = data_manager
        self._excel_exporter = excel_exporter

    def bulk_action(
        self, uuids: List[str], action_type: str, mode: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Єдина точка входу для всіх масових операцій застосунку.
        """
        if not uuids:
            return {
                "success": False, "processed": [], "failed": [], 
                "doc_path": None, "error": "Список UUID порожній"
            }

        try:
            match action_type:
                case "move":
                    return self._bulk_move(uuids, mode, payload)
                case "write_off":
                    return self._bulk_write_off(uuids, mode, payload)
                case "export":
                    return self._bulk_export(uuids, payload)
                case _:
                    return {
                        "success": False, "processed": [], "failed": uuids,
                        "doc_path": None, "error": f"Невідомий action_type: {action_type}"
                    }
        except Exception as e:
            logger.exception("bulk_action failed")
            return {
                "success": False, "processed": [], "failed": uuids,
                "doc_path": None, "error": str(e)
            }

    def _bulk_move(self, uuids: List[str], mode: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        new_mvo = payload.get("new_mvo", "").strip()
        new_object = payload.get("new_object", "").strip()

        if not new_mvo:
            return {
                "success": False, "processed": [], "failed": uuids,
                "doc_path": None, "error": "new_mvo не вказано"
            }

        processed, failed = self._data_manager.bulk_move(uuids, new_mvo, new_object)
        doc_path: Optional[str] = None

        if mode in ("save", "commit") and processed:
            doc_path = self._excel_exporter.generate_move_act(
                uuids=processed, new_mvo=new_mvo, new_object=new_object,
                save_to_archive=(mode == "commit")
            )

        return {"success": True, "processed": processed, "failed": failed, "doc_path": doc_path}

    def _bulk_write_off(self, uuids: List[str], mode: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        reason = payload.get("reason", "").strip()
        date = payload.get("date", "").strip()

        if not reason:
            return {
                "success": False, "processed": [], "failed": uuids,
                "doc_path": None, "error": "reason не вказано"
            }

        processed, failed = self._data_manager.bulk_write_off(uuids, reason, date)
        doc_path: Optional[str] = None

        if mode in ("save", "commit") and processed:
            doc_path = self._excel_exporter.generate_write_off_act(
                uuids=processed, reason=reason, date=date,
                save_to_archive=(mode == "commit")
            )

        return {"success": True, "processed": processed, "failed": failed, "doc_path": doc_path}

    def _bulk_export(self, uuids: List[str], payload: Dict[str, Any]) -> Dict[str, Any]:
        fmt = payload.get("format", "xlsx")
        doc_path = self._excel_exporter.export_selection(uuids=uuids, fmt=fmt)
        return {"success": True, "processed": uuids, "failed": [], "doc_path": doc_path}