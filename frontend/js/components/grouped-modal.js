/**
 * F.Int — Ізольований модуль згрупованої картки майна (Grouped Modal Component)
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
                    
                    <div id="edit-modal-dynamic-content" style="padding: 24px; overflow-y: auto; display: flex; flex-grow: 1;">
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
                if (payload && payload.asset) {
                    self.open(payload.asset);
                }
            });
        }
    },

    open: function (asset) {
        const self = this;
        if (!asset) return;

        const assetName = asset["Найменування"] || '—';
        const allData = (window.AssetTable && window.AssetTable._data) ? window.AssetTable._data : [asset];
        const graphs = allData.filter(a => a["Найменування"] === assetName);

        self._currentEditingAssets = graphs.length > 0 ? graphs : [asset];

        document.getElementById('edit-modal-title').innerText = assetName;
        document.getElementById('edit-modal-subtitle').innerText = `Виявлено роздільних граф обліку (за Об'єктами/МВО): ${self._currentEditingAssets.length}`;

        const contentContainer = document.getElementById('edit-modal-dynamic-content');
        contentContainer.innerHTML = '';

        const scrollWrapper = document.createElement('div');
        scrollWrapper.style.cssText = "display: flex; flex-direction: column; gap: 24px; width: 100%;";

        self._currentEditingAssets.forEach((item, idx) => {
            const block = document.createElement('div');
            block.className = "grouped-asset-block";
            block.dataset.uuid = String(item["UUID"]);
            block.style.cssText = "background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 12px;";

            let blockHeader = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: var(--color-accent);">ГРАФА #${idx + 1}</span>
                    <span style="font-size: 11px; color: var(--color-text-muted); font-family: monospace;">ID: ${item["UUID"] ? String(item["UUID"]).split('-')[0] : '—'}...</span>
                </div>
            `;

            const gridContainer = document.createElement('div');
            gridContainer.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top:10px;";

            Object.keys(item).forEach(key => {
                if (key === 'UUID' || key === 'Об\'єкт_список' || key === 'Тип майна') return;

                const isFullWidth = ['Найменування', 'МВО (Прізвище)', 'Об\'єкт', 'Примітки', 'Опис'].includes(key) || key.length > 15;
                const fieldWrapper = document.createElement('div');
                if (isFullWidth) fieldWrapper.style.gridColumn = 'span 2';
                fieldWrapper.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

                const label = document.createElement('label');
                label.style.cssText = "font-size: 11px; color: var(--color-text-muted); font-weight: 600;";
                label.innerText = key;

                // Створення інпутів через об'єктну модель гарантує 100% точність введення без збоїв кешу
                const input = document.createElement('input');
                input.type = "text";
                input.className = "field-dynamic-input doc-title-input";
                input.dataset.key = key;
                input.value = (item[key] !== null && item[key] !== undefined) ? String(item[key]) : '';

                fieldWrapper.appendChild(label);
                fieldWrapper.appendChild(input);
                gridContainer.appendChild(fieldWrapper);
            });

            block.innerHTML = blockHeader;
            block.appendChild(gridContainer);
            scrollWrapper.appendChild(block);
        });

        contentContainer.appendChild(scrollWrapper);
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

        const apiTarget = window.ApiBridge || window.Api || (window.pywebview && window.pywebview.api);
        const bulkMethod = (apiTarget && typeof apiTarget.bulkAction === 'function') ? apiTarget.bulkAction : null;

        blocks.forEach(block => {
            const uuid = String(block.dataset.uuid);
            const payload = {};

            block.querySelectorAll('.field-dynamic-input').forEach(input => {
                const key = input.dataset.key;
                let val = input.value.trim();
                if (key === 'Кількість (факт)') {
                    val = parseInt(val) || 0;
                }
                payload[key] = val;
            });

            if (bulkMethod) {
                promises.push(
                    bulkMethod.call(apiTarget, {
                        uuids: [uuid],
                        actionType: 'edit',
                        mode: 'save',
                        payload: payload
                    })
                );
            }
        });

        if (promises.length === 0) {
            console.error("[GroupedModal] Не знайдено bulkAction.");
            btnSave.disabled = false;
            btnSave.innerText = '💾 Зберегти зміни по всій групі';
            return;
        }

        Promise.all(promises).then(function () {
            self.close();
            // Змушуємо таблицю стерти застарілі масиви пам'яті і зчитати чистий Excel файл, який ми щойно перезаписали
            if (window.AssetTable && typeof window.AssetTable.loadData === 'function') {
                window.AssetTable.loadData();
            } else if (window.EventBus) {
                window.EventBus.emit('table:refresh-required');
            }
        }).catch(function (err) {
            alert(`Помилка оновлення картки: ${err.message}`);
        }).finally(function () {
            btnSave.disabled = false;
            btnSave.innerText = '💾 Зберегти зміни по всій групі';
        });
    }
};

window.GroupedModal = GroupedModal;