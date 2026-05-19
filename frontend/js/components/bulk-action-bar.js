/**
 * F.Int — Компонент плаваючої панелі дій (Bulk Action Bar Component)
 * Керує станом інтерфейсу та координує виконання масових операцій.
 * Оптимізовано під специфікацію APP MAP v1.1 та tokens.css з повною сумісністю.
 */

const BulkActionBar = {
    _currentUUIDs: [],

    /**
     * Точка входу, що викликається при ініціалізації вкладки Обліку майна
     */
    init: function () {
        console.log('[BulkActionBar] Ініціалізація плаваючої панелі масових дій...');
        this.renderStructure();
        this.registerEvents();
    },

    /**
     * Динамічне створення HTML розмітки панелі всередині її плейсхолдера
     */
    renderStructure: function () {
        const placeholder = document.getElementById('bulk-action-bar-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = '';

        // Створюємо елемент панелі
        this.barEl = document.createElement('div');
        this.barEl.className = 'bulk-action-bar-container';
        this.barEl.style.display = 'none'; // За замовчуванням прихована

        // Створюємо внутрішню структуру згідно зі специфікацією
        this.barEl.innerHTML = `
            <div class="bulk-info-side">
                <span id="bulk-count-label" class="bulk-count-text">Вибрано: 0 позицій</span>
                <span id="bulk-loading-spinner" class="bulk-spinner" style="display: none;"></span>
            </div>
            <div class="bulk-actions-side">
                <button id="btn-bulk-move" class="btn-bulk-action btn-secondary">↗ Перемістити</button>
                <button id="btn-bulk-writeoff" class="btn-bulk-action btn-secondary">🗑 Списати</button>
                <button id="btn-bulk-export" class="btn-bulk-action btn-secondary">📥 Експорт</button>
                <button id="btn-bulk-reset" class="btn-bulk-reset">✕ Скинути</button>
            </div>
        `;

        placeholder.appendChild(this.barEl);

        // КЕШУЄМО посилання на елементи керування
        this.countLabel = document.getElementById('bulk-count-label');
        this.spinner = document.getElementById('bulk-loading-spinner');
        this.btnMove = document.getElementById('btn-bulk-move');
        this.btnWriteOff = document.getElementById('btn-bulk-writeoff');
        this.btnExport = document.getElementById('btn-bulk-export');
        this.btnReset = document.getElementById('btn-bulk-reset');

        this.bindButtonActions();
    },

    /**
     * Підписка на системні події шини EventBus
     */
    registerEvents: function () {
        const self = this;
        if (window.EventBus) {
            // Слухаємо зміни виділення чекбоксів з asset-table.js
            window.EventBus.on('assets:selected', function (data) {
                if (!self.barEl || !self.countLabel) return;

                if (!data || data.count === 0) {
                    self.barEl.style.display = 'none';
                    self._currentUUIDs = [];
                    return;
                }

                self._currentUUIDs = data.uuids;
                // Застосовуємо правила відмінювання української мови
                const wording = self.pluralize(data.count, 'позиція', 'позиції', 'позицій');
                self.countLabel.textContent = `Вибрано: ${data.count} ${wording}`;
                self.barEl.style.display = 'flex'; // Показуємо панель
            });
        }
    },

    /**
     * Прив'язка кліків до обробників масових дій
     */
    bindButtonActions: function () {
        const self = this;

        if (this.btnReset) {
            this.btnReset.addEventListener('click', function () {
                if (window.AssetTable && typeof window.AssetTable.clearSelection === 'function') {
                    window.AssetTable.clearSelection();
                }
            });
        }

        if (this.btnMove) {
            this.btnMove.addEventListener('click', function () { self.handleMove(); });
        }

        if (this.btnWriteOff) {
            this.btnWriteOff.addEventListener('click', function () { self.handleWriteOff(); });
        }

        if (this.btnExport) {
            this.btnExport.addEventListener('click', function () { self.handleExport(); });
        }
    },

    /**
     * Правила відмінювання іменників для української локалізації
     */
    pluralize: function (n, one, few, many) {
        if (n % 10 === 1 && n % 100 !== 11) return one;
        if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few;
        return many;
    },

    /**
     * 1. МАСОВЕ ПЕРЕМІЩЕННЯ
     */
    handleMove: function () {
        console.log('[BulkActionBar] Запуск сценарію масового переміщення для:', this._currentUUIDs);
        // Тут буде викликано каскадний діалог вибору нового МВО та Об'єкта (Фаза Е)
        alert(`Переміщення для ${this._currentUUIDs.length} позицій готове до інтеграції з модальним вікном.`);
    },

    /**
     * 2. МАСОВЕ СПИСАННЯ (Деструктивна операція з обов'язковим підтвердженням)
     */
    handleWriteOff: function () {
        console.log('[BulkActionBar] Запуск сценарію масового списання для:', this._currentUUIDs);
        // Тут буде викликано ConfirmModal з прапором danger: true (Червона кнопка)
        const confirmed = confirm(`Увага! Ви збираєтеся списати ${this._currentUUIDs.length} позицій. Цю дію неможливо скасувати автоматично. Продовжити?`);
        if (!confirmed) return;

        this.setLoading(true);
        const self = this;

        // Імітація виклику через ApiBridge (буде підключено на наступному кроці)
        setTimeout(function () {
            self.setLoading(false);
            alert('Масове списання успішно виконано на бекенді.');
            if (window.EventBus) {
                window.EventBus.emit('bulk:completed', { success: true, processed: self._currentUUIDs, failed: [] });
            }
        }, 1200);
    },

    /**
     * 3. МАСОВИЙ ЕКСПОРТ (Безпечна операція — без діалогів підтвердження)
     */
    handleExport: function () {
        console.log('[BulkActionBar] Запуск масового експорту до Excel/PDF для:', this._currentUUIDs);
        this.setLoading(true);
        const self = this;

        setTimeout(function () {
            self.setLoading(false);
            alert('Файл Excel успішно сформовано та збережено в папку Export/.');
        }, 1000);
    },

    /**
     * Перемикання станів кнопок та спінера під час очікування відповіді від Python
     */
    setLoading: function (isLoading) {
        const buttons = [this.btnMove, this.btnWriteOff, this.btnExport, this.btnReset];
        buttons.forEach(function (btn) {
            if (btn) btn.disabled = isLoading;
        });

        if (this.spinner) this.spinner.style.display = isLoading ? 'inline-block' : 'none';
        if (this.countLabel) {
            this.countLabel.textContent = isLoading ? 'Обробка операції на сервері...' : `Вибрано: ${this._currentUUIDs.length} ...`;
        }
    }
};

// Реєструємо компонент у глобальній області видимості Chromium
window.BulkActionBar = BulkActionBar;