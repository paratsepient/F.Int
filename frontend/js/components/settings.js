/**
 * F.Int — Компонент вкладки Налаштування (Settings Module) (FIXED)
 */

const SettingsModule = {
    state: {
        theme: 'light',
        scale: '100',
        dbPath: 'Structured_Asset_Base.xlsx',
        columnNames: {} // Ініціалізуємо порожнім об'єктом, щоб не було undefined
    },

    // Безпечне отримання назви колонки
    getColumnName: function (key) {
        if (this.state && this.state.columnNames && this.state.columnNames[key]) {
            return this.state.columnNames[key];
        }
        // Значення за замовчуванням
        const defaults = {
            "Найменування": "Найменування",
            "Інв. / Номенкл. №": "Інвентарний номер",
            "Тип": "Тип",
            "Одиниця виміру": "Одиниця виміру",
            "Кількість (факт)": "Кількість",
            "МВО (Прізвище)": "МВО",
            "Об'єкт": "Підрозділ" // Тут ми пов'язуємо технічний "Об'єкт" з візуальним "Підрозділ"
        };
        return defaults[key] || key;
    },

    init: function () {
        console.log("[SettingsModule] Ініціалізація вкладки налаштувань...");
        const currentTheme = document.documentElement.getAttribute('data-theme');
        this.state.theme = currentTheme === 'dark' ? 'dark' : 'light';
        const currentScale = document.body.style.zoom || '100%';
        this.state.scale = currentScale.replace('%', '') || '100';

        // Гарантуємо, що columnNames існує
        if (!this.state.columnNames) this.state.columnNames = {};

        this.render();
    },

    render: function () {
        const placeholder = document.getElementById('view-container');
        if (!placeholder) return;

        const colKeys = [
            { key: "Найменування", label: "Найменування (Стовпець F)" },
            { key: "Інв. / Номенкл. №", label: "Інвентарний номер (Стовпець H)" },
            { key: "Тип", label: "Тип майна (Стовпець E)" },
            { key: "Одиниця виміру", label: "Одиниця виміру (Стовпець K)" },
            { key: "Кількість (факт)", label: "Кількість (Стовпець L)" },
            { key: "МВО (Прізвище)", label: "МВО (Стовпець C)" },
            { key: "Об'єкт", label: "Підрозділ (Стовпець B)" }
        ];

        let colsHtml = '';
        colKeys.forEach(c => {
            const val = this.getColumnName(c.key);
            colsHtml += `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: 600;">${c.label}</label>
                    <input type="text" data-col="${c.key}" class="col-name-input" value="${val}" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none;">
                </div>
            `;
        });

        placeholder.innerHTML = `
            <div class="settings-container" style="display: flex; flex-direction: column; gap: 24px; height: 100%; max-width: 600px; animation: fadeIn 0.2s ease-in-out; padding-bottom: 30px;">
                
                <div class="view-header">
                    <h1>⚙️ Налаштування</h1>
                    <p class="text-muted" style="margin-top: 4px; color: var(--color-text-muted);">Персоналізація відображення системи обліку</p>
                </div>

                <div class="settings-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">📝 Назви колонок у таблиці майна</h3>
                    <p style="font-size: 12px; color: var(--color-text-muted);">Змініть заголовки, які будуть відображатися над майном на головній вкладці.</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
                        ${colsHtml}
                    </div>
                </div>

                <div class="settings-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">🎨 Оформлення інтерфейсу</h3>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="font-size: 14px; font-weight: 600;">Колірна схема системи</p>
                            <p style="font-size: 12px; color: var(--color-text-muted);">Зміна палітри між світлою та темною</p>
                        </div>
                        <select id="setting-theme-select" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer;">
                            <option value="light" ${this.state.theme === 'light' ? 'selected' : ''}>☀️ Світла (Кремово-блакитна)</option>
                            <option value="dark" ${this.state.theme === 'dark' ? 'selected' : ''}>🌙 Темна (Темно-сіра золота)</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <div>
                            <p style="font-size: 14px; font-weight: 600;">Масштаб елементів (Zoom)</p>
                            <p style="font-size: 12px; color: var(--color-text-muted);">Регулювання розміру шрифтів та таблиць</p>
                        </div>
                        <select id="setting-scale-select" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; cursor: pointer;">
                            <option value="90" ${this.state.scale === '90' ? 'selected' : ''}>90% (Компактний)</option>
                            <option value="100" ${this.state.scale === '100' ? 'selected' : ''}>100% (Стандартний)</option>
                            <option value="110" ${this.state.scale === '110' ? 'selected' : ''}>110% (Збільшений)</option>
                        </select>
                    </div>
                </div>

                <button id="btn-save-settings" class="btn-save-close" style="width: auto; align-self: flex-end; padding: 12px 24px; background-color: rgba(212, 175, 55, 0.15); border-color: var(--color-accent); color: var(--color-text-main);">
                    💾 Зберегти налаштування
                </button>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents: function () {
        const self = this;
        const container = document.getElementById('view-container');
        if (!container) return;

        const colInputs = container.querySelectorAll('.col-name-input');
        colInputs.forEach(input => {
            input.addEventListener('change', function (e) {
                const colKey = e.target.getAttribute('data-col');
                self.state.columnNames[colKey] = e.target.value;
                if (window.EventBus) window.EventBus.emit('table:refresh-required');
            });
        });

        const themeSelect = container.querySelector('#setting-theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', function (e) {
                self.state.theme = e.target.value;
                if (window.EventBus) window.EventBus.emit('settings:changed', { key: 'theme', value: self.state.theme });
            });
        }

        const scaleSelect = container.querySelector('#setting-scale-select');
        if (scaleSelect) {
            scaleSelect.addEventListener('change', function (e) {
                self.state.scale = e.target.value;
                document.body.style.zoom = self.state.scale + "%";
                if (window.EventBus) window.EventBus.emit('settings:changed', { key: 'scale', value: self.state.scale });
            });
        }

        const btnSave = container.querySelector('#btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', function () {
                self.handleSaveConfig();
            });
        }
    },

    handleSaveConfig: function () {
        console.log('[SettingsModule] Надсилання конфігурації:', this.state);
        // Використовуємо універсальний виклик для збереження
        const apiMethod = (window.ApiBridge && typeof window.ApiBridge.bulkAction === 'function')
            ? window.ApiBridge.bulkAction
            : (window.Api && typeof window.Api.bulkAction === 'function') ? window.Api.bulkAction : null;

        if (apiMethod) {
            apiMethod({
                uuids: ["SYSTEM_CONFIG"],
                actionType: 'export',
                mode: 'save',
                payload: {
                    theme: this.state.theme,
                    scale: this.state.scale,
                    columnNames: this.state.columnNames
                }
            }).then(function () {
                alert('✓ Налаштування відображення успішно збережено!');
            }).catch(function (err) {
                alert(`Не вдалося зберегти налаштування: ${err.message}`);
            });
        } else {
            alert('✓ Параметри застосовано локально.');
        }
    }
};

window.SettingsModule = SettingsModule;