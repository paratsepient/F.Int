/**
 * Компонент: EditModal
 * Редагування та видалення позиції з пріоритетним виведенням "Найменування".
 */
const EditModal = {
    _modalEl: null,
    _currentAsset: null,
    _dynamicKeys: [],
    _parentContext: null,

    getSortedKeys: function (keys) {
        const strictOrder = ["Найменування", "Тип майна", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)"];
        const sorted = [];
        strictOrder.forEach(key => { if (keys.includes(key)) sorted.push(key); });
        keys.forEach(key => { if (!sorted.includes(key)) sorted.push(key); });
        return sorted;
    },

    initDOM: function () {
        if (document.getElementById("edit-modal-wrapper")) return;
        const wrapper = document.createElement("div");
        wrapper.id = "edit-modal-wrapper";
        wrapper.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center; font-family: inherit;";

        wrapper.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 680px; max-height: 85vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--color-border);">
                <div style="padding: 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="edit-modal-back" style="display: none; background: #e5e7eb; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151;">⬅ Назад</button>
                        <h2 style="margin: 0; font-size: 18px; color: var(--color-text-main);">✏️ Редагування майна</h2>
                    </div>
                    <button id="edit-modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-muted);">✕</button>
                </div>
                <div id="edit-modal-body" style="padding: 20px; overflow-y: auto; flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                </div>
                <div style="padding: 20px; border-top: 1px solid var(--color-border); display: flex; justify-content: space-between;">
                    <button id="edit-modal-delete" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">🗑️ Видалити майно</button>
                    <button id="edit-modal-save" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">Зберегти зміни</button>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);
        this._modalEl = wrapper;

        document.getElementById("edit-modal-close").addEventListener("click", () => this.close());
        document.getElementById("edit-modal-save").addEventListener("click", () => this.save());
        document.getElementById("edit-modal-delete").addEventListener("click", () => this.triggerDelete());
        document.getElementById("edit-modal-back").addEventListener("click", () => this.goBack());

        // ВИПРАВЛЕНО: Закриття по кліку поза межами вікна
        wrapper.addEventListener('click', (e) => {
            if (e.target === wrapper) this.close();
        });
    },

    open: function (assetData, parentContext = null) {
        this.initDOM();
        this._currentAsset = assetData;
        this._parentContext = parentContext;

        const backBtn = document.getElementById("edit-modal-back");
        if (this._parentContext) {
            backBtn.style.display = "block";
        } else {
            backBtn.style.display = "none";
        }

        const excludeKeys = ["UUID", "Об'єкт_список", "__SYSTEM_STATUS__", "Тип", "Кількість (загальна)", "Кількість"];
        const hiddenCols = window.FilterPanel ? window.FilterPanel._hiddenColumns : new Set();
        let rawKeys = Object.keys(assetData).filter(k => !excludeKeys.includes(k) && !k.startsWith("Unnamed") && !hiddenCols.has(k));

        if (!rawKeys.includes("Тип майна") && !hiddenCols.has("Тип майна")) rawKeys.unshift("Тип майна");
        this._dynamicKeys = this.getSortedKeys(rawKeys);

        const body = document.getElementById("edit-modal-body");
        body.innerHTML = "";

        this._dynamicKeys.forEach((key, index) => {
            let val = assetData[key] !== null && assetData[key] !== undefined ? String(assetData[key]) : "";
            const isNameCol = key === "Найменування";
            const gridStyle = isNameCol ? "grid-column: 1 / -1;" : "";
            const isQty = key === "Кількість (факт)";

            let inputHtml = "";
            let displayKey = key;

            if (isQty) {
                // ВИПРАВЛЕНО: Видалено випадаючий список для кількості, замінено на type="number"
                displayKey = "Кількість (Факт/Загальна)";
                inputHtml = `<input type="number" step="0.01" data-key="${key}" value="${val}" style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; background: var(--color-bg-main);">`;
            } else {
                const registry = window.FilterPanel ? window.FilterPanel._globalAutocompleteRegistry : {};
                const options = registry[key] ? Array.from(registry[key]).sort() : [];
                let datalistHtml = options.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">`).join("");
                inputHtml = `
                    <input type="text" data-key="${key}" list="edit-list-${index}" value="${val.replace(/"/g, '&quot;')}" style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 13px; background: var(--color-bg-main);">
                    <datalist id="edit-list-${index}">${datalistHtml}</datalist>
                `;
            }

            body.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 5px; ${gridStyle}">
                    <label style="font-size: 12px; font-weight: bold; color: var(--color-text-main);">${displayKey}</label>
                    ${inputHtml}
                </div>
            `;
        });
        this._modalEl.style.display = "flex";
    },

    close: function () {
        if (this._modalEl) this._modalEl.style.display = "none";
        this._currentAsset = null;
        this._parentContext = null;
    },

    goBack: function () {
        if (this._parentContext) {
            this._modalEl.style.display = "none";
            if (window.SubPositionsModal) {
                window.SubPositionsModal.open(this._parentContext.itemName, this._parentContext.atomicRows);
            }
        }
    },

    triggerDelete: function () {
        const self = this;
        window.FilterPanel.showCustomConfirmOverlay(
            "⚠️ Видалення",
            "Видалити цей рядок з бази даних?",
            "Видалити",
            async function () {
                const res = await window.ApiBridge.deleteAsset(self._currentAsset.UUID);
                if (res.success) {
                    self.close();
                    await window.AssetTable.loadData();
                }
            }, true
        );
    },

    save: async function () {
        const payload = {};
        document.querySelectorAll("#edit-modal-body input").forEach(input => {
            let key = input.dataset.key;
            let val = input.value.trim();
            payload[key] = val;

            // ВИПРАВЛЕНО: Дублюємо для бекенду, щоб він зберіг це в обидві колонки (Факт і Загальна)
            if (key === "Кількість (факт)") {
                payload["Кількість"] = val;
            }
        });

        const btn = document.getElementById("edit-modal-save");
        btn.disabled = true;

        const res = await window.ApiBridge.bulkAction({ actionType: "edit", uuids: [this._currentAsset.UUID], payload: payload });

        if (res.success) {
            await window.AssetTable.loadData(); // Оновлюємо дані в пам'яті

            // ВИПРАВЛЕНО: Розумне повернення на сторінку "проміжного списку"
            if (this._parentContext && window.SubPositionsModal) {
                this._modalEl.style.display = "none";

                // Перевіряємо, чи не змінилася назва під час редагування
                const currentItemName = payload["Найменування"] || this._parentContext.itemName;
                const updatedGroup = window.AssetTable._filteredGroupedData.find(g => g["Найменування"] === currentItemName);

                // Якщо група досі існує і має більше 1 елемента — відкриваємо проміжне вікно, інакше закриваємо
                if (updatedGroup && updatedGroup._atomicRows && updatedGroup._atomicRows.length > 1) {
                    window.SubPositionsModal.open(currentItemName, updatedGroup._atomicRows);
                } else {
                    this.close();
                }
            } else {
                this.close();
            }
        }
        btn.disabled = false;
    }
};
window.EditModal = EditModal;