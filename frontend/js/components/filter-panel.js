/**
 * F.Int — Компонент панелі фільтрації (Filter Panel Component)
 * Керує пошуком, вибором МВО та Об'єктів, транслює зміни через EventBus.
 * Повністю сумісний з лінтерами VS Code (без помилок 1005/1109/1161).
 */

const FilterPanel = {
    // Поточний стан фільтрів в інтерфейсі
    _filters: {
        searchQuery: '',
        mvo: 'all',
        object: 'all'
    },

    // Списки для випадаючих меню
    _mvoList: [],
    _objectsList: [],

    /**
     * Точка входу, що викликається маршрутизатором (app.js)
     */
    init: function () {
        console.log("[FilterPanel] Ініціалізація панелі фільтрів...");

        // Завантажуємо актуальні довідники для селектів
        this.fetchFilterDirectories();
    },

    /**
     * Отримання списков МВО та Об'єктів для випадаючих списків
     */
    fetchFilterDirectories: function () {
        const self = this;

        // Імітація отримання унікальних значень з DataFrame бекенду
        setTimeout(function () {
            self._mvoList = ["Іванов А.В.", "Петров С.М.", "Іваненко О.П."];
            self._objectsList = ["Офіс 302", "Конференц-зал", "Кімната 101", "Склад"];

            self.render();
        }, 100);
    },

    /**
     * Генерація HTML структури панелі фільтрів
     */
    render: function () {
        const placeholder = document.getElementById('filter-panel-placeholder');
        if (!placeholder) return;

        let mvoOptions = '<option value="all">Всі МВО</option>';
        this._mvoList.forEach(function (mvo) {
            mvoOptions += `<option value="${mvo}">${mvo}</option>`;
        });

        let objectOptions = '<option value="all">Всі Об\'єкти</option>';
        this._objectsList.forEach(function (obj) {
            objectOptions += `<option value="${obj}">${obj}</option>`;
        });

        placeholder.innerHTML = `
            <div class="filter-panel-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                
                <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Пошук за базою</label>
                    <input type="text" id="filter-search" value="${this._filters.searchQuery}" placeholder="Назва, інвентарний номер..." style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; width: 100%;">
                </div>

                <div style="width: 200px; display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Відповідальна особа (МВО)</label>
                    <select id="filter-mvo" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer; width: 100%; font-family: var(--font-sans);">
                        ${mvoOptions}
                    </select>
                </div>

                <div style="width: 200px; display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Об'єкт / Локація</label>
                    <select id="filter-object" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer; width: 100%; font-family: var(--font-sans);">
                        ${objectOptions}
                    </select>
                </div>

                <button id="btn-reset-filters" style="align-self: flex-end; height: 37px; padding: 0 16px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-main); border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s;">
                    Очистити
                </button>

            </div>
        `;

        // Синхронізуємо встановлені значення в селектах
        document.getElementById('filter-mvo').value = this._filters.mvo;
        document.getElementById('filter-object').value = this._filters.object;

        this.bindEvents();
    },

    /**
     * Навішування слухачів подій зміни полів
     */
    bindEvents: function () {
        const self = this;

        const inputSearch = document.getElementById('filter-search');
        const selectMvo = document.getElementById('filter-mvo');
        const selectObject = document.getElementById('filter-object');
        const btnReset = document.getElementById('btn-reset-filters');

        // Пошук з делікатним запізненням (Input debounce)
        if (inputSearch) {
            let timeout = null;
            inputSearch.addEventListener('input', function (e) {
                clearTimeout(timeout);
                self._filters.searchQuery = e.target.value;
                timeout = setTimeout(function () {
                    self.notifySystemOfChange();
                }, 300);
            });
        }

        // Зміна МВО
        if (selectMvo) {
            selectMvo.addEventListener('change', function (e) {
                self._filters.mvo = e.target.value;
                self.notifySystemOfChange();
            });
        }

        // Зміна локації
        if (selectObject) {
            selectObject.addEventListener('change', function (e) {
                self._filters.object = e.target.value;
                self.notifySystemOfChange();
            });
        }

        // Кнопка очищення фільтрів
        if (btnReset) {
            btnReset.addEventListener('click', function () {
                self._filters.searchQuery = '';
                self._filters.mvo = 'all';
                self._filters.object = 'all';

                // Перемальовуємо панель та оновлюємо таблицю
                self.render();
                self.notifySystemOfChange();
            });
        }
    },

    /**
     * Трансляція події фільтрації в EventBus
     */
    notifySystemOfChange: function () {
        if (window.EventBus) {
            window.EventBus.emit('filters:changed', this._filters);
        }
    }
};

// Експортуємо у глобальну область видимості Chromium
window.FilterPanel = FilterPanel;