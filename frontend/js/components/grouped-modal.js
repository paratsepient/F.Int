/**
 * Автономний модуль для відображення детальної інформації про майно
 * та збереження оновлених даних у реальному часі.
 */
const GroupedModal = {
    currentAsset: null,

    /**
     * Універсальний метод ініціалізації картки.
     * ВИПРАВЛЕНО: захист від виклику без аргументів та від передачі click-події замість даних.
     */
    init(dataOrEvent) {
        // ВИПРАВЛЕННЯ 1: якщо викликано без аргументів — мовчки виходимо (не засмічуємо консоль помилкою)
        if (dataOrEvent === undefined || dataOrEvent === null) {
            console.warn("[GroupedModal] init() викликано без аргументів — ігноруємо.");
            return;
        }

        console.log("[GroupedModal] init() отримав:", typeof dataOrEvent, dataOrEvent);

        let assetData = null;

        if (dataOrEvent && dataOrEvent.detail) {
            // Прийшла CustomEvent з EventBus
            assetData = dataOrEvent.detail.asset || dataOrEvent.detail;
        } else if (dataOrEvent instanceof Event || (dataOrEvent && dataOrEvent.target && dataOrEvent.type)) {
            // ВИПРАВЛЕННЯ 2: прийшов звичайний DOM-івент (click) — це помилка виклику в asset-table.js
            // Намагаємось дістати дані з data-атрибуту або currentAsset
            console.error(
                "[GroupedModal] УВАГА: передано DOM-подію замість об'єкта даних!\n" +
                "Виправте asset-table.js: замість GroupedModal.init(event) використовуйте GroupedModal.open(assetObject).\n" +
                "Отримана подія:", dataOrEvent
            );
            // Запасний варіант — беремо останній відомий asset
            assetData = this.currentAsset;
        } else if (dataOrEvent && typeof dataOrEvent === 'object' && !Array.isArray(dataOrEvent)) {
            // Чистий JS-об'єкт з даними майна
            assetData = dataOrEvent;
        }

        if (!assetData || typeof assetData !== 'object') {
            console.error("[GroupedModal] Не вдалося отримати дані майна. Отримано:", dataOrEvent);
            return;
        }

        this.currentAsset = assetData;
        console.log("[GroupedModal] Рендеримо картку для:", assetData);

        // Шукаємо або створюємо overlay
        let modalOverlay = document.getElementById('grouped-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'grouped-modal-overlay';
            modalOverlay.className = 'modal-overlay';
            document.body.appendChild(modalOverlay);
        }

        const invNumber = assetData["Інвентарний / Номенклатурний №"]
            || assetData["Інв. / Номенкл. №"]
            || assetData["Інвентарний номер"]
            || '';
        const assetQty = assetData["Кількість (факт)"]
            || assetData["Загальна кількість"]
            || assetData["Кількість"]
            || '0';

        // Екранування значень для безпечної вставки в HTML
        const esc = (val) => String(val ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        modalOverlay.innerHTML = `
            <div class="modal-window">
                <div class="modal-header">
                    <h2>Детальна інформація / Редагування</h2>
                    <span class="modal-close-btn" id="modal-close-x">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="grouped-modal-form" class="modal-form">
                        <div class="form-group">
                            <label>Найменування (Стовпець F):</label>
                            <input type="text" data-field="Найменування" value="${esc(assetData["Найменування"])}">
                        </div>
                        <div class="form-group">
                            <label>Інвентарний номер (Стовпець H):</label>
                            <input type="text" data-field="Інвентарний / Номенклатурний №" value="${esc(invNumber)}">
                        </div>
                        <div class="form-group">
                            <label>Тип (Стовпець E):</label>
                            <input type="text" data-field="Тип майна" value="${esc(assetData["Тип майна"] || assetData["Тип"])}">
                        </div>
                        <div class="form-group">
                            <label>Одиниця виміру (Стовпець K):</label>
                            <input type="text" data-field="Одиниця виміру" value="${esc(assetData["Одиниця виміру"])}">
                        </div>
                        <div class="form-group">
                            <label>Кількість (Стовпець L):</label>
                            <input type="number" data-field="Кількість (факт)" value="${esc(assetQty)}">
                        </div>
                        <div class="form-group">
                            <label>МВО (Стовпець C):</label>
                            <input type="text" data-field="МВО (Прізвище)" value="${esc(assetData["МВО (Прізвище)"] || assetData["МВО"])}">
                        </div>
                        <div class="form-group">
                            <label>Підрозділ (Стовпець B):</label>
                            <input type="text" data-field="Підрозділ (Частина)" value="${esc(assetData["Підрозділ (Частина)"] || assetData["Підрозділ"])}">
                        </div>
                        <div class="form-group">
                            <label>Об'єкт / Поверх (Стовпець D):</label>
                            <input type="text" data-field="Об'єкт" value="${esc(assetData["Об'єкт"])}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="modal-close-btn">Скасувати</button>
                    <button type="button" class="btn btn-primary" id="modal-save-btn">Зберегти зміни</button>
                </div>
            </div>
        `;

        modalOverlay.style.display = 'flex';
        this.initEvents();
    },

    // Псевдоніми для сумісності з asset-table.js
    open(data) { this.init(data); },
    show(data) { this.init(data); },

    initEvents() {
        const closeX = document.getElementById('modal-close-x');
        const closeBtn = document.getElementById('modal-close-btn');
        const saveBtn = document.getElementById('modal-save-btn');
        const modalOverlay = document.getElementById('grouped-modal-overlay');

        if (closeX) closeX.onclick = () => this.close();
        if (closeBtn) closeBtn.onclick = () => this.close();

        if (modalOverlay) {
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) this.close();
            };
        }

        if (saveBtn) {
            saveBtn.onclick = async (e) => {
                e.preventDefault();
                await this.handleSave();
            };
        }
    },

    close() {
        const modalOverlay = document.getElementById('grouped-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            modalOverlay.innerHTML = '';
        }
        this.currentAsset = null;
        console.log("[GroupedModal] Закрито.");
    },

    async handleSave() {
        console.log("[GroupedModal] Збереження...");
        const form = document.getElementById('grouped-modal-form');
        if (!form) return;

        const assetUuid = this.currentAsset?.["UUID"] ? String(this.currentAsset["UUID"]) : null;
        if (!assetUuid) {
            console.error("[GroupedModal] UUID відсутній у:", this.currentAsset);
            alert("Помилка: не вдалося знайти ідентифікатор рядка (UUID).");
            return;
        }

        const payload = { ...this.currentAsset, "UUID": assetUuid };
        form.querySelectorAll('input[data-field]').forEach(input => {
            payload[input.getAttribute('data-field')] = input.value.trim();
        });

        // Дублюємо для сумісності з Python-бекендом
        payload["Тип"] = payload["Тип майна"];
        payload["Інв. / Номенкл. №"] = payload["Інвентарний / Номенклатурний №"];

        const apiBridge = window.ApiBridge || window.pywebview?.api || window.Api;
        if (!apiBridge) {
            alert("Помилка: міст зв'язку з Python не знайдено (ApiBridge/pywebview.api).");
            return;
        }

        const saveBtn = document.getElementById('modal-save-btn');
        try {
            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "⏳ Зберігаємо..."; }

            console.log("[GroupedModal] Payload на бекенд:", payload);

            let response;
            if (typeof apiBridge.edit_asset === 'function') {
                response = await apiBridge.edit_asset(payload);
            } else if (typeof apiBridge.bulkAction === 'function') {
                response = await apiBridge.bulkAction({ action: 'edit', data: payload });
            } else if (typeof apiBridge.saveGroupedChanges === 'function') {
                response = await apiBridge.saveGroupedChanges(payload);
            } else {
                response = await apiBridge.bulkAction('edit', payload);
            }

            console.log("[GroupedModal] Відповідь:", response);

            if (response?.success) {
                this.close();
                if (typeof window.AssetTable?.loadData === 'function') {
                    window.AssetTable.loadData();
                } else {
                    location.reload();
                }
            } else {
                throw new Error(response?.error || "Бекенд відхилив операцію.");
            }
        } catch (error) {
            console.error("[GroupedModal] Помилка збереження:", error);
            alert(`Не вдалося зберегти: ${error.message}`);
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = "Зберегти зміни"; }
        }
    }
};

window.GroupedModal = GroupedModal;

document.addEventListener('asset:open-grouped-modal', (e) => {
    console.log("[EventBus] asset:open-grouped-modal:", e);
    GroupedModal.init(e);
});