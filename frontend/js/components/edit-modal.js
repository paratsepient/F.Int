const EditModal = {
    _modalEl: null,
    _currentAsset: null,
    _dynamicKeys: [],

    getSortedKeys: function (keys) {
        const strictOrder = ["Тип майна", "Найменування", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)"];
        const sorted = [];
        strictOrder.forEach(key => { if (keys.includes(key)) sorted.push(key); });
        keys.forEach(key => { if (!sorted.includes(key)) sorted.push(key); });
        return sorted;
    },

    initDOM: function () {
        if (document.getElementById("edit-modal-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "edit-modal-wrapper";
        wrapper.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;";

        // ВПРОВАДЖЕНО: Кнопка видалення ліворуч у блоці збереження
        wrapper.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 680px; max-height: 85vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--color-border);">
                <div style="padding: 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 18px; color: var(--color-text-main);">✏️ Редагування майна</h2>
                    <button id="edit-modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-muted);">✕</button>
                </div>
                <div id="edit-modal-body" style="padding: 20px; overflow-y: auto; flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    </div>
                <div style="padding: 20px; border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <button id="edit-modal-delete" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; transition: all 0.2s;">🗑️ Видалити майно</button>
                    <button id="edit-modal-save" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; transition: opacity 0.2s;">Зберегти зміни</button>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);
        this._modalEl = wrapper;

        document.getElementById("edit-modal-close").addEventListener("click", () => this.close());
        document.getElementById("edit-modal-save").addEventListener("click", () => this.save());
        document.getElementById("edit-modal-delete").addEventListener("click", () => this.triggerDelete());
    },

    open: function (assetData) {
        this.initDOM();
        this._currentAsset = assetData;
        const excludeKeys = ["UUID", "Об'єкт_список", "__SYSTEM_STATUS__", "Тип"];
        const hiddenCols = window.FilterPanel && window.FilterPanel._hiddenColumns ? window.FilterPanel._hiddenColumns : new Set();
        let rawKeys = Object.keys(assetData).filter(k => !excludeKeys.includes(k) && !k.startsWith("Unnamed") && !hiddenCols.has(k));

        if (!rawKeys.includes("Тип майна") && !hiddenCols.has("Тип майна")) rawKeys.unshift("Тип майна");
        this._dynamicKeys = this.getSortedKeys(rawKeys);

        const body = document.getElementById("edit-modal-body");
        body.innerHTML = "";

        this._dynamicKeys.forEach((key, index) => {
            const val = assetData[key] !== null && assetData[key] !== undefined ? String(assetData[key]) : "";
            const isTypeCol = key === "Тип майна";
            const isPriority = ["Тип майна", "Найменування", "Інв. / Номенкл. №", "Одиниця виміру", "Кількість (факт)"].includes(key);
            const borderCol = isTypeCol ? "#3b82f6" : "#3b82f6";
            const cardStyle = isPriority ? `border-left: 3px solid ${borderCol}; padding-left: 8px;` : "";
            const gridStyle = isTypeCol ? "grid-column: 1 / -1;" : "";

            const registry = window.FilterPanel && window.FilterPanel._globalAutocompleteRegistry ? window.FilterPanel._globalAutocompleteRegistry : {};
            const itemOptions = registry[key] ? Array.from(registry[key]).sort() : [];
            let datalistHtml = "";
            itemOptions.forEach(opt => { if (opt && opt !== "all") datalistHtml += `<option value="${opt.replace(/"/g, '&quot;')}">`; });
            const listId = `edit-list-${index}`;

            body.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 5px; ${gridStyle} ${cardStyle}">
                    <label style="font-size: 12px; font-weight: bold; color: var(--color-text-main);">${key}</label>
                    <input type="text" data-key="${key}" list="${listId}" value="${val.replace(/"/g, "&quot;")}" style="padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; font-family: inherit; font-size: 13px; background-color: var(--color-bg-main); color: var(--color-text-main); outline: none;">
                    <datalist id="${listId}">${datalistHtml}</datalist>
                </div>
            `;
        });
        this._modalEl.style.display = "flex";
    },

    close: function () {
        if (this._modalEl) this._modalEl.style.display = "none";
        this._currentAsset = null;
    },

    triggerDelete: function () {
        const self = this;
        const itemName = this._currentAsset["Найменування"] || "цей запис";
        if (window.FilterPanel && typeof window.FilterPanel.showCustomConfirmOverlay === "function") {
            window.FilterPanel.showCustomConfirmOverlay(
                "⚠️ Видалення майна",
                `Ви впевнені, що хочете безповоротно видалити <b>${itemName}</b> з фізичної бази даних Excel?`,
                "Видалити назавжди",
                async function () {
                    const btn = document.getElementById("edit-modal-delete");
                    btn.disabled = true; btn.innerHTML = "⏳ Видалення...";
                    const res = await window.ApiBridge.deleteAsset(self._currentAsset.UUID);
                    if (res.success) {
                        self.close();
                        if (window.AssetTable) await window.AssetTable.loadData();
                        window.FilterPanel.showCustomToast(`🗑️ Майно видалено успішно.`);
                    } else {
                        window.FilterPanel.showCustomToast("🚨 Помилка видалення: " + res.error, "error");
                        btn.disabled = false; btn.innerHTML = "🗑️ Видалити майно";
                    }
                }
            );
        }
    },

    save: async function () {
        const payload = {};
        const inputs = document.querySelectorAll("#edit-modal-body input");
        inputs.forEach(input => { payload[input.dataset.key] = input.value.trim(); });

        const btn = document.getElementById("edit-modal-save");
        btn.textContent = "Збереження..."; btn.disabled = true;

        const res = await window.ApiBridge.bulkAction({ actionType: "edit", uuids: [this._currentAsset.UUID], payload: payload });
        if (res.success) {
            this.close();
            if (window.AssetTable) await window.AssetTable.loadData();
            if (window.FilterPanel) window.FilterPanel.showCustomToast("🚀 Зміни успішно збережено в оперативну пам'ять!");
        } else {
            if (window.FilterPanel) window.FilterPanel.showCustomToast("🚨 Помилка запису: " + res.error, "error");
        }
        btn.textContent = "Зберегти зміни"; btn.disabled = false;
    }
};

window.EditModal = EditModal;