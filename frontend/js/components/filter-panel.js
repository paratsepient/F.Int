/**
 * F.Int — Компонент панелі фільтрації та глобальних системних діалогів / Модалок структури
 * Керує пошуком, фільтрацією реєстру, динамічним додаванням, приховуванням та видаленням колонок Excel.
 * ПОВНІСТЮ ВИПРАВЛЕНО: Прибрано системний confirm(), ліквідовано ефект згортання вікна при видаленні.
 */

const FilterPanel = {
    _filters: { searchQuery: '', type: 'all', mvo: 'all', object: 'all' },
    _typeList: [], _mvoList: [], _objectsList: [],
    _globalAutocompleteRegistry: {},
    _totalCount: 0,
    _eventsBound: false,

    // Сховище для прихованих користувачем колонок у поточному сеансі
    _hiddenColumns: new Set(),

    init: function () {
        this.listenGlobalEvents();
        this.render();
    },

    /**
     * Глибоке сканування реєстру. Будує словники варіантів для фільтрів та автокомпліту
     */
    buildDynamicDirectories: function () {
        const rawData = window.AssetTable && window.AssetTable._data ? window.AssetTable._data : [];
        const typeSet = new Set();
        const mvoSet = new Set();
        const objectSet = new Set();
        this._globalAutocompleteRegistry = {};

        if (rawData.length > 0) {
            Object.keys(rawData[0]).forEach(key => {
                if (key !== "UUID" && !key.startsWith("Unnamed") && key !== "Об'єкт_список") {
                    this._globalAutocompleteRegistry[key] = new Set();
                }
            });
        }

        const self = this;
        rawData.forEach(function (item) {
            const typeVal = item["Тип"] || item["Тип майна"];
            if (typeVal) typeSet.add(String(typeVal).trim());
            if (item["МВО (Прізвище)"]) mvoSet.add(String(item["МВО (Прізвище)"]).trim());

            if (Array.isArray(item["Об'єкт_список"])) {
                item["Об'єкт_список"].forEach(o => { if (o) objectSet.add(String(o).trim()); });
            } else if (item["Об'єкт"]) {
                objectSet.add(String(item["Об'єкт"]).trim());
            }

            Object.keys(self._globalAutocompleteRegistry).forEach(key => {
                let cellValue = item[key];
                if (key === "Тип майна" && item["Тип"]) cellValue = item["Тип"];
                if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
                    self._globalAutocompleteRegistry[key].add(String(cellValue).trim());
                }
            });
        });

        this._typeList = Array.from(typeSet).sort();
        this._mvoList = Array.from(mvoSet).sort();
        this._objectsList = Array.from(objectSet).sort();

        this.render();
    },

    render: function () {
        const placeholder = document.getElementById('filter-panel-placeholder');
        if (!placeholder) return;

        let typeOptions = '<option value="all">Всі типи майна</option>';
        this._typeList.forEach(t => typeOptions += `<option value="${t}">${t}</option>`);

        let mvoOptions = '<option value="all">Всі МВО</option>';
        this._mvoList.forEach(m => mvoOptions += `<option value="${m}">${m}</option>`);

        let objectOptions = '<option value="all">Всі Об\'єкти</option>';
        this._objectsList.forEach(o => objectOptions += `<option value="${o}">${o}</option>`);

        placeholder.innerHTML = `
            <div class="filter-panel-card" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
                    <div style="font-size: 14px; font-weight: 500; color: var(--color-text-main);">
                        Знайдено: <span id="filter-total-count" style="font-weight: 700; color: var(--color-accent); font-size: 16px;">${this._totalCount}</span> позицій
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-add-asset" style="height: 36px; padding: 0 16px; background-color: #10b981; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px;">
                            ➕ Додати майно
                        </button>
                        <button id="btn-save-close" style="height: 36px; padding: 0 16px; background-color: #ef4444; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px;">
                            💾 Зберегти та закрити
                        </button>
                        <button id="btn-manage-structure" style="height: 36px; padding: 0 16px; background-color: #4b5563; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px;">
                            ⚙️ Керування структурою
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Пошук (Назва / Інв. №)</label>
                        <input type="text" id="filter-search" value="${this._filters.searchQuery}" placeholder="Введіть text для пошуку..." style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; width: 100%;">
                    </div>
                    <div style="width: 180px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Тип майна</label>
                        <select id="filter-type" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${typeOptions}
                        </select>
                    </div>
                    <div style="width: 180px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Відповідальна особа</label>
                        <select id="filter-mvo" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${mvoOptions}
                        </select>
                    </div>
                    <div style="width: 180px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Об'єкт / Локація</label>
                        <select id="filter-object" style="background-color: var(--color-bg-main); border: 1px solid var(--color-border); color: var(--color-text-main); padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; width: 100%;">
                            ${objectOptions}
                        </select>
                    </div>
                    <button id="btn-reset-filters" style="height: 35px; padding: 0 16px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-main); border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
                        Очистити
                    </button>
                </div>
            </div>
        `;

        document.getElementById('filter-type').value = this._filters.type;
        document.getElementById('filter-mvo').value = this._filters.mvo;
        document.getElementById('filter-object').value = this._filters.object;

        this.bindDOMEvents();
    },

    bindDOMEvents: function () {
        const self = this;

        const inputSearch = document.getElementById('filter-search');
        if (inputSearch) {
            let timeout = null;
            inputSearch.addEventListener('input', function (e) {
                clearTimeout(timeout);
                self._filters.searchQuery = e.target.value;
                timeout = setTimeout(() => self.notifyFiltersChanged(), 300);
            });
        }

        ['filter-type', 'filter-mvo', 'filter-object'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', function (e) {
                    const key = id.replace('filter-', '');
                    self._filters[key] = e.target.value;
                    self.notifyFiltersChanged();
                });
            }
        });

        document.getElementById('btn-reset-filters').addEventListener('click', function () {
            self._filters = { searchQuery: '', type: 'all', mvo: 'all', object: 'all' };
            if (window.AssetTable) window.AssetTable.applyFilters(self._filters);
            self.render();
        });

        document.getElementById('btn-add-asset').addEventListener('click', () => {
            if (window.AddModal) window.AddModal.open();
        });

        document.getElementById('btn-save-close').addEventListener('click', function () {
            self.showCustomConfirm("Зберегти зміни та вийти?", "Усі внесені корегування будуть записані у фізичний файл бази даних Excel, після чого додаток завершить роботу.", async function () {
                const btn = document.getElementById('btn-save-close');
                if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Збереження..."; }
                const response = await window.ApiBridge.saveAndExit();
                if (response && response.success === false) {
                    self.showCustomToast("🚨 Критична помилка: " + response.error, "error");
                    if (btn) { btn.disabled = false; btn.innerHTML = "💾 Зберегти та закрити"; }
                }
            });
        });

        document.getElementById('btn-manage-structure').addEventListener('click', function () {
            self.openStructureModal();
        });
    },

    /**
     * МОДАЛЬНЕ ВІКНО КЕРУВАННЯ СТРУКТУРОЮ
     */
    openStructureModal: function () {
        const self = this;
        // Запобігаємо дублюванню вікон у DOM
        if (document.getElementById("structure-manager-modal")) return;

        const baseData = (window.AssetTable && window.AssetTable._data.length > 0) ? window.AssetTable._data[0] : {};
        const systemExcluded = ["UUID", "Об'єкт_список", "__SYSTEM_STATUS__", "Тип"];
        const allColumns = Object.keys(baseData).filter(k => !systemExcluded.includes(k) && !k.startsWith("Unnamed"));

        const modal = document.createElement('div');
        modal.id = "structure-manager-modal";
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; justify-content: center; align-items: center;";

        modal.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 550px; max-height: 80vh; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 20px 25px rgba(0,0,0,0.15); border: 1px solid var(--color-border); position: relative;">
                
                <div id="structure-modal-loader" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); z-index: 10; justify-content: center; align-items: center; border-radius: 8px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <div style="width: 35px; height: 35px; border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                        <span style="font-size: 13px; font-weight: 600; color: #1f2937;">Оновлення файлу Excel...</span>
                    </div>
                </div>

                <div style="padding: 16px 20px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; font-size:16px; font-weight:600; color:var(--color-text-main);">⚙️ Налаштування та керування пунктами майна</h3>
                    <button id="structure-modal-close" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--color-text-muted);">✕</button>
                </div>
                <div style="padding: 16px 20px; background: #f3f4f6; border-bottom: 1px solid var(--color-border); display: flex; gap: 10px;">
                    <input type="text" id="new-column-name" placeholder="Введіть назву нового пункту (напр. Серійний №)..." style="flex:1; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 13px; outline:none; background: #fff; color: #000;">
                    <button id="btn-create-column" style="padding: 0 16px; background:#10b981; color:white; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; height: 35px;">➕ Додати пункт</button>
                </div>
                <div style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px;" id="structure-modal-fields-container">
                    </div>
                <div style="padding: 16px 20px; border-top: 1px solid var(--color-border); text-align: right;">
                    <button id="structure-modal-apply" style="padding: 8px 20px; background:#3b82f6; color:white; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer;">Застосувати зміни</button>
                </div>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(modal);

        // Відокремлений внутрішній метод рендеру списку для виключення перезавантаження вікна
        const renderFieldsList = () => {
            const container = document.getElementById("structure-modal-fields-container");
            if (!container) return;

            const currentData = (window.AssetTable && window.AssetTable._data.length > 0) ? window.AssetTable._data[0] : {};
            const activeColumnsList = Object.keys(currentData).filter(k => !systemExcluded.includes(k) && !k.startsWith("Unnamed"));

            let fieldsHtml = `<div style="font-size: 11px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 4px;">Видимість та видалення інформаційних колонок (B-X)</div>`;

            activeColumnsList.forEach(col => {
                const isHidden = self._hiddenColumns.has(col);
                const isProtected = ["Тип майна", "МВО (Прізвище)", "Об'єкт"].includes(col);

                fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--color-bg-main); border: 1px solid var(--color-border); border-radius: 6px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" class="col-visibility-chk" data-col="${col}" ${!isHidden ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                            <span style="font-size: 13px; font-weight: 500; color: var(--color-text-main);">${col} ${isProtected ? '<span style="color:#3b82f6; font-size:10px;">(Фільтр)</span>' : ''}</span>
                        </div>
                        <button class="btn-delete-column-trigger" data-col="${col}" ${isProtected ? 'disabled style="opacity:0.3; cursor:not-allowed; background:none; border:none;"' : 'style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:14px;"'} title="${isProtected ? 'Не можна видалити поле фільтрації' : 'Видалити назавжди з Excel'}">
                            🗑️
                        </button>
                    </div>
                `;
            });
            container.innerHTML = fieldsHtml;
        };

        // Первинний запуск рендеру списку стовпців
        renderFieldsList();

        const loader = document.getElementById("structure-modal-loader");
        document.getElementById('structure-modal-close').onclick = () => modal.remove();

        // Додавання нової колонки без закриття та блимання форми
        document.getElementById('btn-create-column').onclick = async function () {
            const input = document.getElementById('new-column-name');
            const colName = input.value.trim();
            if (!colName) return;

            if (loader) loader.style.display = "flex";
            const res = await window.pywebview.api.add_custom_column(colName);

            if (res.success) {
                input.value = "";
                if (window.AssetTable) await window.AssetTable.loadData();
                renderFieldsList();
                self.showCustomToast(`✅ Пункт '${colName}' успішно додано в структуру Excel!`);
            } else {
                self.showCustomConfirmOverlay("🚨 Помилка додавання", res.error, "ОК", null, false);
            }
            if (loader) loader.style.display = "none";
        };

        // ВИПРАВЛЕНО: Видалення колонки повністю переведено на внутрішнє кастомне UI-вікно підтвердження
        modal.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.btn-delete-column-trigger');
            if (!deleteBtn) return;
            const colName = deleteBtn.dataset.col;

            self.showCustomConfirmOverlay(
                "⚠️ Безповоротне видалення",
                `Ви впевнені, що хочете видалити пункт '${colName}'? Цей стовпець та ВСІ ЙОГО ДАНІ будуть назавжди вилучені з фізичного файлу Excel реєстру.`,
                "Видалити",
                async function () {
                    if (loader) loader.style.display = "flex";
                    const res = await window.pywebview.api.delete_custom_column(colName);
                    if (res.success) {
                        self._hiddenColumns.delete(colName);
                        if (window.AssetTable) await window.AssetTable.loadData();
                        renderFieldsList();
                        self.showCustomToast(`🗑️ Пункт '${colName}' повністю видалено з реєстру.`);
                    } else {
                        self.showCustomConfirmOverlay("🚨 Помилка видалення", res.error, "ОК", null, false);
                    }
                    if (loader) loader.style.display = "none";
                },
                true
            );
        });

        // Застосування видимості та миттєве оновлення відкритих модальних вікон
        document.getElementById('structure-modal-apply').onclick = function () {
            const chks = modal.querySelectorAll('.col-visibility-chk');
            chks.forEach(chk => {
                const col = chk.dataset.col;
                if (!chk.checked) {
                    self._hiddenColumns.add(col);
                } else {
                    self._hiddenColumns.delete(col);
                }
            });
            modal.remove();
            if (window.AssetTable) window.AssetTable.renderRowsProgressive();
            self.showCustomToast("👁️ Налаштування видимості полів оновлено.");
        };
    },

    /**
     * СТИЛІЗОВАНЕ ОВЕРЛЕЙ-МОДАЛЬНЕ ВІКНО ПІДТВЕРДЖЕННЯ ДЛЯ ВНУТРІШНІХ ОПЕРАЦІЙ STRUCT
     */
    showCustomConfirmOverlay: function (title, text, okText, onConfirm, showCancel = true) {
        const subOverlay = document.createElement('div');
        subOverlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 200000; display: flex; justify-content: center; align-items: center; font-family: inherit;";

        let cancelBtnHtml = showCancel ? `<button id="sub-confirm-cancel" style="padding: 8px 16px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text-main); border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">Скасувати</button>` : '';

        subOverlay.innerHTML = `
            <div style="background: var(--color-bg-sidebar, #fff); width: 420px; padding: 24px; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); border: 1px solid var(--color-border);">
                <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: var(--color-text-main);">${title}</h4>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: var(--color-text-muted); line-height: 18px;">${text}</p>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    ${cancelBtnHtml}
                    <button id="sub-confirm-ok" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">${okText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(subOverlay);

        if (showCancel) {
            document.getElementById('sub-confirm-cancel').onclick = () => subOverlay.remove();
        }

        document.getElementById('sub-confirm-ok').onclick = () => {
            if (onConfirm && typeof onConfirm === "function") onConfirm();
            subOverlay.remove();
        };
    },

    showCustomConfirm: function (title, text, onConfirm) {
        this.showCustomConfirmOverlay(title, text, "Підтвердити та вийти", onConfirm, true);
    },

    showCustomToast: function (text, type = "success") {
        const toast = document.createElement('div');
        const bg = type === "success" ? "#10b981" : "#ef4444";
        toast.style.cssText = `position: fixed; bottom: 30px; right: 30px; background: ${bg}; color: white; padding: 14px 24px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); z-index: 100001; font-weight: 600; font-size: 14px; transition: all 0.3s; transform: translateY(20px); opacity: 0;`;
        toast.innerText = text;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.transform = "translateY(0)"; toast.style.opacity = "1"; }, 50);
        setTimeout(() => { toast.style.transform = "translateY(20px)"; toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 4000);
    },

    listenGlobalEvents: function () {
        if (this._eventsBound) return;
        this._eventsBound = true;
        const self = this;
        if (window.EventBus) {
            window.EventBus.on('filters:count-updated', function (count) {
                self._totalCount = count;
                const countEl = document.getElementById('filter-total-count');
                if (countEl) countEl.innerText = count;
            });
        }
    },

    notifyFiltersChanged: function () {
        if (window.AssetTable && typeof window.AssetTable.applyFilters === 'function') {
            window.AssetTable.applyFilters(this._filters);
        }
    }
};

window.FilterPanel = FilterPanel;