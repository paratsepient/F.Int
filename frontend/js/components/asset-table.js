/**
 * F.Int — Компонент головної таблиці майна
 * Оновлено: Алерт згрупованих позицій винесено в окремий стовпець "Згр.".
 */

const AssetTable = {
    _data: [],
    _filteredData: [],
    _filteredGroupedData: [],
    _isFileNotFound: false,

    // ОНОВЛЕНА СТРУКТУРА: Додано стовпець "Згр." (Згруповано) в самий кінець
    DISPLAY_COLUMNS: [
        { key: "Найменування", width: "width: 420px; min-width: 320px;" },
        { key: "Інв. / Номенкл. №", width: "width: 110px;" },
        { key: "Тип майна", width: "width: 120px;" },
        { key: "Одиниця виміру", width: "width: 60px; text-align: center;" },
        { key: "Кількість (факт)", width: "width: 80px; text-align: center;" },
        { key: "МВО (Прізвище)", width: "width: 140px;" },
        { key: "Об'єкт", width: "width: 220px;" },
        { key: "Згр.", width: "width: 50px; text-align: center;" }
    ],

    init: function () {
        this.renderStructure();
        this.bindTableDelegation();
        this.loadData();
    },

    renderStructure: function () {
        const placeholder = document.getElementById('asset-table-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div id="asset-table-wrapper" class="table-container" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1; position: relative;">
                <div style="overflow-y: auto; overflow-x: auto; flex: 1;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed;">
                        <thead style="position: sticky; top: 0; background-color: var(--color-bg-sidebar); z-index: 10; box-shadow: 0 1px 0 var(--color-border);">
                            <tr id="table-header-row"></tr>
                        </thead>
                        <tbody id="table-body"></tbody>
                    </table>
                </div>
            </div>
        `;
    },

    loadData: async function () {
        try {
            const data = await window.ApiBridge.getAssets();

            if (data && data.length === 1 && data[0]["__SYSTEM_STATUS__"] === "FILE_NOT_FOUND") {
                this._isFileNotFound = true;
                this._data = [];
                this.renderDynamicHeader(); // щоб таблиця мала структуру
                this.renderRowsProgressive(); // ← одразу показуємо кнопку імпорту
                return; // ← виходимо, не йдемо в applyFilters
            }

            this._isFileNotFound = false;
            this._data = data || [];
            this._filteredData = this._data;

            if (window.FilterPanel && typeof window.FilterPanel.buildDynamicDirectories === 'function') {
                window.FilterPanel.buildDynamicDirectories();
            }

            const activeFilters = (window.FilterPanel && window.FilterPanel._filters)
                ? window.FilterPanel._filters
                : { searchQuery: '', type: 'all', mvo: 'all', object: 'all' };

            this.applyFilters(activeFilters);

        } catch (err) {
            console.error("[AssetTable] Помилка завантаження плоских даних:", err);
        }
    },

    renderDynamicHeader: function () {
        const theadRow = document.getElementById('table-header-row');
        if (!theadRow) return;

        let headerHtml = `<th style="padding: 12px 16px; width: 45px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); font-weight: 700; text-align: center;">№</th>`;

        this.DISPLAY_COLUMNS.forEach(col => {
            let textAlign = col.width.includes("text-align: center;") ? "text-align: center;" : "text-align: left;";
            headerHtml += `<th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; ${col.width} ${textAlign}">${col.key}</th>`;
        });

        theadRow.innerHTML = headerHtml;
    },

    renderRowsProgressive: function () {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        if (this._isFileNotFound) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 80px; color: var(--color-text-muted);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; font-family: inherit;">
                            <span style="font-size: 48px;">📂</span>
                            <div style="font-size: 16px; font-weight: 600; color: var(--color-text-main);">Файл бази даних майна відсутній в каталозі info</div>
                            <div style="font-size: 13px; max-width: 420px; margin-bottom: 10px; line-height: 20px; color: var(--color-text-muted);">
                                Будь ласка, оберіть існуючий файл Excel у будь-якій іншій директорії вашого комп'ютера. 
                                Система автоматично імпортує його та скопіює в папку info з повним збереженням структури.
                            </div>
                            <button id="btn-critical-file-import" style="padding: 12px 24px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); transition: background-color 0.2s;">
                                📂 Обрати та імпортувати файл з ПК
                            </button>
                        </div>
                    </td>
                </tr>
            `;

            document.getElementById('btn-critical-file-import').addEventListener('click', async () => {
                const res = await window.pywebview.api.import_excel_file();
                if (res && res.success) {
                    if (window.FilterPanel && typeof window.FilterPanel.showCustomToast === 'function') {
                        window.FilterPanel.showCustomToast(`📂 Базу майна успішно імпортовано! Завантажено рядків: ${res.rows_imported}`, "success");
                    }
                    this.loadData();
                } else if (res && res.error) {
                    if (window.FilterPanel && typeof window.FilterPanel.showCustomToast === 'function') {
                        window.FilterPanel.showCustomToast(`🚨 Помилка імпорту файлу: ${res.error}`, "error");
                    }
                }
            });
            return;
        }

        if (this._filteredGroupedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 14px;">Майно за вказаними критеріями пошуку не знайдено.</td></tr>`;
            return;
        }

        this.renderDynamicHeader();

        let htmlChunk = '';
        this._filteredGroupedData.forEach((row, i) => {
            const hasSplits = row._atomicRows && row._atomicRows.length > 1;

            const splitIndicator = hasSplits
                ? `<span style="background: var(--color-accent, #3b82f6); color: white; font-size: 11px; min-width: 22px; height: 22px; padding: 0 6px; display: inline-flex; justify-content: center; align-items: center; border-radius: 6px; font-weight: 700; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);" title="Згруповано записів у файлі: ${row._atomicRows.length}">${row._atomicRows.length}</span>`
                : '';

            htmlChunk += `<tr class="asset-row" data-index="${i}" style="cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background-color 0.1s;">`;
            htmlChunk += `<td style="padding: 12px 16px; font-size: 13px; color: var(--color-text-muted); font-weight: 500; text-align: center;">${i + 1}</td>`;

            this.DISPLAY_COLUMNS.forEach(col => {
                let val = row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== "" ? row[col.key] : '—';

                if (window.FilterPanel && window.FilterPanel._hiddenColumns.has(col.key)) {
                    return;
                }

                let cellStyle = `padding: 12px 16px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--color-border); ${col.width}`;

                if (col.key === 'Найменування') {
                    cellStyle += ' font-weight: 500; color: var(--color-text-main);';
                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}</td>`;
                }
                else if (col.key === 'Одиниця виміру') {
                    htmlChunk += `<td style="${cellStyle} text-align: center;" title="${val}">${val}</td>`;
                }
                else if (col.key === 'Кількість (факт)') {
                    cellStyle += ' font-weight: 600; color: var(--color-accent); text-align: center;';
                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}</td>`;
                }
                // НОВЕ: Рендер індикатора у новому стовпці
                else if (col.key === "Згр.") {
                    htmlChunk += `<td style="${cellStyle} text-align: center; vertical-align: middle;">${splitIndicator}</td>`;
                }
                else {
                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}</td>`;
                }
            });
            htmlChunk += `</tr>`;
        });

        tbody.innerHTML = htmlChunk;
    },

    applyFilters: function (filters) {
        if (this._isFileNotFound) return;

        const q = (filters.searchQuery || '').toLowerCase();

        this._filteredData = this._data.filter(row => {
            const matchSearch = q === '' || Object.keys(row).some(key =>
                key !== 'UUID' && row[key] && String(row[key]).toLowerCase().includes(q)
            );

            const matchType = filters.type === 'all' || row["Тип майна"] === filters.type || row["Тип"] === filters.type;

            const mvoKey = Object.keys(row).find(k => k.toLowerCase().includes('мво')) || "МВО (Прізвище)";
            const matchMvo = filters.mvo === 'all' || row[mvoKey] === filters.mvo;

            let matchObject = false;
            if (filters.object === 'all') {
                matchObject = true;
            } else if (Array.isArray(row["Об'єкт_список"]) && row["Об'єкт_список"].length > 0) {
                matchObject = row["Об'єкт_список"].includes(filters.object);
            } else {
                matchObject = row["Об'єкт"] === filters.object;
            }

            return matchSearch && matchType && matchMvo && matchObject;
        });

        const groups = {};
        this._filteredData.forEach(row => {
            const name = row["Найменування"] ? String(row["Найменування"]).trim() : "—";
            if (!groups[name]) groups[name] = [];
            groups[name].push(row);
        });

        this._filteredGroupedData = Object.keys(groups).map(name => {
            const rows = groups[name];
            const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r["Кількість (факт)"]) || 0), 0);

            const objQuantities = {};
            rows.forEach(r => {
                const obj = r["Об'єкт"] || "—";
                const qty = parseFloat(r["Кількість (факт)"]) || 0;
                objQuantities[obj] = (objQuantities[obj] || 0) + qty;
            });

            let dominantObject = "—";
            let maxObjQty = -1;
            Object.keys(objQuantities).forEach(obj => {
                if (objQuantities[obj] > maxObjQty) {
                    maxObjQty = objQuantities[obj];
                    dominantObject = obj;
                }
            });

            const mvoKey = Object.keys(rows[0]).find(k => k.toLowerCase().includes('мво')) || "МВО (Прізвище)";
            const distinctMvos = [...new Set(rows.map(r => r[mvoKey]).filter(Boolean))];
            const mvoDisplay = distinctMvos.length === 1 ? distinctMvos[0] : (distinctMvos.length > 1 ? "Різні" : "—");

            const distinctInvs = [...new Set(rows.map(r => {
                const invK = Object.keys(r).find(key => key.toLowerCase().includes('інв') || key.toLowerCase().includes('номенкл'));
                return invK ? r[invK] : null;
            }).filter(Boolean))];
            const invDisplay = distinctInvs.length === 1 ? distinctInvs[0] : (distinctInvs.length > 1 ? "Різні" : "—");

            return {
                ...rows[0],
                "Найменування": name,
                "Кількість (факт)": totalQty,
                "Об'єкт": dominantObject,
                "МВО (Прізвище)": mvoDisplay,
                "Інв. / Номенкл. №": invDisplay,
                "_atomicRows": rows
            };
        });

        if (window.EventBus) {
            window.EventBus.emit('filters:count-updated', this._filteredGroupedData.length);
        }

        this.renderRowsProgressive();
    },

    bindTableDelegation: function () {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            if (this._isFileNotFound) return;

            const tr = e.target.closest('.asset-row');
            if (!tr) return;

            const idx = parseInt(tr.dataset.index);
            const groupedItem = this._filteredGroupedData[idx];
            if (!groupedItem) return;

            const atomicRows = groupedItem._atomicRows || [];

            if (atomicRows.length <= 1) {
                if (window.EditModal) window.EditModal.open(atomicRows[0] || groupedItem);
            } else {
                if (window.SubPositionsModal) {
                    window.SubPositionsModal.open(groupedItem["Найменування"], atomicRows);
                }
            }
        });
    }
};

window.AssetTable = AssetTable;