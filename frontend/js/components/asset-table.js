/**
 * F.Int — Компонент таблиці активів (Asset Table) - FIXED CLICKABLE
 */

const AssetTable = {
    _data: [],
    _filteredData: [],
    _selectedUuids: new Set(),
    _renderAnimationId: null,
    _eventsBound: false,

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
        console.log("[AssetTable] Ініціалізація з виправленою клікабельністю...");
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

                <div style="overflow-y: auto; overflow-x: auto; flex: 1;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="position: sticky; top: 0; background-color: var(--color-bg-sidebar); z-index: 10; box-shadow: 0 1px 0 var(--color-border);">
                            <tr id="table-header-row"></tr>
                        </thead>
                        <tbody id="table-body"></tbody>
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
        if (window.ApiBridge && typeof window.ApiBridge.get_assets === 'function') fetchMethod = () => window.ApiBridge.get_assets();
        else if (window.ApiBridge && typeof window.ApiBridge.getAssets === 'function') fetchMethod = () => window.ApiBridge.getAssets();
        else if (window.Api && typeof window.Api.get_assets === 'function') fetchMethod = () => window.Api.get_assets();
        else if (window.pywebview && window.pywebview.api) fetchMethod = () => window.pywebview.api.get_assets();

        if (fetchMethod) {
            const overlay = document.getElementById('table-loading-overlay');
            if (overlay) overlay.style.display = 'block';

            fetchMethod().then(function (data) {
                self._data = data || [];
                self._filteredData = self._data;

                if (window.EventBus) window.EventBus.emit('filters:count-updated', self._filteredData.length);
                self.renderRowsProgressive();

                if (window.FilterPanel && typeof window.FilterPanel.buildDynamicDirectories === 'function') {
                    window.FilterPanel.buildDynamicDirectories();
                }
            }).catch(function (err) {
                console.error("[AssetTable] Помилка завантаження даних:", err);
                if (overlay) overlay.style.display = 'none';
            });
        } else {
            console.error("[AssetTable] Не знайдено міст API (ApiBridge / pywebview) для завантаження майна.");
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

    renderRowsProgressive: function () {
        const tbody = document.getElementById('table-body');
        const overlay = document.getElementById('table-loading-overlay');
        if (!tbody) return;

        if (this._renderAnimationId) {
            cancelAnimationFrame(this._renderAnimationId);
        }

        tbody.innerHTML = '';

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
                const uuid = String(row["UUID"]); // Приводимо до рядка гарантовано
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
            const tr = e.target.closest('.asset-row');
            if (!tr) return;

            const uuid = String(tr.dataset.uuid); // Строга типізація

            if (e.target.classList.contains('row-checkbox')) {
                const checkbox = e.target;
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

            // ПРАВКА: Пошук повного об'єкта в _data (де є всі дані з B по X)
            const match = self._data.find(a => String(a["UUID"]) === uuid);

            if (match) {
                console.log("[AssetTable] Клік по майну, відкриваємо повну інфо:", match);
                // Прямий, гарантований виклик модального вікна
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

            // ПРАВКА №2: Коректне фільтрування майна, яке знаходиться на кількох об'єктах одразу
            let matchObject = false;
            if (filters.object === 'all') {
                matchObject = true;
            } else if (Array.isArray(row["Об'єкт_список"]) && row["Об'єкт_список"].length > 0) {
                // Якщо є масив розбитих об'єктів (через ;) — шукаємо точний збіг у цьому списку
                matchObject = row["Об'єкт_список"].includes(filters.object);
            } else {
                // Фолбек (для старих записів без ;)
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