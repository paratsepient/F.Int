/**
 * Автономний модуль для відображення детальної інформації про майно
 * та збереження оновлених даних у реальному часі.
 */
const GroupedModal = {
    currentAsset: null,

    init(dataOrEvent) {
        if (dataOrEvent === undefined || dataOrEvent === null) {
            return;
        }

        let assetData = null;

        if (dataOrEvent && dataOrEvent.detail) {
            // Прийшла CustomEvent з DOM (фолбек)
            assetData = dataOrEvent.detail.asset || dataOrEvent.detail;
        } else if (dataOrEvent instanceof Event || (dataOrEvent && dataOrEvent.target && dataOrEvent.type)) {
            assetData = this.currentAsset;
        } else if (dataOrEvent && typeof dataOrEvent === 'object' && !Array.isArray(dataOrEvent)) {
            // ВИПРАВЛЕННЯ: Коректно витягуємо дані з об'єкта EventBus ({ asset: match })
            assetData = dataOrEvent.asset || dataOrEvent;
        }

        if (!assetData || typeof assetData !== 'object') {
            console.error("[GroupedModal] Не вдалося отримати дані майна. Отримано:", dataOrEvent);
            return;
        }

        this.currentAsset = assetData;
        console.log("[GroupedModal] Рендеримо картку для:", assetData);

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
    },

    async handleSave() {
        console.log("[GroupedModal] Збереження...");
        const form = document.getElementById('grouped-modal-form');
        if (!form) return;

        const assetUuid = this.currentAsset?.["UUID"] ? String(this.currentAsset["UUID"]) : null;
        if (!assetUuid) {
            alert("Помилка: не вдалося знайти ідентифікатор рядка (UUID).");
            return;
        }

        const payload = { ...this.currentAsset, "UUID": assetUuid };
        form.querySelectorAll('input[data-field]').forEach(input => {
            payload[input.getAttribute('data-field')] = input.value.trim();
        });

        // Дублюємо для сумісності
        payload["Тип"] = payload["Тип майна"];
        payload["Інв. / Номенкл. №"] = payload["Інвентарний / Номенклатурний №"];

        const apiBridge = window.ApiBridge || window.pywebview?.api || window.Api;
        if (!apiBridge) {
            alert("Помилка: міст зв'язку з Python не знайдено.");
            return;
        }

        const saveBtn = document.getElementById('modal-save-btn');
        try {
            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "⏳ Зберігаємо..."; }

            let response;
            // ВИПРАВЛЕННЯ: формуємо правильний об'єкт для API.py (bulkAction)
            const requestConfig = {
                uuids: [assetUuid],
                actionType: 'edit',
                mode: 'commit',
                payload: payload
            };

            if (typeof apiBridge.bulkAction === 'function') {
                response = await apiBridge.bulkAction(requestConfig);
            } else if (typeof apiBridge.edit_asset === 'function') {
                response = await apiBridge.edit_asset(payload);
            } else {
                throw new Error("Метод API для збереження не знайдено.");
            }

            console.log("[GroupedModal] Відповідь бекенду:", response);

            if (response?.success) {
                this.close();
                // Оновлюємо таблицю
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

// ВИПРАВЛЕННЯ: Слухаємо правильну подію через EventBus
if (window.EventBus) {
    window.EventBus.on('asset:open-grouped-modal', (data) => {
        GroupedModal.init(data);
    });
} else {
    // Слухаємо правильну кастомну шину подій (на випадок виклику з інших місць)
    if (window.EventBus) {
        window.EventBus.on('asset:open-grouped-modal', (payload) => {
            // Коректно розпаковуємо дані ({ asset: match } або просто match)
            const data = payload && payload.asset ? payload.asset : payload;
            GroupedModal.init(data);
        });
    }
}