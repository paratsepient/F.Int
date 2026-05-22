/**
 * F.Int — Компонент головної таблиці майна (Asset Table Component)
 * Реалізує повноекранне відображення, сувору автентичну фільтрацію,
 * розрахунок домінантних локацій та інтелектуальну диспетчеризацію підпозицій.
 */

const AssetTable = {
    // Вхідний масив плоских (атомарних) рядків з унікальними UUID, отриманий з Excel
    _data: [],
    // Масив рядків, які пройшли поточні системні фільтри
    _filteredData: [],
    // Кінцевий агрегований масив, що виводиться безпосередньо на екран користувача
    _filteredGroupedData: [],
    // Прапорець аварійного стану відсутності файлу бази в каталозі info
    _isFileNotFound: false,

    // СУВОРЕ КРИТИЧНЕ ВИПРАВЛЕННЯ: Масив колонок жорстко зафіксовано.
    // Жодні зовнішні чи додані поля не зможуть порушити геометрію головного списку.
    DISPLAY_COLUMNS: [
        { key: "Найменування", width: "max-width: 280px;" },
        { key: "Інв. / Номенкл. №", width: "max-width: 140px;" },
        { key: "Тип майна", width: "max-width: 150px;" },
        { key: "Одиниця виміру", width: "max-width: 90px;" },
        { key: "Кількість (факт)", width: "max-width: 90px;" },
        { key: "МВО (Прізвище)", width: "max-width: 160px;" },
        { key: "Об'єкт", width: "max-width: 180px;" }
    ],

    /**
     * Первинний запуск та монтування вузлів компонента таблиці
     */
    init: function () {
        console.log("[AssetTable] Запуск системи генерації головного списку ТМЦ...");
        this.renderStructure();
        this.bindTableDelegation();
        this.loadData();
    },

    /**
     * Рендеринг базової HTML-оболонки таблиці з фіксованим липким заголовком (Sticky Header)
     */
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

    /**
     * Асинхронне завантаження плоского реєстру активів через міст API
     */
    loadData: async function () {
        try {
            const data = await window.ApiBridge.getAssets();

            // Перевірка наявності тригера відсутності файлу
            if (data && data.length === 1 && data[0]["__SYSTEM_STATUS__"] === "FILE_NOT_FOUND") {
                this._isFileNotFound = true;
                this._data = [];
            } else {
                this._isFileNotFound = false;
                this._data = data || [];
            }

            this._filteredData = this._data;

            // Синхронізуємо довідники панелі фільтрації та пулу глобального автокомпліту
            if (!this._isFileNotFound && window.FilterPanel && typeof window.FilterPanel.buildDynamicDirectories === 'function') {
                window.FilterPanel.buildDynamicDirectories();
            } else {
                this.renderRowsProgressive();
            }

            // Оновлюємо відображення відповідно до встановлених селектів пошуку
            if (window.FilterPanel && window.FilterPanel._filters) {
                this.applyFilters(window.FilterPanel._filters);
            }

        } catch (err) {
            console.error("[AssetTable] Помилка завантаження плоских даних:", err);
        }
    },

    /**
     * Генерація заголовків стовпців. Першим завжди йде статичний маркер №
     */
    renderDynamicHeader: function () {
        const theadRow = document.getElementById('table-header-row');
        if (!theadRow) return;

        let headerHtml = `<th style="padding: 12px 16px; width: 45px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); font-weight: 700;">№</th>`;

        this.DISPLAY_COLUMNS.forEach(col => {
            headerHtml += `<th style="padding: 12px 16px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; ${col.width}">${col.key}</th>`;
        });

        theadRow.innerHTML = headerHtml;
    },

    /**
     * Рендеринг рядків таблиці майна або виведення стилізованої картки імпорту бази
     */
    renderRowsProgressive: function () {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        // Якщо файл Excel не знайдено в папці info — рендеримо інтерфейс підвантаження бази
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

        // Обробка порожнього результату пошуку/фільтрації
        if (this._filteredGroupedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 14px;">Майно за вказаними критеріями пошуку не знайдено.</td></tr>`;
            return;
        }

        this.renderDynamicHeader();

        let htmlChunk = '';
        this._filteredGroupedData.forEach((row, i) => {
            // Перевіряємо, чи має товар розбиття по різних локаціях/МВО
            const hasSplits = row._atomicRows && row._atomicRows.length > 1;

            // Якщо майно розподілене, додаємо інтерактивний синій індикатор кількості суб-позицій
            const splitIndicator = hasSplits
                ? ` <span style="background: #3b82f6; color: white; Cantaccessattribute: unknown; font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: bold; margin-left: 6px; display: inline-block; vertical-align: middle;">${row._atomicRows.length} розп.</span>`
                : '';

            htmlChunk += `<tr class="asset-row" data-index="${i}" style="cursor: pointer; border-bottom: 1px solid var(--color-border); transition: background-color 0.1s;">`;
            htmlChunk += ` King: code check; <td style="padding: 12px 16px; font-size: 13px; color: var(--color-text-muted); font-weight: 500;">${i + 1}</td>`;

            this.DISPLAY_COLUMNS.forEach(col => {
                let val = row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== "" ? row[col.key] : '—';

                // Якщо користувач приховав стовпець через налаштування структури, пропускаємо рендер осередку
                if (window.FilterPanel && window.FilterPanel._hiddenColumns.has(col.key)) {
                    return;
                }

                let cellStyle = `padding: 12px 16px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--color-border); ${col.width}`;

                if (col.key === 'Найменування') {
                    cellStyle += ' font-weight: 500; color: var(--color-text-main);';
                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}${splitIndicator}</td>`;
                } else {
                    if (col.key === 'Кількість (факт)') cellStyle += ' font-weight: 600; color: var(--color-accent);';
                    htmlChunk += `<td style="${cellStyle}" title="${val}">${val}</td>`;
                }
            });
            htmlChunk += `</tr>`;
        });

        tbody.innerHTML = htmlChunk;
    },

    /**
     * Скрізна фільтрація та динамічна агрегація плоских даних на основі домінантного об'єкта
     */
    applyFilters: function (filters) {
        if (this._isFileNotFound) return;

        const q = (filters.searchQuery || '').toLowerCase();

        // Етап 1: Первинне точне відсікання на рівні АТОМАРНИХ рядків Excel
        this._filteredData = this._data.filter(row => {
            const matchSearch = q === '' || Object.keys(row).some(key =>
                key !== 'UUID' && row[key] && String(row[key]).toLowerCase().includes(q)
            );

            const matchType = filters.type === 'all' || row["Тип майна"] === filters.type || row["Тип"] === filters.type;
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

        // Етап 2: Динамічне угруповання відфільтрованих позицій за назвою 'Найменування'
        const groups = {};
        this._filteredData.forEach(row => {
            const name = row["Найменування"] || "—";
            if (!groups[name]) groups[name] = [];
            groups[name].push(row);
        });

        // Етап 3: Інтелектуальний розрахунок параметрів згрупованого рядка (Домінантний об'єкт)
        this._filteredGroupedData = Object.keys(groups).map(name => {
            const rows = groups[name];

            // Розрахунок сумарної кількості одиниць майна
            const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r["Кількість (факт)"]) || 0), 0);

            // КРИТИЧНИЙ АЛГОРИТМ: Пошук об'єкта, на якому зафіксовано найбільшу кількість одиниць майна
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

            // Формування інформаційного маркера МВО
            const distinctMvos = [...new Set(rows.map(r => r["МВО (Прізвище)"]).filter(Boolean))];
            const mvoDisplay = distinctMvos.length === 1 ? distinctMvos[0] : (distinctMvos.length > 1 ? `👥 Декілька МВО (${distinctMvos.length})` : "—");

            // Формування інформаційного маркера Інвентарних номерів
            const distinctInvs = [...new Set(rows.map(r => r["Інв. / Номенкл. №"]).filter(Boolean))];
            const invDisplay = distinctInvs.length === 1 ? distinctInvs[0] : (distinctInvs.length > 1 ? "📋 Різні номери" : "—");

            return {
                ...rows[0],
                "Найменування": name,
                "Кількість (факт)": totalQty,
                "Об'єкт": dominantObject,
                "МВО (Прізвище)": mvoDisplay,
                "Інв. / Номенкл. №": invDisplay,
                "_atomicRows": rows // Зберігаємо посилання на масив для SubPositionsModal розбиття
            };
        });

        // Надсилаємо актуальну кількість згрупованих карток у шину подій для лічильника
        if (window.EventBus) {
            window.EventBus.emit('filters:count-updated', this._filteredGroupedData.length);
        }

        this.renderRowsProgressive();
    },

    /**
     * Обробка кліків: Якщо позиція одна — запускається EditModal, якщо декілька — проміжне вікно розподілу
     */
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

            // Розумна диспетчеризація:
            if (atomicRows.length <= 1) {
                // Одна атомарна позиція — відкриваємо її відразу у класичному EditModal
                if (window.EditModal) window.EditModal.open(atomicRows[0] || groupedItem);
            } else {
                // Позиція розбита по різних об'єктах/МВО — викликаємо картки розподілу
                if (window.SubPositionsModal) {
                    window.SubPositionsModal.open(groupedItem["Найменування"], atomicRows);
                }
            }
        });
    }
};

window.AssetTable = AssetTable;