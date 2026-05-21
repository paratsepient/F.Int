/**
 * F.Int — Компонент таблиці активів (Asset Table) з функцією гарячого імпорту бази
 */

const AssetTable = {
    _data: [],
    _filteredData: [],
    _selectedUuids: new Set(),
    _renderAnimationId: null,
    _eventsBound: false,
    _isFileNotFound: false, // Прапорець стану відсутності файлу Excel

    DISPLAY_COLUMNS: [
        { key: "Найменування", width: "max-width: 300px;" },
        { key: "Інв. / Номенкл. №", width: "max-width: 150px;" },
        { key: "Тип", width: "max-width: 150px;" },
        { key: "Одиниця виміру", width: "max-width: 100px;" },
        { key: "Кількість (факт)", width: "max-width: 100px;" },
        { key: "МВО (Прізвище)", width: "max-width: 180px;" },
        { key: "Об'єкт", width: "max-width: 180px;" }
    ],

    init: function () {
        console.log("[AssetTable] Ініціалізація з модулем імпорту відсутніх файлів...");
        this.renderStructure();
        this.listenEvents();
        this.bindTableDelegation();
        this.loadData();
    },

    renderStructure: function () {
        const placeholder = document.getElementById('asset-table-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <style>
                #asset-table-wrapper .td-checkbox, 
                #asset-table-wrapper .th-checkbox { display: none; }
                #asset-table-wrapper.selection-active .td-checkbox, 
                #asset-table-wrapper.selection-active .th-checkbox { display: table-cell; }
            </style>
            
            <div id="asset-table-wrapper" class="table-container" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1; position: relative;">
                
                <div id="table-loading-overlay" style="display: none; position: absolute; top: 45px; left: 0; right: 0; background: rgba(255,255,255,0.8); z-index: 5; text-align: center; padding: 10px; font-size: 12px; color: var(--color-accent); font-weight: 600; backdrop-filter: blur(2px);">
                    ⏳ Рендеринг даних...
                </div>

                <div style="overflow-y: auto; overflow-x: auto; flex: 1; display: flex; flex-direction: column;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left; flex: 1;">
                        <thead style="position: sticky; top: 0; background-color: var(--color-bg-sidebar); z-index: 10; box-shadow: 0 1px 0 var(--color-border);">
                            <tr id="table-header-row"></tr>
                        </thead>
                        <tbody id="table-body" style="flex: 1;"></tbody>
                    </table>
                </div>
            </div>
        `;

        if (window.FilterPanel && window.FilterPanel._selectionMode) {
            document.getElementById('asset-table-wrapper').classList.add('selection-active');
        }
    },

    loadData: function () {
        const self = this;

        let fetchMethod = null;
        if (window.ApiBridge && typeof window.ApiBridge.getAssets === 'function') fetchMethod = () => window.ApiBridge.getAssets();
        else if (window.ApiBridge && typeof window.ApiBridge.get_assets === 'function') fetchMethod = () => window.ApiBridge.get_assets();
        else if (window.Api && typeof window.Api.get_assets === 'function') fetchMethod = () => window.Api.get_assets();
        else if (window.pywebview && window.pywebview.api) fetchMethod = () => window.pywebview.api.get_assets();

        if (fetchMethod) {
            const overlay = document.getElementById('table-loading-overlay');
            if (overlay) overlay.style.display = 'block';

            fetchMethod().then(function (data) {
                if (data && data.length === 1 && data[0]["__SYSTEM_STATUS__"] === "FILE_NOT_FOUND") {
                    self._isFileNotFound = true;
                    self._data = [];
                    self._filteredData = [];
                } else {
                    self._isFileNotFound = false;
                    self._data = data || [];
                    self._filteredData = self._data;
                }

                if (window.EventBus) window.EventBus.emit('filters:count-updated', self._filteredData.length);
                self.renderRowsProgressive();

                if (!self._isFileNotFound && window.FilterPanel && typeof window.FilterPanel.buildDynamicDirectories === 'function') {
                    window.FilterPanel.buildDynamicDirectories();
                }
            }).catch(function (err) {
                console.error("[AssetTable] Помилка завантаження даних:", err);
                if (overlay) overlay.style.display = 'none';
            });
        } else {
            console.error("[AssetTable] Не знайдено міст API для завантаження майна.");
        }
    },

    renderDynamicHeader: function () {
        const theadRow = document.getElementById('table-header-row');
        if (!theadRow) return;

        let headerHtml = `
            <th class="th-checkbox" style="padding: 12px 16px; width: 40px; border-bottom: 1px solid var(--color-border);"><input type="checkbox" id="selectAll"></th>
            <th style="padding: 12px 16px; width: 50px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">№</th>
        `;

        this.DISPLAY_COLUMNS.forEach(col => {
            let displayName = col.key;
            if (window.SettingsModule && typeof window.SettingsModule.getColumnName === 'function') {
                displayName = window.SettingsModule.getColumnName(col.key);
            }

            headerHtml += `<th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; font-weight: 700;">${displayName}</th>`;
        });

        theadRow.innerHTML = headerHtml;

        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                if (isChecked) {
                    this._filteredData.forEach(row => this._selectedUuids.add(String(row["UUID"])));
                } else {
                    this._selectedUuids.clear();
                }
                this.renderRowsProgressive();
                this.notifySelection();
            });
        }
    },

    triggerFileImport: async function () {
        // КРИТИЧНЕ ВИПРАВЛЕННЯ: Глибокий пошук методу імпорту в обхід існуючих мостів, якщо вони не оновлені
        let apiMethod = null;

        if (window.ApiBridge && typeof window.ApiBridge.import_excel_file === 'function') {
            apiMethod = () => window.ApiBridge.import_excel_file();
        } else if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.import_excel_file === 'function') {
            apiMethod = () => window.pywebview.api.import_excel_file();
        } else if (window.Api && typeof window.Api.import_excel_file === 'function') {
            apiMethod = () => window.Api.import_excel_file();
        }

        if (!apiMethod) {
            console.error("[AssetTable] Не знайдено метод import_excel_file. Стан API:", { ApiBridge: window.ApiBridge, pywebview: window.pywebview?.api });
            alert("Помилка: Бекенд-функція імпорту недоступна. Будь ласка, переконайтеся, що файл backend/api.py містить метод import_excel_file.");
            return;
        }

        try {
            const btn = document.getElementById('btn-import-trigger');
            if (btn) {
                btn.disabled = true;
                btn.textContent = "⏳ Очікування вибору файлу (вікно може бути позаду браузера)...";
            }

            const response = await apiMethod();
            console.log("[AssetTable] Результат імпорту з бекенду:", response);

            if (response?.success) {
                alert(`Імпорт успішний! Завантажено рядків: ${response.rows_imported}`);
                this.loadData();
            } else {
                alert(`Не вдалося завантажити файл: ${response?.error || 'Операцію скасовано користувачем'}`);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "📁 Імпортувати файл бази даних Excel";
                }
            }
        } catch (error) {
            console.error("Помилка при виклику нативного імпорту:", error);
            alert(`Критична помилка інтерфейсу: ${error.message}`);
            const btn = document.getElementById('btn-import-trigger');
            if (btn) {
                btn.disabled = false;
                btn.textContent = "📁 Імпортувати файл бази даних Excel";
            }
        }
    },

    renderRowsProgressive: function () {
        const tbody = document.getElementById('table-body');
        const overlay = document.getElementById('table-loading-overlay');
        if (!tbody) return;

        if (this._renderAnimationId) {
            cancelAnimationFrame(this._renderAnimationId);
        }

        tbody.innerHTML = '';

        if (this._isFileNotFound) {
            if (overlay) overlay.style.display = 'none';
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 60px 30px; background: var(--color-bg-sidebar);">
                        <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 16px;">
                            <span style="font-size: 36px;">⚠️</span>
                            <div style="font-size: 15px; font-weight: 600; color: var(--color-text-main);">Файл бази даних Excel не знайдено</div>
                            <p style="font-size: 13px; color: var(--color-text-muted); margin: 0; line-height: 1.5;">Програма не змогла виявити файл реєстру в робочій директорії. Будь ласка, імпортуйте існуючий файл бази даних.</p>
                            <button id="btn-import-trigger" style="margin-top: 8px; padding: 10px 20px; background: var(--color-accent, #3b82f6); color: #ffffff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); transition: background 0.2s;">
                                📁 Імпортувати файл бази даних Excel
                            </button>
                        </div>
                    </td>
                </tr>
            `;

            const btn = document.getElementById('btn-import-trigger');
            if (btn) {
                btn.onclick = () => this.triggerFileImport();
            }
            return;
        }

        if (this._filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--color-text-muted);">Майно не знайдено</td></tr>`;
            if (overlay) overlay.style.display = 'none';
            return;
        }

        if (overlay) overlay.style.display = 'block';

        this.renderDynamicHeader();

        const chunkSize = 50;
        let currentIndex = 0;
        const totalRows = this._filteredData.length;
        const dataToRender = this._filteredData;
        const self = this;

        function renderChunk() {
            const end = Math.min(currentIndex + chunkSize, totalRows);
            let htmlChunk = '';

            for (let i = currentIndex; i < end; i++) {
                const row = dataToRender[i];
                const uuid = String(row["UUID"]);
                const isChecked = self._selectedUuids.has(uuid) ? 'checked' : '';
                const rowBg = self._selectedUuids.has(uuid) ? 'background-color: var(--color-accent-subtle);' : '';

                htmlChunk += `
                    <tr class="asset-row" data-uuid="${uuid}" style="cursor: pointer; border-bottom: 1px solid var(--color-border); position: relative; transition: background-color 0.1s; ${rowBg}">
                        <td class="td-checkbox" style="padding: 12px 16px;"><input type="checkbox" class="row-checkbox" value="${uuid}" ${isChecked}></td>
                        <td style="padding: 12px 16px; font-size: 13px; color: var(--color-text-muted);">${i + 1}</td>
                `;

                self.DISPLAY_COLUMNS.forEach(col => {
                    const valKey = col.key;
                    const val = row[valKey] !== undefined && row[valKey] !== null && row[valKey] !== "" ? row[valKey] : '—';

                    const isName = valKey === 'Найменування';
                    const isQty = valKey === 'Кількість (факт)';
                    const isInv = valKey === 'Інв. / Номенкл. №';

                    let cellStyle = `padding: 12px 16px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--color-border); ${col.width}`;
                    if (isName) cellStyle += ' font-weight: 500; color: var(--color-text-main);';
                    if (isQty) cellStyle += ' font-weight: 600; color: var(--color-accent);';
                    if (isInv) cellStyle += ' font-family: monospace; letter-spacing: 0.02em;';

                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}</td>`;
                });

                htmlChunk += `</tr>`;
            }

            tbody.insertAdjacentHTML('beforeend', htmlChunk);
            currentIndex = end;

            if (currentIndex < totalRows) {
                self._renderAnimationId = requestAnimationFrame(renderChunk);
            } else {
                if (overlay) overlay.style.display = 'none';
            }
        }

        this._renderAnimationId = requestAnimationFrame(renderChunk);
    },

    listenEvents: function () {
        if (this._eventsBound) return;
        this._eventsBound = true;
        const self = this;

        if (window.EventBus) {
            window.EventBus.on('filters:changed', function (filters) {
                self.applyFilters(filters);
            });

            window.EventBus.on('table:refresh-required', function () {
                if (window.FilterPanel) window.FilterPanel.buildDynamicDirectories();
                self.renderRowsProgressive();
            });

            window.EventBus.on('selection:toggle', function (isActive) {
                const wrapper = document.getElementById('asset-table-wrapper');
                if (!wrapper) return;

                if (isActive) {
                    wrapper.classList.add('selection-active');
                } else {
                    wrapper.classList.remove('selection-active');
                    self._selectedUuids.clear();
                    self.notifySelection();
                    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
                    const selectAll = document.getElementById('selectAll');
                    if (selectAll) selectAll.checked = false;
                    document.querySelectorAll('.asset-row').forEach(row => row.style.backgroundColor = '');
                }
            });
        }
    },

    bindTableDelegation: function () {
        const tbody = document.getElementById('table-body');
        const self = this;

        tbody.addEventListener('click', function (e) {
            if (e.target.closest('#btn-import-trigger')) return;

            const tr = e.target.closest('.asset-row');
            if (!tr) return;

            const uuid = String(tr.dataset.uuid);

            if (e.target.closest('.td-checkbox') || e.target.classList.contains('row-checkbox')) {
                const checkbox = tr.querySelector('.row-checkbox');
                if (!checkbox) return;

                if (!e.target.classList.contains('row-checkbox')) {
                    checkbox.checked = !checkbox.checked;
                }

                if (checkbox.checked) {
                    self._selectedUuids.add(uuid);
                    tr.style.backgroundColor = 'var(--color-accent-subtle)';
                } else {
                    self._selectedUuids.delete(uuid);
                    tr.style.backgroundColor = '';
                }
                self.notifySelection();
                return;
            }

            if (window.FilterPanel && window.FilterPanel._selectionMode) {
                const checkbox = tr.querySelector('.row-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
            }

            const match = self._data.find(a => String(a["UUID"]) === uuid);

            if (match) {
                console.log("[AssetTable] Відкриваємо картку:", match);
                if (window.GroupedModal) {
                    window.GroupedModal.open(match);
                } else {
                    console.error("[AssetTable] Помилка: GroupedModal не знайдено!");
                }
            }
        });

        tbody.addEventListener('change', function (e) {
            if (e.target.classList.contains('row-checkbox')) {
                const tr = e.target.closest('.asset-row');
                const uuid = String(tr.dataset.uuid);
                if (e.target.checked) {
                    self._selectedUuids.add(uuid);
                    tr.style.backgroundColor = 'var(--color-accent-subtle)';
                } else {
                    self._selectedUuids.delete(uuid);
                    tr.style.backgroundColor = '';
                }
                self.notifySelection();
            }
        });
    },

    applyFilters: function (filters) {
        if (this._isFileNotFound) return;

        this._selectedUuids.clear();
        this.notifySelection();

        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;

        const q = (filters.searchQuery || '').toLowerCase();

        this._filteredData = this._data.filter(row => {
            const matchSearch = q === '' || Object.keys(row).some(key =>
                key !== 'UUID' && row[key] && String(row[key]).toLowerCase().includes(q)
            );
            const matchType = filters.type === 'all' || row["Тип"] === filters.type;
            const matchMvo = filters.mvo === 'all' || row["МВО (Прізвище)"] === filters.mvo;

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

        if (window.EventBus) window.EventBus.emit('filters:count-updated', this._filteredData.length);
        this.renderRowsProgressive();
    },

    notifySelection: function () {
        const uuids = Array.from(this._selectedUuids);
        if (window.EventBus) {
            window.EventBus.emit('assets:selected', { uuids: uuids, count: uuids.length });
        }
    }
};

window.AssetTable = AssetTable;