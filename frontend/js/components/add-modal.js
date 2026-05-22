/**
 * Компонент: AddModal
 * Конструює інтерфейс створення запису з пріоритетним сортуванням та автокомплітом.
 */
const AddModal = {
    _modalEl: null,
    _dynamicKeys: [],

    getSortedKeys: function (keys) {
        // Найменування - перше і пріоритетне
        const strictOrder = ["Найменування", "Тип майна", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість"];
        const sorted = [];
        strictOrder.forEach(key => { if (keys.includes(key)) sorted.push(key); });
        keys.forEach(key => { if (!sorted.includes(key)) sorted.push(key); });
        return sorted;
    },

    initDOM: function () {
        if (document.getElementById("add-modal-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "add-modal-wrapper";
        wrapper.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center; font-family: inherit;";

        wrapper.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 680px; max-height: 85vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--color-border);">
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
        const baseData = (window.AssetTable && window.AssetTable._data.length > 0) ? window.AssetTable._data[0] : { "Найменування": "", "Тип майна": "" };
        const excludeKeys = ["UUID", "Об'єкт_список", "__SYSTEM_STATUS__", "Тип", "Кількість (факт)", "Кількість (загальна)"];
        const hiddenCols = window.FilterPanel ? window.FilterPanel._hiddenColumns : new Set();

        let rawKeys = Object.keys(baseData).filter(k => !excludeKeys.includes(k) && !k.startsWith("Unnamed") && !hiddenCols.has(k));
        this._dynamicKeys = this.getSortedKeys(rawKeys);

        const body = document.getElementById("add-modal-body");
        body.innerHTML = "";

        this._dynamicKeys.forEach((key, index) => {
            const isNameCol = key === "Найменування";
            const gridStyle = isNameCol ? "grid-column: 1 / -1;" : "";

            // Спрощений рендер для інпуту кількості
            if (key === "Кількість") {
                body.innerHTML += `
                    <div style="display: flex; flex-direction: column; gap: 5px; ${gridStyle}">
                        <label style="font-size: 12px; font-weight: bold; color: var(--color-text-main);">Кількість</label>
                        <input type="number" data-key="Кількість" value="" placeholder="0" style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; background: var(--color-bg-main);">
                    </div>
                `;
                return;
            }

            // Динамічний автокомпліт для кожного поля
            const registry = window.FilterPanel ? window.FilterPanel._globalAutocompleteRegistry : {};
            const options = registry[key] ? Array.from(registry[key]).sort() : [];
            let datalistHtml = options.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">`).join("");

            body.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 5px; ${gridStyle}">
                    <label style="font-size: 12px; font-weight: bold; color: var(--color-text-main);">${key}</label>
                    <input type="text" data-key="${key}" list="add-list-${index}" placeholder="Введіть або оберіть..." style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; background: var(--color-bg-main);">
                    <datalist id="add-list-${index}">${datalistHtml}</datalist>
                </div>
            `;
        });
        this._modalEl.style.display = "flex";
    },

    close: function () { if (this._modalEl) this._modalEl.style.display = "none"; },

    save: async function () {
        const payload = {};
        document.querySelectorAll("#add-modal-body input").forEach(input => { payload[input.dataset.key] = input.value.trim(); });
        const btn = document.getElementById("add-modal-save");
        btn.disabled = true;
        const res = await window.ApiBridge.addAsset(payload);
        if (res.success) {
            this.close();
            await window.AssetTable.loadData();
        } else { alert("Помилка: " + res.error); }
        btn.disabled = false;
    }
};
window.AddModal = AddModal;