/**
 * F.Int — Головний контролер та ядро SPA-маршрутизації (Router / App Core)
 * Координує життєвий цикл ізольованих модулів та керує перемиканням вкладок.
 */

const App = {
    currentView: null,
    viewContainer: null,

    /**
     * Точка входу в застосунок
     */
    init: function () {
        console.log("[Router] Запуск ядра ініціалізації програми F.Int...");
        this.viewContainer = document.getElementById('view-container');

        this.bindNavigation();
        this.bindSystemEvents();

        // За замовчуванням при старті відкриваємо головну таблицю обліку майна
        this.navigate('asset-table');
    },

    /**
     * Налаштування слухачів сайдбару навігації
     */
    bindNavigation: function () {
        const self = this;
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.preventDefault();

                // Зміна активного класу підсвічування в сайдбарі
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Отримуємо ідентифікатор цільового екрана
                const targetView = item.dataset.target;
                self.navigate(targetView);
            });
        });
    },

    /**
     * Керування життєвим циклом екранів (SPA Router)
     */
    navigate: function (view) {
        if (this.currentView === view) return;
        console.log(`[Router] Екран змінено: ${this.currentView} -> ${view}`);
        this.currentView = view;

        // Повністю очищуємо плаваючу панель дій при зміні екрана
        const existingActionBar = document.getElementById('bulk-action-bar-placeholder');
        if (existingActionBar) existingActionBar.innerHTML = '';

        switch (view) {
            case 'asset-table':
                // Шаблон структури для головного екрана майна
                this.viewContainer.innerHTML = `
                    <div class="view-header" style="margin-bottom: 20px;">
                        <h1 style="font-size: 24px; font-weight: 600; color: var(--color-text-main);">📊 Облік майна</h1>
                    </div>
                    <div id="filter-panel-placeholder"></div>
                    <div id="asset-table-placeholder" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;"></div>
                    <div id="bulk-action-bar-placeholder"></div>
                `;

                // Послідовна та ізольована ініціалізація компонентів екрана
                if (window.FilterPanel && typeof window.FilterPanel.init === 'function') {
                    window.FilterPanel.init();
                }
                if (window.AssetTable && typeof window.AssetTable.init === 'function') {
                    window.AssetTable.init();
                }
                if (window.GroupedModal && typeof window.GroupedModal.init === 'function') {
                    window.GroupedModal.init();
                }
                if (window.BulkActionBar && typeof window.BulkActionBar.init === 'function') {
                    window.BulkActionBar.init();
                }
                break;

            case 'documents':
                this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <h1 style="font-size: 24px; font-weight: 600; color: var(--color-text-main);">📝 Акти та Документи</h1>
                        <p style="color: var(--color-text-muted); font-size: 14px; margin-top: 4px;">Формування та вивантаження офіційних відомостей і актів приймання-передачі.</p>
                    </div>
                    <div style="margin-top: 24px; padding: 30px; border: 1px dashed var(--color-border); border-radius: 8px; text-align: center; color: var(--color-text-muted);">
                        Модуль генерації актів готовий. Для швидкої масової вигрузки використовуйте чекбокси на вкладці "Облік майна".
                    </div>
                `;
                break;

            case 'accounting-plus':
                this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <h1 style="font-size: 24px; font-weight: 600; color: var(--color-text-main);">📁 Модуль Облік+</h1>
                    </div>
                    <div style="margin-top: 24px; padding: 30px; border: 1px dashed var(--color-border); border-radius: 8px; text-align: center; color: var(--color-text-muted);">
                        Розширені аналітичні відомості та робота з суміжними реєстрами майна.
                    </div>
                `;
                break;

            case 'settings':
                this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <h1 style="font-size: 24px; font-weight: 600; color: var(--color-text-main);">⚙️ Налаштування системи</h1>
                    </div>
                    <div style="margin-top: 24px; padding: 30px; border: 1px dashed var(--color-border); border-radius: 8px; text-align: center; color: var(--color-text-muted);">
                        Конфігурація шляхів імпорту, резервного копіювання бази Excel та зміни тем інтерфейсу.
                    </div>
                `;
                break;

            default:
                this.viewContainer.innerHTML = `<div style="padding: 20px; color: var(--color-text-muted);">Екран не знайдено або він знаходиться в стані розробки.</div>`;
        }

        // Транслюємо подію про зміну роуту в систему
        if (window.EventBus) {
            window.EventBus.emit('route:changed', { to: view });
        }
    },

    /**
     * Обробка глобальних системних кнопок та життєвого циклу IPC
     */
    bindSystemEvents: function () {
        const btnSaveClose = document.getElementById('btn-save-close');
        if (btnSaveClose) {
            btnSaveClose.addEventListener('click', function () {
                if (confirm("Зберегти всі внесені зміни в Excel-базу та вийти з програми?")) {
                    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
                        window.pywebview.api.close_app();
                    } else if (window.Api && typeof window.Api.close_app === 'function') {
                        window.Api.close_app();
                    } else {
                        window.close();
                    }
                }
            });
        }
    }
};

// ------------------------------------------------------------------------
// ЗАПУСК ДОДАТКА ТІЛЬКИ ПІСЛЯ ПОВНОЇ ГОТОВНОСТІ PYTHON-МОСТУ
// ------------------------------------------------------------------------
window.addEventListener('pywebviewready', function () {
    console.log("[System] Міст pywebview повністю готовий. Запускаємо інтерфейс...");
    App.init();
});

// Резервний запуск (якщо ви відкрили index.html просто в браузері без Python)
window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        if (!App.viewContainer) {
            console.warn("[System] Міст pywebview не знайдено. Запуск в offline-режимі...");
            App.init();
        }
    }, 1000);
});