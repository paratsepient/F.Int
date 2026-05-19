/**
 * F.Int — Глобальний контролер та ядро маршрутизації (SPA Router)
 * Керує станом інтерфейсу, боковим меню, перемиканням вкладок та колірними темами.
 * Оптимізовано під специфікацію APP MAP з повною сумісністю з лінтерами.
 */

class AppController {
    constructor() {
        this.viewContainer = document.getElementById('view-container');
        this.navItems = document.querySelectorAll('.nav-item');
        this.btnSaveClose = document.getElementById('btn-save-close');

        this.currentRoute = null;
        this.init();
    }

    init() {
        const self = this;

        // 1. Навішуємо слухачі подій на кліки в боковому меню
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // 2. Обробка системної кнопки "Зберегти та закрити" згідно з архітектурою IPC
        if (this.btnSaveClose) {
            this.btnSaveClose.addEventListener('click', () => this.handleSaveAndClose());
        }

        // 3. Глобальний слухач зміни теми через EventBus для миттєвого перефарбування на льоту
        if (window.EventBus && typeof window.EventBus.on === 'function') {
            window.EventBus.on('settings:changed', function (data) {
                if (data && data.key === 'theme') {
                    const htmlEl = document.documentElement;
                    if (data.value === 'dark') {
                        htmlEl.setAttribute('data-theme', 'dark');
                    } else {
                        htmlEl.removeAttribute('data-theme'); // Повертається світла кремово-блакитна тема
                    }
                }
            });

            // Слухач базового моніторингу зміни маршрутів для діагностики
            window.EventBus.on('route:changed', function (data) {
                console.log(`[Router] Екран змінено: ${data.from} -> ${data.to}`);
            });
        }

        // 4. Ініціалізація початкового екрана за замовчуванням (Облік майна)
        this.navigateTo('asset-table');
    }

    /**
     * Перехоплення та валідація події навігації
     */
    handleNavigation(event) {
        event.preventDefault();
        const target = event.currentTarget.getAttribute('data-target');
        if (target) {
            this.navigateTo(target);
        }
    }

    /**
     * Повноцінний SPA-перемикач вкладок
     */
    navigateTo(targetView) {
        if (this.currentRoute === targetView) return;

        const previousRoute = this.currentRoute;
        this.currentRoute = targetView;

        // Синхронізація з CSS-класами в tokens.css (.nav-item.active)
        this.navItems.forEach(item => {
            if (item.getAttribute('data-target') === targetView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Безпечний рендеринг робочої зони
        this.renderView(targetView);

        // Повідомляємо інші ізольовані компоненти про зміну контексту через шину подій
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('route:changed', {
                to: targetView,
                from: previousRoute
            });
        }
    }

    /**
     * Динамічна генерація каркасів під модулі фронтенду
     */
    renderView(view) {
        if (!this.viewContainer) return;
        this.viewContainer.innerHTML = '';

        switch (view) {
            case 'asset-table':
                this.viewContainer.innerHTML = `
                    <div class="view-header">
                        <h1>📊 Облік майна</h1>
                    </div>
                    <div id="filter-panel-placeholder"></div>
                    <div id="asset-table-placeholder"></div>
                    <div id="bulk-action-bar-placeholder"></div>
                `;

                // Ініціалізація панелі фільтрів (виправлено: тепер вона викликається та рендериться)
                if (window.FilterPanel && typeof window.FilterPanel.init === 'function') {
                    window.FilterPanel.init();
                }
                // Дефенсивний виклик ініціалізації таблиці активів
                if (window.AssetTable && typeof window.AssetTable.init === 'function') {
                    window.AssetTable.init();
                }
                // Ініціалізація супутньої плаваючої панелі дій
                if (window.BulkActionBar && typeof window.BulkActionBar.init === 'function') {
                    window.BulkActionBar.init();
                }
                break;

            case 'documents':
                // Вкладка "Документи" рендерить себе самостійно у view-container через внутрішній метод
                if (window.DocumentEditor && typeof window.DocumentEditor.render === 'function') {
                    window.DocumentEditor.render();
                } else {
                    this.viewContainer.innerHTML = `<div class="error-placeholder">Помилка: Модуль DocumentEditor не завантажено.</div>`;
                }
                break;

            case 'accounting-plus':
                // Вкладка "Облік+" рендерить себе самостійно у view-container
                if (window.ArchivePanel && typeof window.ArchivePanel.init === 'function') {
                    window.ArchivePanel.init();
                } else {
                    this.viewContainer.innerHTML = `<div class="error-placeholder">Помилка: Модуль ArchivePanel не завантажено.</div>`;
                }
                break;

            case 'settings':
                // Вкладка "Налаштування" рендерить себе самостійно у view-container
                if (window.SettingsModule && typeof window.SettingsModule.init === 'function') {
                    window.SettingsModule.init();
                } else {
                    this.viewContainer.innerHTML = `<div class="error-placeholder">Помилка: Модуль SettingsModule не завантажено.</div>`;
                }
                break;

            default:
                this.viewContainer.innerHTML = `<div class="error-placeholder">Помилка: Екран [${view}] відсутній в архітектурі MAP v1.1</div>`;
        }
    }

    /**
     * Чисте закриття додатка без виникнення сокетного дедлоку Chromium
     */
    handleSaveAndClose() {
        console.log('[App] Ініційовано фінальну стадію життєвого циклу програми...');

        if (this.btnSaveClose) {
            this.btnSaveClose.disabled = true;
            this.btnSaveClose.innerText = '💾 Збереження бази...';
        }

        // Перевіряємо наявність глобальних об'єктів бекенду pywebview
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_application === 'function') {
            window.pywebview.api.close_application();
        } else if (window.Api && typeof window.Api.close_application === 'function') {
            window.Api.close_application();
        } else {
            console.warn('[Router] Бекенд-інтерфейс закриття відсутній. Емуляція виходу.');
            setTimeout(() => {
                if (this.btnSaveClose) {
                    this.btnSaveClose.disabled = false;
                    this.btnSaveClose.innerHTML = '💾 Зберегти та закрити';
                }
            }, 1000);
        }
    }
}

// Запуск контролера після повної готовності DOM структури
document.addEventListener('DOMContentLoaded', () => {
    window.App = new AppController();
});