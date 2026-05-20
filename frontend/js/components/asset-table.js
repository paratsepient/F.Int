/**
 * F.Int — Компонент таблиці активів (Asset Table) - HIGH PERFORMANCE
 * Оптимізовано для великих масивів даних (800+ позицій).
 * Використовує Event Delegation та Progressive Rendering (requestAnimationFrame).
 */

const AssetTable = {
    _data: [],
    _filteredData: [],
    _selectedUuids: new Set(),
    _renderAnimationId: null, // ID для зупинки попереднього рендеру

    init: function () {
        console.log("[AssetTable] Ініціалізація високопродуктивного компонента таблиці...");
        this.renderStructure();
        this.bindEvents();
        this.bindTableDelegation(); // Єдиний слухач для всієї таблиці
        this.loadData();
    },

    renderStructure: function () {
        const placeholder = document.getElementById('asset-table-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div class="table-container" style="background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1; position: relative;">
                
                <div id="table-loading-overlay" style="display: none; position: absolute; top: 45px; left: 0; right: 0; background: rgba(255,255,255,0.8); z-index: 5; text-align: center; padding: 10px; font-size: 12px; color: var(--color-accent); font-weight: 600; backdrop-filter: blur(2px);">
                    ⏳ Рендеринг даних...
                </div>

                <div style="overflow-y: auto; flex: 1;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="position: sticky; top: 0; background-color: var(--color-bg-sidebar); z-index: 10; box-shadow: 0 1px 0 var(--color-border);">
                            <tr>
                                <th style="padding: 12px 16px; width: 40px; border-bottom: 1px solid var(--color-border);"><input type="checkbox" id="selectAll"></th>
                                <th style="padding: 12px 16px; width: 50px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">№</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Тип майна</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Найменування</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Інв. / Ном. №</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Од. вим.</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">К-сть</th>
                                <th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">Об'єкт</th>
                            </tr>
                        </thead>
                        <tbody id="table-body">
                            </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    loadData: function () {
        const self = this;
        if (window.Api && typeof window.Api.get_assets === 'function') {
            document.getElementById('table-loading-overlay').style.display = 'block';

            window.Api.get_assets().then(function (data) {
                self._data = data || [];
                self._filteredData = self._data;
                self.renderRowsProgressive(); // Запускаємо порційний рендер

                if (window.FilterPanel && typeof window.FilterPanel.buildDynamicDirectories === 'function') {
                    window.FilterPanel.buildDynamicDirectories();
                }
            }).catch(function (err) {
                console.error("[AssetTable] Помилка завантаження даних:", err);
                document.getElementById('table-loading-overlay').style.display = 'none';
            });
        }
    },

    /**
     * ПРОГРЕСИВНИЙ РЕНДЕР (Chunking)
     * Малює по 50 рядків за один кадр анімації. Не блокує інтерфейс!
     */
    renderRowsProgressive: function () {
        const tbody = document.getElementById('table-body');
        const overlay = document.getElementById('table-loading-overlay');
        if (!tbody) return;

        // Зупиняємо попередній рендер, якщо користувач швидко змінив фільтри
        if (this._renderAnimationId) {
            cancelAnimationFrame(this._renderAnimationId);
        }

        tbody.innerHTML = ''; // Очищуємо таблицю

        if (this._filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--color-text-muted);">Майно не знайдено</td></tr>`;
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'block';

        const chunkSize = 50; // Кількість рядків за один прохід (налаштовується)
        let currentIndex = 0;
        const totalRows = this._filteredData.length;
        const dataToRender = this._filteredData;
        const self = this;

        function renderChunk() {
            const end = Math.min(currentIndex + chunkSize, totalRows);
            let htmlChunk = '';

            for (let i = currentIndex; i < end; i++) {
                const row = dataToRender[i];
                const uuid = row["UUID"];
                const isChecked = self._selectedUuids.has(uuid) ? 'checked' : '';
                const rowBg = self._selectedUuids.has(uuid) ? 'background-color: var(--color-accent-subtle);' : '';

                htmlChunk += `
                    <tr class="asset-row" data-uuid="${uuid}" style="cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background-color 0.1s; ${rowBg}">
                        <td class="td-checkbox" style="padding: 12px 16px;"><input type="checkbox" class="row-checkbox" value="${uuid}" ${isChecked}></td>
                        <td style="padding: 12px 16px; font-size: 13px; color: var(--color-text-muted);">${i + 1}</td>
                        <td style="padding: 12px 16px; font-size: 13px;">${row["Тип"] || '—'}</td>
                        <td style="padding: 12px 16px; font-size: 13px; font-weight: 500;">${row["Найменування"] || '—'}</td>
                        <td style="padding: 12px 16px; font-size: 13px; font-family: monospace;">${row["Інв. / Номенкл. №"] || '—'}</td>
                        <td style="padding: 12px 16px; font-size: 13px;">${row["Одиниця виміру"] || 'шт'}</td>
                        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600;">${row["Кількість (факт)"] || 0}</td>
                        <td style="padding: 12px 16px; font-size: 13px;">${row["Об'єкт"] || '—'}</td>
                    </tr>
                `;
            }

            tbody.insertAdjacentHTML('beforeend', htmlChunk);
            currentIndex = end;

            if (currentIndex < totalRows) {
                // Якщо є ще рядки — малюємо їх у наступному кадрі
                self._renderAnimationId = requestAnimationFrame(renderChunk);
            } else {
                // Рендер завершено
                overlay.style.display = 'none';
            }
        }

        // Запускаємо першу порцію
        this._renderAnimationId = requestAnimationFrame(renderChunk);
    },

    bindEvents: function () {
        const self = this;

        if (window.EventBus) {
            window.EventBus.on('filters:changed', function (filters) {
                self.applyFilters(filters);
            });

            window.EventBus.on('table:refresh-required', function () {
                if (window.FilterPanel) window.FilterPanel.buildDynamicDirectories();
                self.renderRowsProgressive();
            });
        }

        // Обробка масового виділення (Select All)
        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', function (e) {
                const isChecked = e.target.checked;
                if (isChecked) {
                    self._filteredData.forEach(row => self._selectedUuids.add(row["UUID"]));
                } else {
                    self._selectedUuids.clear();
                }
                self.renderRowsProgressive();
                self.notifySelection();
            });
        }
    },

    /**
     * ДЕЛЕГУВАННЯ ПОДІЙ (Event Delegation)
     * Один єдиний слухач для всіх 800+ рядків та чекбоксів!
     */
    bindTableDelegation: function () {
        const tbody = document.getElementById('table-body');
        const self = this;

        tbody.addEventListener('click', function (e) {
            const tr = e.target.closest('.asset-row');
            if (!tr) return;

            const uuid = tr.dataset.uuid;

            // Якщо клік був по чекбоксу
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

            // Якщо клік був по самій комірці чекбокса (але не по квадратику)
            if (e.target.closest('.td-checkbox')) {
                const checkbox = tr.querySelector('.row-checkbox');
                checkbox.checked = !checkbox.checked;
                // Запускаємо подію вручну
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }

            // Якщо клік був по рядку (відкриття модалки)
            const match = self._data.find(a => a["UUID"] === uuid);
            if (match && match["Найменування"]) {
                window.EventBus.emit('asset:open-grouped-modal', {
                    name: match["Найменування"]
                });
            }
        });

        // Слухаємо 'change', який ми могли викликати вище
        tbody.addEventListener('change', function (e) {
            if (e.target.classList.contains('row-checkbox')) {
                const tr = e.target.closest('.asset-row');
                const uuid = tr.dataset.uuid;
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

        // Скидаємо чекбокс Select All
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;

        const q = filters.searchQuery.toLowerCase();

        this._filteredData = this._data.filter(row => {
            const matchSearch = q === '' ||
                (row["Найменування"] && row["Найменування"].toLowerCase().includes(q)) ||
                (row["Інв. / Номенкл. №"] && String(row["Інв. / Номенкл. №"]).toLowerCase().includes(q));

            const matchMvo = filters.mvo === 'all' || row["МВО (Прізвище)"] === filters.mvo;
            const matchObject = filters.object === 'all' || row["Об'єкт"] === filters.object;

            return matchSearch && matchMvo && matchObject;
        });

        this.renderRowsProgressive();
    },

    notifySelection: function () {
        const uuids = Array.from(this._selectedUuids);
        if (window.EventBus) {
            window.EventBus.emit('assets:selected', {
                uuids: uuids,
                count: uuids.length
            });
        }
    }
};

window.AssetTable = AssetTable;