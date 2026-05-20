/**
 * F.Int — Ізольований модуль згрупованої картки майна (Grouped Modal Component)
 * Автоматично адаптує поля форми під усі стовпчики Excel (A-X).
 */

const GroupedModal = {
    _currentEditingAssets: [],

    init: function () {
        console.log("[GroupedModal] Ініціалізація автономного модуля карток майна...");
        this.injectModalStructure();
        this.listenEvents();
    },

    injectModalStructure: function () {
        const existingModal = document.getElementById('edit-asset-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="edit-asset-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(2px);">
                <div class="modal-content" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); border-radius: 8px; width: 680px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s;">
                    
                    <div style="padding: 20px 24px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <div>
                            <h2 id="edit-modal-title" style="font-size: 18px; margin-bottom: 4px; color: var(--color-text-main);">Картка майна</h2>
                            <p id="edit-modal-subtitle" style="font-size: 12px; color: var(--color-text-muted);">Згруповано граф обліку: 0</p>
                        </div>
                        <button id="btn-close-modal" style="background: transparent; border: none; color: var(--color-text-muted); font-size: 18px; cursor: pointer; outline: none;">✕</button>
                    </div>
                    
                    <div id="edit-modal-dynamic-content" style="padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; flex-grow: 1;">
                        </div>

                    <div style="padding: 20px 24px; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0; background-color: var(--color-bg-sidebar); border-radius: 0 0 8px 8px;">
                        <button id="btn-cancel-edit" class="btn-save-close" style="width: auto; background: transparent;">Скасувати</button>
                        <button id="btn-save-edit" class="btn-save-close" style="width: auto; background-color: var(--color-accent-subtle); border-color: var(--color-accent); color: var(--color-accent);">💾 Зберегти зміни по всій групі</button>
                    </div>

                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('btn-close-modal').addEventListener('click', () => this.close());
        document.getElementById('btn-cancel-edit').addEventListener('click', () => this.close());
        document.getElementById('btn-save-edit').addEventListener('click', () => this.saveGroupedChanges());
    },

    listenEvents: function () {
        const self = this;
        if (window.EventBus) {
            window.EventBus.on('asset:open-grouped-modal', function (payload) {
                // Отримуємо повний об'єкт активу з усіма стовпцями B-X
                if (payload && payload.asset) {
                    self.open(payload.asset);
                }
            });
        }
    },

    open: function (asset) {
        const self = this;

        // asset — повний об'єкт з усіма стовпцями B-X, переданий з AssetTable
        if (!asset) return;

        // Шукаємо всі графи з тим самим найменуванням у вже завантажених даних таблиці
        const assetName = asset["Найменування"] || '—';
        const allData = (window.AssetTable && window.AssetTable._data) ? window.AssetTable._data : [asset];
        const graphs = allData.filter(a => a["Найменування"] === assetName);

        self._currentEditingAssets = graphs.length > 0 ? graphs : [asset];

        document.getElementById('edit-modal-title').innerText = assetName;
        document.getElementById('edit-modal-subtitle').innerText = `Виявлено роздільних граф обліку (за Об'єктами/МВО): ${self._currentEditingAssets.length}`;

        const contentContainer = document.getElementById('edit-modal-dynamic-content');
        let html = '';

        self._currentEditingAssets.forEach((item, idx) => {
            html += `
                <div class="grouped-asset-block" data-uuid="${item["UUID"]}" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--color-accent);">ГРАФА #${idx + 1}</span>
                        <span style="font-size: 11px; color: var(--color-text-muted); font-family: monospace;">ID: ${item["UUID"] ? item["UUID"].split('-')[0] : '—'}...</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top:10px;">
            `;

            // ДИНАМІЧНА ГЕНЕРАЦІЯ ПОЛІВ ДЛЯ ВСІХ КОЛОНОК (A-X)
            Object.keys(item).forEach(key => {
                if (key === 'UUID') return;

                const isFullWidth = ['Найменування', 'МВО (Прізвище)', 'Об\'єкт', 'Примітки', 'Опис'].includes(key) || key.length > 15;
                const gridStyle = isFullWidth ? 'grid-column: span 2;' : '';

                html += `
                    <div style="display: flex; flex-direction: column; gap: 4px; ${gridStyle}">
                        <label style="font-size: 11px; color: var(--color-text-muted); font-weight: 600;">${key}</label>
                        <input type="text" class="field-dynamic-input doc-title-input" data-key="${key}" value="${item[key] !== null && item[key] !== undefined ? item[key] : ''}">
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        contentContainer.innerHTML = html;
        document.getElementById('edit-asset-modal').style.display = 'flex';
    },

    close: function () {
        document.getElementById('edit-asset-modal').style.display = 'none';
        this._currentEditingAssets = [];
    },

    saveGroupedChanges: function () {
        const self = this;
        const blocks = document.querySelectorAll('.grouped-asset-block');
        const promises = [];

        const btnSave = document.getElementById('btn-save-edit');
        btnSave.disabled = true;
        btnSave.innerText = '⏳ Збереження граф...';

        blocks.forEach(block => {
            const uuid = block.dataset.uuid;
            const payload = {};

            // Динамічно зчитуємо значення зі всіх інпутів
            block.querySelectorAll('.field-dynamic-input').forEach(input => {
                const key = input.dataset.key;
                let val = input.value;
                if (key === 'Кількість (факт)') {
                    val = parseInt(val) || 0;
                }
                payload[key] = val;
            });

            if (window.Api && typeof window.Api.bulkAction === 'function') {
                promises.push(
                    window.Api.bulkAction({
                        uuids: [uuid],
                        actionType: 'edit',
                        mode: 'save',
                        payload: payload
                    }).then(function () {
                        if (window.AssetTable && window.AssetTable._data) {
                            const match = window.AssetTable._data.find(a => a["UUID"] === uuid);
                            if (match) Object.assign(match, payload);
                        }
                    })
                );
            }
        });

        Promise.all(promises).then(function () {
            self.close();
            if (window.EventBus) {
                window.EventBus.emit('table:refresh-required');
            }
        }).catch(function (err) {
            alert(`Помилка пакетного оновлення граф майна: ${err.message}`);
        }).finally(function () {
            btnSave.disabled = false;
            btnSave.innerText = '💾 Зберегти зміни по всій групі';
        });
    }
};

window.GroupedModal = GroupedModal;