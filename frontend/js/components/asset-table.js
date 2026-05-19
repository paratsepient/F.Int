/**
 * F.Int — Компонент таблиці активів (Asset Table Component)
 * Реалізує вивід майна, локальний Set-стан для чекбоксів та інтеграцію з EventBus.
 * Оптимізовано під специфікацію APP MAP v1.1 з повною сумісністю з лінтерами.
 */

const AssetTable = {
    // Локальний стан виділених позицій
    _selectedUUIDs: new Set(),
    _currentAssets: [],

    /**
     * Точка входу, що викликається роутером (app.js) при переході на вкладку
     */
    init: function () {
        console.log('[AssetTable] Ініціалізація компонента таблиці майна...');
        this.placeholder = document.getElementById('asset-table-placeholder');

        if (!this.placeholder) {
            console.error('[AssetTable] Помилка: елемент #asset-table-placeholder не знайдено в DOM.');
            return;
        }

        // Очищаємо стан при кожній новій ініціалізації вкладки
        this.clearSelection();

        // Підписуємося на системні події
        this.registerEvents();

        // Запитуємо первинні дані з бекенду через ApiBridge
        this.loadData();
    },

    /**
     * Реєстрація слухачів подій у шині EventBus
     */
    registerEvents: function () {
        const self = this;
        // При зміні каскадних фільтрів — UUID з попереднього набору стають неактуальними
        if (window.EventBus) {
            window.EventBus.on('filters:changed', function () {
                self.clearSelection();
            });

            // Після успішного завершення bulk-операції — очищаємо виділення та перезавантажуємо дані
            window.EventBus.on('bulk:completed', function () {
                self.clearSelection();
                self.loadData();
            });
        }
    },

    /**
     * Отримання масиву даних активів з Python бекенду
     */
    loadData: function () {
        const self = this;
        this.placeholder.innerHTML = '<div class="loading-placeholder">Завантаження даних з бази Excel...</div>';

        if (window.Api && typeof window.Api.get_assets === 'function') {
            window.Api.get_assets()
                .then(function (assets) {
                    self._currentAssets = assets;
                    self.render();
                })
                .catch(function (error) {
                    console.error('[AssetTable] Помилка при завантаженні даних:', error);
                    self.placeholder.innerHTML = `<div class="error-placeholder">Помилка завантаження даних: ${error.message}</div>`;
                });
        } else {
            console.warn('[AssetTable] Метод Api.get_assets не знайдено. Емуляція порожньої бази.');
            this._currentAssets = [];
            this.render();
        }
    },

    /**
     * Генерація HTML структури таблиці
     */
    render: function () {
        const self = this;
        if (!this._currentAssets || this._currentAssets.length === 0) {
            this.placeholder.innerHTML = '<div class="loading-placeholder">Немає майна за вказаними критеріями</div>';
            return;
        }

        this.placeholder.innerHTML = '';

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-responsive-wrapper';

        const table = document.createElement('table');
        table.className = 'asset-data-table';

        // 1. Будуємо шапку (Header Row)
        const thead = document.createElement('thead');
        thead.appendChild(this.buildHeaderRow());
        table.appendChild(thead);

        // 2. Будуємо тіло (Body Rows)
        const tbody = document.createElement('tbody');
        this._currentAssets.forEach(function (asset, index) {
            tbody.appendChild(self.buildDataRow(asset, index + 1));
        });
        table.appendChild(tbody);

        tableWrapper.appendChild(table);
        this.placeholder.appendChild(tableWrapper);

        // Синхронізуємо стан головного чекбоксу в шапці
        this.syncHeaderCheckbox();
    },

    /**
     * Створення заголовків таблиці з чекбоксом "Вибрати все"
     */
    buildHeaderRow: function () {
        const self = this;
        const tr = document.createElement('tr');

        // Чекбокс селектора у шапці (фіксована ширина 40px) [cite: 28, 345]
        const thSelect = document.createElement('th');
        thSelect.className = 'col-select';
        thSelect.style.width = '40px';

        const cbAll = document.createElement('input');
        cbAll.type = 'checkbox';
        cbAll.id = 'select-all';
        cbAll.title = 'Вибрати всі видимі позиції';

        cbAll.addEventListener('change', function (e) {
            // Вибираємо ТІЛЬКИ видимі та доступні рядки після поточної фільтрації [cite: 349, 414]
            const rowCheckboxes = document.querySelectorAll('.row-checkbox:not([disabled])');
            rowCheckboxes.forEach(function (cb) {
                cb.checked = e.target.checked;
                self.updateSelection(cb.dataset.uuid, e.target.checked);
            });
        });

        thSelect.appendChild(cbAll);
        tr.appendChild(thSelect);

        // Решта колонок згідно зі специфікацією [cite: 241, 242]
        const columns = [
            { label: '№', width: '44px' },
            { label: 'Найменування', width: 'auto' },
            { label: 'Інв. №', width: '130px' },
            { label: 'К-сть', width: '72px' },
            { label: 'Сума', width: '110px' },
            { label: 'МВО', width: '120px' },
            { label: 'Об\'єкт', width: '110px' }
        ];

        columns.forEach(function (col) {
            const th = document.createElement('th');
            th.textContent = col.label;
            if (col.width !== 'auto') th.style.width = col.width;
            tr.appendChild(th);
        });

        return tr;
    },

    /**
     * Створення інформаційного рядка майна
     */
    buildDataRow: function (asset, rowNumber) {
        const self = this;
        const tr = document.createElement('tr');
        tr.dataset.uuid = asset.UUID || asset.uuid;

        // Візуальні стани рядка згідно з tokens.css (Списане/Вибуття/Hover) [cite: 247, 248]
        if (asset['Відмітка про вибуття'] || asset.is_written_off) {
            tr.className = 'row-state-danger';
        }

        // 1. Колонка селектора (Чекбокс рядка)
        const tdCb = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'row-checkbox';
        cb.dataset.uuid = asset.UUID || asset.uuid;

        // Якщо позиція вже списана, блокуємо можливість повторного масового виділення
        if (asset['Відмітка про вибуття'] || asset.is_written_off) {
            cb.disabled = true;
        }

        cb.checked = this._selectedUUIDs.has(cb.dataset.uuid);

        cb.addEventListener('change', function (e) {
            self.updateSelection(cb.dataset.uuid, e.target.checked);
            self.syncHeaderCheckbox();
        });

        tdCb.appendChild(cb);
        tr.appendChild(tdCb);

        // 2. Наповнення даними
        const cells = [
            { text: rowNumber, align: 'left' },
            { text: asset['Найменування'] || asset.name || '—', align: 'left' },
            { text: asset['Інв. / Номенкл. №'] || asset.inv_num || '—', align: 'left' },
            { text: asset['Кількість (факт)'] !== undefined ? asset['Кількість (факт)'] : (asset.quantity || 0), align: 'right' },
            { text: asset['Сума (балансова)'] !== undefined ? `${asset['Сума (балансова)']} грн` : (`${asset.price || 0} грн`), align: 'right' },
            { text: asset['МВО (Прізвище)'] || asset.mvo || '—', align: 'left' },
            { text: asset['Об\'єкт'] || asset.object || '—', align: 'left' }
        ];

        cells.forEach(function (cell) {
            const td = document.createElement('td');
            td.textContent = cell.text;
            if (cell.align === 'right') td.style.textAlign = 'right';

            // Навішуємо слухач кліку на текст рядка для відкриття картки товару [cite: 249]
            td.addEventListener('click', function () {
                self.handleRowClick(tr.dataset.uuid);
            });
            tr.appendChild(td);
        });

        return tr;
    },

    /**
     * Оновлення локального стану та еміт актуальних даних у EventBus
     */
    updateSelection: function (uuid, isSelected) {
        if (isSelected) {
            this._selectedUUIDs.add(uuid);
        } else {
            this._selectedUUIDs.delete(uuid);
        }

        // Транслюємо стан у EventBus для плаваючої панелі масових дій [cite: 357]
        if (window.EventBus) {
            window.EventBus.emit('assets:selected', {
                uuids: Array.from(this._selectedUUIDs),
                count: this._selectedUUIDs.size
            });
        }
    },

    /**
     * Синхронізація станів головного чекбоксу (checked / indeterminate)
     */
    syncHeaderCheckbox: function () {
        const cbAll = document.getElementById('select-all');
        if (!cbAll) return;

        const total = document.querySelectorAll('.row-checkbox:not([disabled])').length;
        const checked = document.querySelectorAll('.row-checkbox:checked').length;

        cbAll.checked = checked === total && total > 0;
        cbAll.indeterminate = checked > 0 && checked < total; /* cite: 360 */
    },

    /**
     * Повне скидання виділених елементів
     */
    clearSelection: function () {
        this._selectedUUIDs.clear();

        document.querySelectorAll('.row-checkbox').forEach(function (cb) {
            cb.checked = false;
        });

        const cbAll = document.getElementById('select-all');
        if (cbAll) {
            cbAll.checked = false;
            cbAll.indeterminate = false;
        }

        // Обов'язково ховаємо панель масових дій, передаючи count: 0 [cite: 343, 362]
        if (window.EventBus) {
            window.EventBus.emit('assets:selected', { uuids: [], count: 0 });
        }
    },

    /**
     * Обробник кліку на рядок для перегляду повноцінної картки майна
     */
    handleRowClick: function (uuid) {
        console.log(`[AssetTable] Відкриття модального вікна картки для об'єкта: ${uuid}`);
        if (window.EditModal && typeof window.EditModal.open === 'function') {
            window.EditModal.open(uuid);
        }
    }
};

// Реєструємо компонент у глобальній зоні видимості Chromium
window.AssetTable = AssetTable;