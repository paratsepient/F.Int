/**
 * Компонент: SubPositionsModal
 * Проміжне диспетчерське вікно
 * Виправлено: Динамічний пошук номенклатури та МВО
 */

const SubPositionsModal = {
    _modalEl: null,
    _currentItemName: null,
    _currentAtomicRows: null,

    initDOM: function () {
        if (document.getElementById("sub-positions-modal-wrapper")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "sub-positions-modal-wrapper";
        wrapper.style.cssText = "display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9998; justify-content: center; align-items: center; font-family: inherit;";

        wrapper.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 620px; max-height: 80vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--color-border);">
                <div style="padding: 16px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text-main);">📋 Розподіл майна по локаціях</h3>
                        <span id="sub-positions-item-name" style="font-size: 13px; color: var(--color-accent); font-weight: 500; word-break: break-all;">—</span>
                    </div>
                    <button id="sub-positions-modal-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-text-muted);">✕</button>
                </div>
                <div id="sub-positions-modal-list" style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; background-color: var(--color-bg-main);">
                    </div>
                <div style="padding: 14px 20px; border-top: 1px solid var(--color-border); text-align: right; background-color: var(--color-bg-sidebar);">
                    <span style="font-size: 12px; color: var(--color-text-muted);">Оберіть конкретну панель для переходу в картку редагування сутності.</span>
                </div>
            </div>
        `;

        document.body.appendChild(wrapper);
        this._modalEl = wrapper;

        document.getElementById("sub-positions-modal-close").onclick = () => this.close();

        wrapper.addEventListener('click', (e) => {
            if (e.target === wrapper) this.close();
        });
    },

    open: function (itemName, atomicRows) {
        this.initDOM();
        this._currentItemName = itemName;
        this._currentAtomicRows = atomicRows;

        document.getElementById("sub-positions-item-name").innerText = itemName;
        const listContainer = document.getElementById("sub-positions-modal-list");
        listContainer.innerHTML = "";

        const self = this;
        atomicRows.forEach((row, idx) => {
            const card = document.createElement("div");
            card.style.cssText = "background: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 6px; padding: 14px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: transform 0.1s, border-color 0.1s; box-shadow: 0 1px 2px rgba(0,0,0,0.02);";

            card.onmouseenter = () => { card.style.transform = "translateX(4px)"; card.style.borderColor = "var(--color-accent)"; };
            card.onmouseleave = () => { card.style.transform = "translateX(0)"; card.style.borderColor = "var(--color-border)"; };

            // ДИНАМІЧНИЙ ПОШУК КЛЮЧІВ (Усуває проблему зникнення номерів та МВО)
            const invKey = Object.keys(row).find(k => k.toLowerCase().includes('інв') || k.toLowerCase().includes('номенкл'));
            const nomenclature = invKey && row[invKey] ? row[invKey] : "—";

            const mvoKey = Object.keys(row).find(k => k.toLowerCase().includes('мво')) || "МВО (Прізвище)";
            const mvoDisplay = row[mvoKey] || "—";

            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; background: #e5e7eb; color: #374151; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Позиція №${idx + 1}</span>
                        <span style="font-size: 12px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Інв / Номенкл: <span style="color: var(--color-text-main); font-weight: 500;">${nomenclature}</span></span>
                    </div>
                    <div style="font-size: 14px; font-weight: 600; color: var(--color-text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 Локація: ${row["Об'єкт"] || "—"}</div>
                    <div style="font-size: 13px; color: var(--color-text-muted);">👤 Відповідальний: <span style="font-weight: 500; color: var(--color-text-main);">${mvoDisplay}</span></div>
                </div>
                <div style="text-align: right; margin-left: 16px; min-width: 80px;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--color-accent);">${row["Кількість (факт)"] || "0"}</div>
                    <div style="font-size: 11px; color: var(--color-text-muted); font-weight: 500;">${row["Одиниця виміру"] || "од."}</div>
                </div>
            `;

            card.onclick = () => {
                self.close();
                if (window.EditModal) {
                    window.EditModal.open(row, {
                        itemName: self._currentItemName,
                        atomicRows: self._currentAtomicRows
                    });
                }
            };

            listContainer.appendChild(card);
        });

        this._modalEl.style.display = "flex";
    },

    close: function () {
        if (this._modalEl) this._modalEl.style.display = "none";
    }
};

window.SubPositionsModal = SubPositionsModal;