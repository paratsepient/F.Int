/**
 * Компонент: AddModal
 * Автоматично будує форми створення запису з глобальною підтримкою списков автокомпліту для кожного поля.
 * ВИПРАВЛЕНО: Приховані пункти майна автоматично зникають із цієї форми.
 */
const AddModal = {
    _modalEl: null,
    _dynamicKeys: [],

    getSortedKeys: function (keys) {
        const strictOrder = ["Тип майна", "Найменування", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)"];
        const sorted = [];
        strictOrder.forEach(key => { if (keys.includes(key)) sorted.push(key); });
        keys.forEach(key => { if (!sorted.includes(key)) sorted.push(key); });
        return sorted;
    },

    initDOM: function () {
        if (document.getElementById("add-modal-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "add-modal-wrapper";
        wrapper.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;";

        wrapper.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 680px; max-height: 85vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--color-border);">
                <div style="padding: 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 18px; color: var(--color-text-main);">➕ Додавання нового майна</h2>
                    <button id="add-modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-muted);">✕</button>
                </div>
                <div id="add-modal-body" style="padding: 20px; overflow-y: auto; flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    </div>
                <div style="padding: 20px; border-top: 1px solid var(--color-border); text-align: right;">
                    <button id="add-modal-save" style="background: #10b981; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">Створити запис</button>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);
        this._modalEl = wrapper;

        document.getElementById("add-modal-close").addEventListener("click", () => this.close());
        document.getElementById("add-modal-save").addEventListener("click", () => this.save());
    },

    open: function () {
        this.initDOM();

        const baseData = (window.AssetTable && window.AssetTable._data.length > 0)
            ? window.AssetTable._data[0]
            : { "Тип майна": "", "Найменування": "", "Інв. / Номенкл. №": "", "Одиниця виміру": "", "Кількість (факт)": "", "МВО (Прізвище)": "", "Об'єкт": "" };

        const excludeKeys = ["UUID", "Об'єкт_список", "__SYSTEM_STATUS__", "Тип"];

        // ОНОВЛЕНО: Читаємо реєстр прихованих колонок з панелі фільтрів
        const hiddenCols = window.FilterPanel && window.FilterPanel._hiddenColumns ? window.FilterPanel._hiddenColumns : new Set();

        // Фільтруємо ключі: прибираємо системні та СУВОРЕ придушення схованих користувачем пунктів
        let rawKeys = Object.keys(baseData).filter(k => {
            return !excludeKeys.includes(k) && !k.startsWith("Unnamed") && !hiddenCols.has(k);
        });

        // Гарантуємо наявність головного поля, якщо воно не приховане
        if (!rawKeys.includes("Тип майна") && !hiddenCols.has("Тип майна")) {
            rawKeys.unshift("Тип майна");
        }

        this._dynamicKeys = this.getSortedKeys(rawKeys);

        const body = document.getElementById("add-modal-body");
        body.innerHTML = "";

        this._dynamicKeys.forEach((key, index) => {
            const isTypeCol = key === "Тип майна";
            const isPriority = ["Тип майна", "Найменування", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)"].includes(key);

            const borderCol = isTypeCol ? "#3b82f6" : "#10b981";
            const cardStyle = isPriority ? `border-left: 3px solid ${borderCol}; padding-left: 8px;` : "";
            const gridStyle = isTypeCol ? "grid-column: 1 / -1;" : "";

            const registry = window.FilterPanel && window.FilterPanel._globalAutocompleteRegistry ? window.FilterPanel._globalAutocompleteRegistry : {};
            const itemOptions = registry[key] ? Array.from(registry[key]).sort() : [];

            let datalistHtml = "";
            itemOptions.forEach(opt => {
                if (opt && opt !== "all") datalistHtml += `<option value="${opt.replace(/"/g, '&quot;')}">`;
            });

            const listId = `add-list-${index}`;

            body.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 5px; ${gridStyle} ${cardStyle}">
                    <label style="font-size: 12px; font-weight: bold; color: var(--color-text-main);">${key}</label>
                    <input type="text" data-key="${key}" list="${listId}" value="" placeholder="Оберіть або введіть значення..." style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-family: inherit; font-size: 13px; background-color: var(--color-bg-main); color: var(--color-text-main); outline: none;">
                    <datalist id="${listId}">
                        ${datalistHtml}
                    </datalist>
                </div>
            `;
        });

        this._modalEl.style.display = "flex";
    },

    close: function () {
        if (this._modalEl) this._modalEl.style.display = "none";
    },

    save: async function () {
        const payload = {};
        const inputs = document.querySelectorAll("#add-modal-body input");

        inputs.forEach(input => { payload[input.dataset.key] = input.value.trim(); });

        const btn = document.getElementById("add-modal-save");
        btn.textContent = "Створення...";
        btn.disabled = true;

        const res = await window.ApiBridge.addAsset(payload);

        if (res.success) {
            this.close();
            if (window.AssetTable) await window.AssetTable.loadData();
            if (window.FilterPanel) window.FilterPanel.showCustomToast("✅ Новий запис успішно створено!");
        } else {
            if (window.FilterPanel) window.FilterPanel.showCustomToast("🚨 Помилка створення: " + res.error, "error");
        }

        btn.textContent = "Створити запис";
        btn.disabled = false;
    }
};

window.AddModal = AddModal;