/**
 * F.Int — Компонент таблиці активів (Asset Table)
 * Відображає скорочений список майна, реагує на фільтри та керує модальним вікном редагування.
 */

const AssetTable = {
    _data: [],
    _filteredData: [],
    _selectedUuids: new Set(),

    init: function () {
        console.log("[AssetTable] Ініціалізація компонента таблиці майна...");

        // Створюємо базову розмітку таблиці та модального вікна
        this.renderStructure();
        this.renderEditModal();

        this.bindEvents();
        this.loadData();
    },

    /**
     * Рендеринг оболонки таблиці
     */
    renderStructure: function () {
        const placeholder = document.getElementById('asset-table-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div class="table-container" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1;">
                <div style="overflow-y: auto; flex: 1;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="position: sticky; top: 0; background-color: var(--color-bg-sidebar); z-index: 10; box-shadow: 0 1px 0 var(--color-border);">
                            <tr>
                                <th style="padding: 12px 16px; width: 40px; border-bottom: 1px solid var(--color-border);"><input type="checkbox" id="selectAll"></th>
                                <th style="padding: 12px 16px; width: 50px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">№</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Тип майна</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Найменування</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Інв. / Ном. №</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Од. вим.</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">К-сть</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Об'єкт</th>
                            </tr>
                        </thead>
                        <tbody id="table-body">
                            </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг прихованого модального вікна для редагування у DOM
     */
    renderEditModal: function () {
        // Якщо вже існує — видаляємо старе
        const existingModal = document.getElementById('edit-asset-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="edit-asset-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(2px);">
                <div class="modal-content" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); border-radius: 8px; width: 500px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="font-size: 18px;">Картка майна</h2>
                        <button id="btn-close-modal" style="background: transparent; border: none; color: var(--color-text-muted); font-size: 18px; cursor: pointer;">✕</button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <input type="hidden" id="edit-uuid">
                        
                        <div class="field-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; color: var(--color-text-muted);">Тип майна</label>
                            <input type="text" id="edit-type" class="doc-title-input">
                        </div>
                        
                        <div class="field-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; color: var(--color-text-muted);">Найменування</label>
                            <input type="text" id="edit-name" class="doc-title-input">
                        </div>
                        
                        <div class="field-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; color: var(--color-text-muted);">Інвентарний / Номенклатурний №</label>
                            <input type="text" id="edit-inv" class="doc-title-input">
                        </div>

                        <div class="field-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; color: var(--color-text-muted);">Відповідальна особа (МВО)</label>
                            <input type="text" id="edit-mvo" class="doc-title-input">
                        </div>

                        <div class="field-group" style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12px; color: var(--color-text-muted);">Об'єкт / Локація</label>
                            <input type="text" id="edit-object" class="doc-title-input">
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                        <button id="btn-cancel-edit" class="btn-save-close" style="width: auto; background: transparent;">Скасувати</button>
                        <button id="btn-save-edit" class="btn-save-close" style="width: auto; background-color: rgba(14, 165, 233, 0.15); border-color: var(--color-accent); color: var(--color-accent);">💾 Зберегти зміни</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Прив'язка подій модального вікна
        document.getElementById('btn-close-modal').addEventListener('click', () => this.closeEditModal());
        document.getElementById('btn-cancel-edit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('btn-save-edit').addEventListener('click', () => this.saveAssetChanges());
    },

    /**
     * Завантаження даних через ApiBridge
     */
    loadData: function () {
        const self = this;
        if (window.Api && typeof window.Api.get_assets === 'function') {
            window.Api.get_assets().then(function (data) {
                self._data = data;
                self._filteredData = data;
                self.renderRows();
            }).catch(function (err) {
                console.error("[AssetTable] Помилка завантаження даних:", err);
                document.getElementById('table-body').innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--color-danger);">Помилка зчитування бази даних</td></tr>`;
            });
        }
    },

    /**
     * Рендеринг рядків таблиці
     */
    renderRows: function () {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (this._filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--color-text-muted);">Майно не знайдено</td></tr>`;
            return;
        }

        let html = '';
        this._filteredData.forEach((row, index) => {
            const uuid = row["UUID"];
            const isChecked = this._selectedUuids.has(uuid) ? 'checked' : '';
            const rowBg = this._selectedUuids.has(uuid) ? 'background-color: var(--color-accent-subtle);' : '';

            // Формуємо рядки, підтримуємо клік по всьому рядку крім чекбокса
            html += `
                <tr class="asset-row" data-uuid="${uuid}" style="cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background-color 0.2s; ${rowBg}">
                    <td class="td-checkbox" style="padding: 12px 16px;" onclick="event.stopPropagation();"><input type="checkbox" class="row-checkbox" value="${uuid}" ${isChecked}></td>
                    <td style="padding: 12px 16px; font-size: 13px; color: var(--color-text-muted);">${index + 1}</td>
                    <td style="padding: 12px 16px; font-size: 13px;">${row["Тип"] || '—'}</td>
                    <td style="padding: 12px 16px; font-size: 13px; font-weight: 500;">${row["Найменування"] || '—'}</td>
                    <td style="padding: 12px 16px; font-size: 13px; font-family: monospace;">${row["Інв. / Номенкл. №"] || '—'}</td>
                    <td style="padding: 12px 16px; font-size: 13px;">${row["Одиниця виміру"] || 'шт'}</td>
                    <td style="padding: 12px 16px; font-size: 13px;">${row["Кількість (факт)"] || 0}</td>
                    <td style="padding: 12px 16px; font-size: 13px;">${row["Об'єкт"] || '—'}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        this.updateCheckboxListeners();
    },

    /**
     * Прив'язка подій
     */
    bindEvents: function () {
        const self = this;

        // 1. Слухаємо зміни фільтрів від panel-filter.js
        if (window.EventBus) {
            window.EventBus.on('filters:changed', function (filters) {
                self.applyFilters(filters);
            });
        }

        // 2. Головний чекбокс "Вибрати все"
        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', function (e) {
                const isChecked = e.target.checked;
                if (isChecked) {
                    self._filteredData.forEach(row => self._selectedUuids.add(row["UUID"]));
                } else {
                    self._selectedUuids.clear();
                }
                self.renderRows();
                self.notifySelection();
            });
        }
    },

    /**
     * Оновлення слухачів для кожного згенерованого рядка
     */
    updateCheckboxListeners: function () {
        const self = this;

        // Клік по чекбоксу
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', function (e) {
                if (e.target.checked) self._selectedUuids.add(e.target.value);
                else self._selectedUuids.delete(e.target.value);

                e.target.closest('tr').style.backgroundColor = e.target.checked ? 'var(--color-accent-subtle)' : '';
                self.notifySelection();
            });
        });

        // Клік по самому рядку (відкриття модалки)
        document.querySelectorAll('.asset-row').forEach(row => {
            row.addEventListener('click', function (e) {
                // Ігноруємо клік, якщо він був по чекбоксу
                if (e.target.tagName.toLowerCase() === 'input') return;
                self.openEditModal(this.dataset.uuid);
            });
        });
    },

    /**
     * Відкриття модального вікна редагування
     */
    openEditModal: function (uuid) {
        const asset = this._data.find(a => a["UUID"] === uuid);
        if (!asset) return;

        document.getElementById('edit-uuid').value = asset["UUID"];
        document.getElementById('edit-type').value = asset["Тип"] || '';
        document.getElementById('edit-name').value = asset["Найменування"] || '';
        document.getElementById('edit-inv').value = asset["Інв. / Номенкл. №"] || '';
        document.getElementById('edit-mvo').value = asset["МВО (Прізвище)"] || '';
        document.getElementById('edit-object').value = asset["Об'єкт"] || '';

        const modal = document.getElementById('edit-asset-modal');
        modal.style.display = 'flex';
    },

    /**
     * Закриття модального вікна
     */
    closeEditModal: function () {
        const modal = document.getElementById('edit-asset-modal');
        modal.style.display = 'none';
    },

    /**
     * Збереження змін майна та відправка на бекенд
     */
    saveAssetChanges: function () {
        const uuid = document.getElementById('edit-uuid').value;
        const payload = {
            "Тип": document.getElementById('edit-type').value,
            "Найменування": document.getElementById('edit-name').value,
            "Інв. / Номенкл. №": document.getElementById('edit-inv').value,
            "МВО (Прізвище)": document.getElementById('edit-mvo').value,
            "Об'єкт": document.getElementById('edit-object').value
        };

        console.log("[AssetTable] Збереження майна:", uuid, payload);
        const self = this;

        // Використовуємо наш ApiBridge для відправки на бекенд
        if (window.Api && typeof window.Api.bulkAction === 'function') {
            window.Api.bulkAction({
                uuids: [uuid],
                actionType: 'edit',
                mode: 'save',
                payload: payload
            }).then(function () {
                // Локально оновлюємо дані, щоб не робити повний перезапит
                const assetIndex = self._data.findIndex(a => a["UUID"] === uuid);
                if (assetIndex !== -1) {
                    Object.assign(self._data[assetIndex], payload);
                }
                self.closeEditModal();
                self.renderRows(); // Перемальовуємо таблицю
                alert('✓ Картку майна успішно оновлено.');
            }).catch(function (err) {
                alert(`Помилка збереження: ${err.message}`);
            });
        }
    },

    /**
     * Фільтрація даних на основі події з filter-panel.js
     */
    applyFilters: function (filters) {
        this._selectedUuids.clear(); // Правило: при фільтрації скидаємо виділення!
        this.notifySelection();

        const q = filters.searchQuery.toLowerCase();

        this._filteredData = this._data.filter(row => {
            const matchSearch = q === '' ||
                (row["Найменування"] && row["Найменування"].toLowerCase().includes(q)) ||
                (row["Інв. / Номенкл. №"] && String(row["Інв. / Номенкл. №"]).toLowerCase().includes(q));

            const matchMvo = filters.mvo === 'all' || row["МВО (Прізвище)"] === filters.mvo;
            const matchObject = filters.object === 'all' || row["Об'єкт"] === filters.object;

            return matchSearch && matchMvo && matchObject;
        });

        this.renderRows();
    },

    /**
     * Повідомлення системи про зміну кількості виділених чекбоксів
     */
    notifySelection: function () {
        const uuids = Array.from(this._selectedUuids);
        if (window.EventBus) {
            window.EventBus.emit('assets:selected', {
                uuids: uuids,
                count: uuids.length
            });
        }
    },

    /**
     * Примусове очищення (викликається кнопкою "Скинути" з bulk-action-bar)
     */
    clearSelection: function () {
        this._selectedUuids.clear();
        this.renderRows();
        this.notifySelection();
    }
};

window.AssetTable = AssetTable;