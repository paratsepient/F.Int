/**
 * F.Int — Компонент панелі фільтрації (Filter Panel Component)
 * Керує пошуком, режимом виділення та підрахунком загальної кількості.
 */

const FilterPanel = {
    _filters: {
        searchQuery: '',
        type: 'all',
        mvo: 'all',
        object: 'all'
    },

    _typeList: [],
    _mvoList: [],
    _objectsList: [],

    _totalCount: 0,
    _selectionMode: false,
    _eventsBound: false,

    init: function () {
        console.log("[FilterPanel] Ініціалізація панелі фільтрів...");
        this.listenGlobalEvents();

        // Якщо даних ще немає, малюємо пусту панель
        this.render();
    },

    /**
     * Формує унікальні довідники для 3-х випадаючих списків
     */
    buildDynamicDirectories: function () {
        const rawData = window.AssetTable && window.AssetTable._data ? window.AssetTable._data : [];

        const typeSet = new Set();
        const mvoSet = new Set();
        const objectSet = new Set();

        rawData.forEach(function (item) {
            if (item["Тип"]) typeSet.add(item["Тип"].trim());
            if (item["МВО (Прізвище)"]) mvoSet.add(item["МВО (Прізвище)"].trim());
            if (item["Об'єкт"]) objectSet.add(item["Об'єкт"].trim());
        });

        this._typeList = Array.from(typeSet).sort();
        this._mvoList = Array.from(mvoSet).sort();
        this._objectsList = Array.from(objectSet).sort();

        this.render();
    },

    render: function () {
        const placeholder = document.getElementById('filter-panel-placeholder');
        if (!placeholder) return;

        let typeOptions = '<option value="all">Всі типи майна</option>';
        this._typeList.forEach(t => typeOptions += `<option value="${t}">${t}</option>`);

        let mvoOptions = '<option value="all">Всі МВО</option>';
        this._mvoList.forEach(m => mvoOptions += `<option value="${m}">${m}</option>`);

        let objectOptions = '<option value="all">Всі Об\'єкти</option>';
        this._objectsList.forEach(o => objectOptions += `<option value="${o}">${o}</option>`);

        placeholder.innerHTML = `
            <div class="filter-panel-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
                    <div style="font-size: 14px; font-weight: 500; color: var(--color-text-main);">
                        Знайдено: <span id="filter-total-count" style="font-weight: 700; color: var(--color-accent); font-size: 16px;">${this._totalCount}</span> позицій
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-toggle-select" style="height: 36px; padding: 0 16px; background-color: ${this._selectionMode ? 'var(--color-accent)' : 'transparent'}; border: 1px solid var(--color-accent); color: ${this._selectionMode ? '#fff' : 'var(--color-accent)'}; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            ${this._selectionMode ? 'Скасувати вибір' : '☑ Обрати майно'}
                        </button>
                        <button id="btn-add-asset" style="height: 36px; padding: 0 16px; background-color: var(--color-accent); border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">
                            ➕ Додати
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    
                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Пошук (Назва / Інв. №)</label>
                        <input type="text" id="filter-search" value="${this._filters.searchQuery}" placeholder="Введіть текст для пошуку..." style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; width: 100%;">
                    </div>

                    <div style="width: 150px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Тип майна</label>
                        <select id="filter-type" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${typeOptions}
                        </select>
                    </div>

                    <div style="width: 150px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Відповідальна особа</label>
                        <select id="filter-mvo" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${mvoOptions}
                        </select>
                    </div>

                    <div style="width: 150px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Об'єкт / Локація</label>
                        <select id="filter-object" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${objectOptions}
                        </select>
                    </div>

                    <button id="btn-reset-filters" style="height: 35px; padding: 0 16px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-main); border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
                        Очистити
                    </button>
                </div>
            </div>
        `;

        document.getElementById('filter-type').value = this._filters.type;
        document.getElementById('filter-mvo').value = this._filters.mvo;
        document.getElementById('filter-object').value = this._filters.object;

        this.bindDOMEvents();
    },

    bindDOMEvents: function () {
        const self = this;

        // 1. Фільтри
        const inputSearch = document.getElementById('filter-search');
        if (inputSearch) {
            let timeout = null;
            inputSearch.addEventListener('input', function (e) {
                clearTimeout(timeout);
                self._filters.searchQuery = e.target.value;
                timeout = setTimeout(() => self.notifyFiltersChanged(), 300);
            });
        }

        ['filter-type', 'filter-mvo', 'filter-object'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', function (e) {
                    const key = id.replace('filter-', '');
                    self._filters[key] = e.target.value;
                    self.notifyFiltersChanged();
                });
            }
        });

        document.getElementById('btn-reset-filters').addEventListener('click', function () {
            self._filters = { searchQuery: '', type: 'all', mvo: 'all', object: 'all' };
            self.render();
            self.notifyFiltersChanged();
        });

        // 2. Кнопки Керування
        document.getElementById('btn-toggle-select').addEventListener('click', function () {
            self._selectionMode = !self._selectionMode;
            self.render(); // Оновлюємо колір кнопки
            if (window.EventBus) window.EventBus.emit('selection:toggle', self._selectionMode);
        });

        document.getElementById('btn-add-asset').addEventListener('click', function () {
            if (window.EventBus) window.EventBus.emit('modal:open-add');
        });
    },

    listenGlobalEvents: function () {
        if (this._eventsBound) return;
        this._eventsBound = true;

        const self = this;
        // Підписка на оновлення лічильника від таблиці
        if (window.EventBus) {
            window.EventBus.on('filters:count-updated', function (count) {
                self._totalCount = count;
                const countEl = document.getElementById('filter-total-count');
                if (countEl) countEl.innerText = count;
            });
        }
    },

    notifyFiltersChanged: function () {
        if (window.EventBus) {
            window.EventBus.emit('filters:changed', this._filters);
        }
    }
};

window.FilterPanel = FilterPanel;