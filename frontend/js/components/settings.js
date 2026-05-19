/**
 * F.Int — Компонент вкладки Налаштування (Settings Module)
 * Керує конфігурацією інтерфейсу, масштабом, зміною тем та синхронізацією з EventBus.
 * Повністю адаптовано під кремово-блакитну та темно-золоту палітру.
 */

const SettingsModule = {
    // Поточний стан конфігурації за замовчуванням
    state: {
        theme: 'light',       // 'light' (cream-blue) | 'dark' (dark-gold)
        scale: '100',        // '90' | '100' | '110'
        dbPath: 'Structured_Asset_Base.xlsx'
    },

    /**
     * Точка входу, що викликається SPA-маршрутизатором при перемиканні на вкладку
     */
    init: function () {
        console.log("[SettingsModule] Ініціалізація вкладки налаштувань...");

        // Зчитуємо поточний стан атрибута теми з тегу html для синхронізації UI
        const currentTheme = document.documentElement.getAttribute('data-theme');
        this.state.theme = currentTheme === 'dark' ? 'dark' : 'light';

        // Зчитуємо поточний коефіцієнт масштабування вікна
        const currentScale = document.body.style.zoom || '100%';
        this.state.scale = currentScale.replace('%', '') || '100';

        this.render();
    },

    /**
     * Генерація HTML структури та впровадження у робочу зону #view-container
     */
    render: function () {
        const placeholder = document.getElementById('view-container');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div class="settings-container" style="display: flex; flex-direction: column; gap: 24px; height: 100%; max-width: 600px; animation: fadeIn 0.2s ease-in-out;">
                
                <div class="view-header">
                    <h1>⚙️ Налаштування</h1>
                    <p class="text-muted" style="margin-top: 4px; color: var(--color-text-muted);">Персоналізація відображення системи обліку та конфігурація середовища</p>
                </div>

                <div class="settings-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">🎨 Оформлення інтерфейсу</h3>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-size: 14px; font-weight: 600;">Колірна схема системи</p>
                            <p style="font-size: 12px; color: var(--color-text-muted);">Зміна палітри між світлою та темною</p>
                        </div>
                        <select id="setting-theme-select" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer; font-family: var(--font-sans);">
                            <option value="light" ${this.state.theme === 'light' ? 'selected' : ''}>☀️ Світла (Кремово-блакитна)</option>
                            <option value="dark" ${this.state.theme === 'dark' ? 'selected' : ''}>🌙 Темна (Темно-сіра золота)</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <div>
                            <p style="font-size: 14px; font-weight: 600;">Масштаб елементів (Zoom)</p>
                            <p style="font-size: 12px; color: var(--color-text-muted);">Регулювання розміру шрифтів та таблиць</p>
                        </div>
                        <select id="setting-scale-select" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer; font-family: var(--font-sans);">
                            <option value="90" ${this.state.scale === '90' ? 'selected' : ''}>90% (Компактний)</option>
                            <option value="100" ${this.state.scale === '100' ? 'selected' : ''}>100% (Стандартний)</option>
                            <option value="110" ${this.state.scale === '110' ? 'selected' : ''}>110% (Збільшений)</option>
                        </select>
                    </div>
                </div>

                <div class="settings-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">📊 База даних та Шляхи</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <p style="font-size: 14px; font-weight: 600;">Поточний файл сховища Excel</p>
                        <input type="text" readonly value="${this.state.dbPath}" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-muted); padding: 10px 12px; border-radius: 6px; font-size: 13px; font-family: monospace; width: 100%; outline: none; cursor: not-allowed;">
                        <p style="font-size: 11px; color: var(--color-text-muted); line-height: 1.4; margin-top: 4px;">✓ Атомарне резервне копіювання активоване. При закритті програми через кнопку в сайдбарі стан буде автоматично зафіксовано на диску.</p>
                    </div>
                </div>

                <button id="btn-save-settings" class="btn-save-close" style="width: auto; align-self: flex-end; padding: 12px 24px; background-color: rgba(212, 175, 55, 0.15); border-color: var(--color-accent); color: var(--color-text-main);">
                    💾 Зберегти налаштування
                </button>

            </div>
        `;

        this.bindEvents();
    },

    /**
     * Навішування локальних обробників подій для інтерактивних елементів
     */
    bindEvents: function () {
        const self = this;
        const container = document.getElementById('view-container');
        if (!container) return;

        // 1. Зміна теми (Трансляція через EventBus в app.js)
        const themeSelect = container.querySelector('#setting-theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', function (e) {
                self.state.theme = e.target.value;
                self.applyThemeOnFly(self.state.theme);
            });
        }

        // 2. Динамічна зміна масштабу тексту вікна Chromium
        const scaleSelect = container.querySelector('#setting-scale-select');
        if (scaleSelect) {
            scaleSelect.addEventListener('change', function (e) {
                self.state.scale = e.target.value;
                self.applyScaleOnFly(self.state.scale);
            });
        }

        // 3. Кнопка «Зберегти налаштування»
        const btnSave = container.querySelector('#btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', function () {
                self.handleSaveConfig();
            });
        }
    },

    /**
     * Публікація події зміни колірної схеми в EventBus
     */
    applyThemeOnFly: function (theme) {
        if (window.EventBus) {
            window.EventBus.emit('settings:changed', { key: 'theme', value: theme });
        }
    },

    /**
     * Зміна масштабування документа
     */
    applyScaleOnFly: function (scaleValue) {
        document.body.style.zoom = scaleValue + "%";

        if (window.EventBus) {
            window.EventBus.emit('settings:changed', { key: 'scale', value: scaleValue });
        }
    },

    /**
     * Надсилання сформованого об'єкта конфігурації користувача до Python бекенду
     */
    handleSaveConfig: function () {
        console.log('[SettingsModule] Надсилання запиту на фіксацію конфігурації:', this.state);

        if (window.Api && typeof window.Api.bulkAction === 'function') {
            window.Api.bulkAction({
                uuids: ["SYSTEM_CONFIG"],
                actionType: 'export',
                mode: 'save',
                payload: { theme: this.state.theme, scale: this.state.scale }
            }).then(function () {
                alert('✓ Налаштування відображення успішно збережено у Data/settings.json');
            }).catch(function (err) {
                console.error('[SettingsModule] Помилка збереження:', err);
                alert(`Не вдалося зберегти налаштування: ${err.message}`);
            });
        } else {
            alert('✓ Параметри успішно застосовано в поточній сесії (Емуляція автономного фронтенду).');
        }
    }
};

// Реєструємо компонент у глобальній області видимості Chromium
window.SettingsModule = SettingsModule;