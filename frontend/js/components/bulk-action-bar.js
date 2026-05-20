/**
 * F.Int — Модуль масових операцій (Bulk Action Bar Component)
 * Реалізує плаваючу панель дій для пакетного переміщення, списання або експорту майна.
 */

const BulkActionBar = {
    _selectedUuids: [],

    init: function () {
        console.log("[BulkActionBar] Ініціалізація плаваючої панелі масових дій...");
        this.listenEvents();
    },

    /**
     * Підписка на події виділення рядків через EventBus
     */
    listenEvents: function () {
        const self = this;
        if (window.EventBus) {
            window.EventBus.on('assets:selected', function (data) {
                if (data && Array.isArray(data.uuids)) {
                    self._selectedUuids = data.uuids;
                    self.updateBarState();
                }
            });
        }
    },

    /**
     * Динамічне керування станом та рендерингом плаваючої панелі
     */
    updateBarState: function () {
        const placeholder = document.getElementById('bulk-action-bar-placeholder');
        if (!placeholder) return;

        // Якщо нічого не виділено — ховаємо панель
        if (this._selectedUuids.length === 0) {
            placeholder.innerHTML = '';
            return;
        }

        const count = this._selectedUuids.length;
        const pluralText = this.pluralize(count, "позицію", "позиції", "позицій");

        placeholder.innerHTML = `
            <div class="bulk-action-bar" style="position: fixed; bottom: 20px; left: 290px; right: 30px; background-color: var(--color-bg-sidebar); border: 2px solid var(--color-accent); border-radius: 8px; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 30px rgba(0,0,0,0.3); z-index: 999; animation: slideUp 0.2s ease-out;">
                
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="background-color: var(--color-accent); color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 12px; font-weight: 700;">
                        ${count}
                    </div>
                    <span style="font-size: 14px; font-weight: 500;">Виділено <span style="color: var(--color-accent); font-weight: 600;">${count}</span> ${pluralText} майна</span>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="bulk-btn-move" class="btn-save-close" style="width: auto; background-color: rgba(14, 165, 233, 0.15); border-color: var(--color-accent); color: var(--color-accent); height: 36px; padding: 0 14px; font-size: 13px;">📦 Перемістити</button>
                    <button id="bulk-btn-writeoff" class="btn-save-close" style="width: auto; background-color: rgba(239, 68, 68, 0.15); border-color: #ef4444; color: #ef4444; height: 36px; padding: 0 14px; font-size: 13px;">❌ Списати</button>
                    <button id="bulk-btn-export" class="btn-save-close" style="width: auto; background: transparent; height: 36px; padding: 0 14px; font-size: 13px;">📝 Згенерувати Акт</button>
                </div>

            </div>
        `;

        this.bindBarActions();
    },

    /**
     * Навішування обробників на масові кнопки плаваючої панелі
     */
    bindBarActions: function () {
        const self = this;

        // Масове переміщення групи
        document.getElementById('bulk-btn-move').addEventListener('click', function () {
            const newObject = prompt("Введіть назву НОВОГО Об'єкта (Локації) для всієї групи майна:");
            if (!newObject) return;
            const newMvo = prompt("Введіть Прізвище НОВОГО матеріально відповідального (МВО):");
            if (!newMvo) return;

            self.executeBulkAction('move', { new_object: newObject, new_mvo: newMvo });
        });

        // Масове списання групи (Кількість в Excel стане = 0)
        document.getElementById('bulk-btn-writeoff').addEventListener('click', function () {
            const reason = prompt("Вкажіть підставу / причину списання майна:");
            if (!reason) return;

            if (confirm(`Ви впевнені, що хочете масово СПИСАТИ ${self._selectedUuids.length} позицій? Кількість буде встановлена в 0.`)) {
                self.executeBulkAction('write_off', { reason: reason });
            }
        });

        // Пакетний експорт у друковану форму Excel через ExcelExporter
        document.getElementById('bulk-btn-export').addEventListener('click', function () {
            const docTitle = prompt("Введіть заголовок для Excel-документа / акта:", `Акт_передачі_${new Date().toISOString().slice(0, 10)}`);
            if (!docTitle) return;

            self.executeBulkAction('export', { title: docTitle, template: 'act_transfer' });
        });
    },

    /**
     * Відправка сформованого пакета на бекенд Python через універсальний шлюз bulkAction
     */
    executeBulkAction: function (actionType, payload) {
        const self = this;

        if (window.Api && typeof window.Api.bulkAction === 'function') {
            window.Api.bulkAction({
                uuids: self._selectedUuids,
                actionType: actionType,
                mode: 'save',
                payload: payload
            }).then(function (response) {
                if (response && response.success) {
                    alert(`Операцію успішно виконано! Оброблено позицій: ${response.processed || self._selectedUuids.length}`);

                    // Очищуємо виділення та просимо таблицю оновитися з файлу Excel
                    self._selectedUuids = [];
                    if (window.AssetTable && typeof window.AssetTable.loadData === 'function') {
                        window.AssetTable._selectedUuids.clear();
                        window.AssetTable.loadData();
                    }
                } else {
                    alert(`Бекенд відхилив операцію: ${response ? response.error : 'Невідома помилка'}`);
                }
            }).catch(function (err) {
                alert(`Критична помилка виконання IPC BulkAction: ${err.message}`);
            });
        }
    },

    /**
     * Утиліта коректного відмінювання українських слів (Pluralize)
     */
    pluralize: function (count, one, two, five) {
        let n = Math.abs(count);
        n %= 100;
        if (n >= 11 && n <= 19) return five;
        n %= 10;
        if (n === 1) return one;
        if (n >= 2 && n <= 4) return two;
        return five;
    }
};

window.BulkActionBar = BulkActionBar;