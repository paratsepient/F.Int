/**
 * F.Int — GroupedModal
 * Модернізований автономний модуль редагування майна з гарантованим рендером
 * та підтримкою динамічних випадаючих меню (Auto-suggestions) на базі наявних даних.
 */
const GroupedModal = {
    currentAsset: null,

    // Точка входу. Приймає виключно payload, скасовуємо крихку перевірку на Event.
    init(payload) {
        if (!payload) return;

        // Безпечна екстракція даних незалежно від джерела виклику (EventBus або прямий виклик)
        const assetData = payload.detail?.asset || payload.detail || payload.asset || payload;

        // Валідація наявності ідентифікатора рядка
        if (typeof assetData !== 'object' || !assetData['UUID']) {
            console.warn("[GroupedModal] Відхилено: передано невалідний об'єкт майна.", payload);
            return;
        }

        this.currentAsset = assetData;
        this.render();
    },

    open(data) {
        this.init(data);
    },

    render() {
        let overlay = document.getElementById('grouped-modal-overlay');

        // Створення або очищення контейнера
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'grouped-modal-overlay';
            document.body.appendChild(overlay);
        }

        // Жорсткі inline-стилі гарантують, що вікно завжди буде по центру екрана поверх усіх інших елементів.
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999; opacity: 1; transition: opacity 0.2s ease-in-out;
        `;

        const data = this.currentAsset;

        // Нормалізація значень, які можуть мати різні назви колонок в Excel
        const invNumber = data["Інв. / Номенкл. №"] || data["Інв. / Номенкл. №"] || data["Інвентарний номер"] || '';
        const qty = data["Кількість (факт)"] || data["Загальна кількість"] || data["Кількість"] || '0';

        // Збір масиву наявних даних з таблиці для динамічного формування випадаючих списків
        const loadedAssets = window.AssetTable?._data || [];

        // Вилучаємо унікальні значення, очищаємо від порожніх елементів та сортуємо за алфавітом
        const uniqueTypes = [...new Set(loadedAssets.map(a => a["Тип майна"] || a["Тип"]).filter(Boolean))].sort();
        const uniqueUnits = [...new Set(loadedAssets.map(a => a["Одиниця виміру"]).filter(Boolean))].sort();
        const uniqueMvos = [...new Set(loadedAssets.map(a => a["МВО (Прізвище)"] || a["МВО"]).filter(Boolean))].sort();
        const uniqueDeps = [...new Set(loadedAssets.map(a => a["Підрозділ (Частина)"] || a["Підрозділ"]).filter(Boolean))].sort();

        // Об'єкти розгортаємо з масиву списков, враховуючи нове мульті-розділення (по ; та :)
        const uniqueObjects = [...new Set(loadedAssets.flatMap(a => a["Об'єкт_список"] || [a["Об'єкт"]]).filter(Boolean).map(s => String(s).trim()))].sort();

        overlay.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #ffffff); width: 100%; max-width: 550px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border, #e2e8f0);">
                
                <div style="padding: 16px 24px; border-bottom: 1px solid var(--color-border, #e2e8f0); display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-main, #f8fafc);">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--color-text-main, #0f172a);">Деталі майна / Редагування</h2>
                    <button id="modal-close-x" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-text-muted, #64748b); padding: 0; line-height: 1;">&times;</button>
                </div>
                
                <div style="padding: 24px; overflow-y: auto; max-height: 65vh;">
                    <form id="grouped-modal-form" style="display: flex; flex-direction: column; gap: 16px;">
                        ${this._createInput('Найменування', data["Найменування"])}
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            ${this._createInput('Інв. / Номенкл. №', invNumber)}
                            ${this._createInput('Кількість (факт)', qty, 'number')}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            ${this._createInput('Тип майна', data["Тип майна"] || data["Тип"], 'text', uniqueTypes)}
                            ${this._createInput('Одиниця виміру', data["Одиниця виміру"], 'text', uniqueUnits)}
                        </div>
                        ${this._createInput('МВО (Прізвище)', data["МВО (Прізвище)"] || data["МВО"], 'text', uniqueMvos)}
                        ${this._createInput('Підрозділ (Частина)', data["Підрозділ (Частина)"] || data["Підрозділ"], 'text', uniqueDeps)}
                        ${this._createInput('Об\'єкт', data["Об'єкт"], 'text', uniqueObjects)}
                    </form>
                </div>
                
                <div style="padding: 16px 24px; border-top: 1px solid var(--color-border, #e2e8f0); display: flex; justify-content: flex-end; gap: 12px; background: var(--color-bg-main, #f8fafc);">
                    <button id="modal-close-btn" style="padding: 8px 16px; border: 1px solid var(--color-border, #cbd5e1); background: transparent; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--color-text-main, #334155);">Скасувати</button>
                    <button id="modal-save-btn" style="padding: 8px 16px; background: var(--color-accent, #3b82f6); color: #ffffff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Зберегти зміни</button>
                </div>
            </div>
        `;

        this.bindEvents(overlay);
    },

    // Допоміжний метод генерації полів введення із підтримкою нативних випадаючих пропозицій (datalist)
    _createInput(field, value, type = 'text', suggestions = null) {
        const esc = (val) => String(val ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        // Генеруємо безпечний і унікальний ідентифікатор списку на основі імені поля
        const listId = suggestions && suggestions.length ? `list-${btoa(encodeURIComponent(field)).replace(/=/g, '')}` : '';

        let inputAttr = `type="${type}" data-field="${field}" value="${esc(value)}"`;
        if (listId) {
            // Зв'язуємо input та datalist через атрибут list
            inputAttr += ` list="${listId}" autocomplete="off" placeholder="Оберіть зі списку або введіть..."`;
        }

        let datalistHtml = '';
        if (listId) {
            datalistHtml = `<datalist id="${listId}">`;
            suggestions.forEach(item => {
                if (item) {
                    datalistHtml += `<option value="${esc(item)}">`;
                }
            });
            datalistHtml += `</datalist>`;
        }

        return `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--color-text-muted, #475569);">${field}</label>
                <input ${inputAttr} style="padding: 10px 12px; border: 1px solid var(--color-border, #cbd5e1); border-radius: 6px; outline: none; font-size: 14px; background: var(--color-bg-sidebar, #ffffff); color: var(--color-text-main, #0f172a); transition: border-color 0.2s;">
                ${datalistHtml}
            </div>
        `;
    },

    bindEvents(overlay) {
        // Делегування закриття по хрестику чи кнопці скасування
        const closeIds = ['modal-close-x', 'modal-close-btn'];
        closeIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => this.close();
        });

        // Закриття по кліку на темний фон поза модалкою
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        // Покращення UX: при кліку на інпут з випадаючим меню, миттєво розгортаємо перелік наявних пропозицій
        overlay.querySelectorAll('input[list]').forEach(input => {
            input.addEventListener('click', () => {
                const currentVal = input.value;
                input.value = '';
                setTimeout(() => { input.value = currentVal; }, 1);
            });
        });

        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) {
            saveBtn.onclick = async (e) => {
                e.preventDefault();
                await this.save();
            };
        }
    },

    close() {
        const overlay = document.getElementById('grouped-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML = '';
        }
        this.currentAsset = null;
    },

    async save() {
        const form = document.getElementById('grouped-modal-form');
        const saveBtn = document.getElementById('modal-save-btn');

        if (!form || !this.currentAsset?.["UUID"]) return;

        // Збираємо оновлені дані з форми
        const payload = { ...this.currentAsset };
        form.querySelectorAll('input[data-field]').forEach(input => {
            payload[input.getAttribute('data-field')] = input.value.trim();
        });

        // Забезпечуємо сумісність ключів для бекенду pandas
        payload["Тип"] = payload["Тип майна"];
        payload["Інв. / Номенкл. №"] = payload["Інв. / Номенкл. №"];

        // Пошук доступного API-мосту
        const api = window.ApiBridge || window.pywebview?.api || window.Api;
        if (!api) {
            alert("Помилка: API міст для зв'язку з Python не знайдено.");
            return;
        }

        try {
            // Блокуємо кнопку від подвійного кліку
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Збереження...';
                saveBtn.style.opacity = '0.7';
            }

            const config = {
                uuids: [payload["UUID"]],
                actionType: 'edit',
                mode: 'commit',
                payload: payload
            };

            // Виклик Python-бекенду через async/await
            const response = typeof api.bulkAction === 'function'
                ? await api.bulkAction(config)
                : await api.edit_asset(payload);

            if (response?.success) {
                this.close();
                // Гаряче перезавантаження даних таблиці
                if (typeof window.AssetTable?.loadData === 'function') {
                    window.AssetTable.loadData();
                } else {
                    location.reload();
                }
            } else {
                throw new Error(response?.error || 'Бекенд повернув помилку збереження.');
            }
        } catch (err) {
            console.error("[GroupedModal] Помилка виконання запиту:", err);
            alert(`Не вдалося зберегти зміни: ${err.message}`);
        } finally {
            // Відновлення стану кнопки у разі помилки
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Зберегти зміни';
                saveBtn.style.opacity = '1';
            }
        }
    }
};

window.GroupedModal = GroupedModal;

// Глобальний підписник на шину подій
if (window.EventBus) {
    window.EventBus.on('asset:open-grouped-modal', data => GroupedModal.init(data));
}