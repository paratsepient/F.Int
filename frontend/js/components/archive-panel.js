/**
 * F.Int — Компонент вкладки Облік+ (Archive & Backup Panel)
 * Керує відображенням архіву згенерованих документів та логами резервного копіювання.
 * Оптимізовано під специфікацію APP MAP v1.1 та tokens.css з повною сумісністю.
 */

const ArchivePanel = {
    // Внутрішній стан компонента
    _archivedDocuments: [],
    _backupLogs: [],

    /**
     * Точка входу, що викликається SPA-маршрутизатором (app.js) при переході на вкладку
     */
    init: function () {
        console.log("[ArchivePanel] Ініціалізація компонента Облік+...");

        // Очищуємо локальні масиви та підписуємося на події
        this.registerEvents();

        // Завантажуємо дані з бекенду
        this.fetchArchiveData();
    },

    /**
     * Підписка на системні події через шину EventBus
     */
    registerEvents: function () {
        const self = this;
        if (window.EventBus) {
            // Якщо у вкладці "Документи" було створено новий акт — оновлюємо список
            window.EventBus.on('archive:updated', function () {
                self.fetchArchiveData();
            });

            // Слухаємо тригери створення нових бекапів системою
            window.EventBus.on('backup:created', function (data) {
                console.log("[ArchivePanel] Отримано сповіщення про новий бекап:", data);
                self.fetchArchiveData();
            });
        }
    },

    /**
     * Асинхронний запит до бекенду для отримання списку файлів та логів бекапів
     */
    fetchArchiveData: function () {
        const self = this;

        // Емуляція зчитування каталогу Archive/ та папки Backups/ 
        setTimeout(function () {
            self._archivedDocuments = [
                { id: "doc_001", filename: "Акт_приймання_передачі_2026-05-10.xlsx", type: "act_transfer", size: "24 КБ", date: "10.05.2026 14:22" },
                { id: "doc_002", filename: "Відомість_списання_склад_№2.xlsx", type: "act_write_off", size: "18 КБ", date: "14.05.2026 09:11" },
                { id: "doc_003", filename: "Інвентаризаційний_опис_Офіс_302.xlsx", type: "inventory_inv", size: "32 КБ", date: "19.05.2026 11:45" }
            ];

            self._backupLogs = [
                { timestamp: "19.05.2026 10:27", file: "F.Int_backup_2026-05-19_10-27.xlsx", status: "success" },
                { timestamp: "19.05.2026 10:11", file: "F.Int_backup_2026-05-19_10-11.xlsx", status: "success" },
                { timestamp: "19.05.2026 09:52", file: "F.Int_backup_2026-05-19_09-52.xlsx", status: "success" }
            ];

            self.render();
        }, 300);
    },

    /**
     * Генерація HTML структури та впровадження у робочу зону #view-container
     */
    render: function () {
        const placeholder = document.getElementById('view-container');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div class="archive-panel-container" style="display: flex; flex-direction: column; gap: 24px; height: 100%;">
                
                <div class="view-header">
                    <h1>➕ Облік+</h1>
                    <p class="text-muted" style="margin-top: 4px; color: var(--color-text-muted);">Центр управління архівом офіційних документів та точками відновлення бази даних</p>
                </div>

                <div class="archive-grid" style="display: flex; gap: 24px; flex: 1; align-items: stretch;">
                    
                    <section class="archive-section" style="flex: 1; background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column;">
                        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                            📁 Реєстр згенерованих актів і відомостей
                        </h3>
                        
                        <div class="documents-list-wrapper" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                            ${this.buildDocumentsListMarkup()}
                        </div>
                    </section>

                    <section class="backup-section" style="width: 360px; background-color: var(--color-bg-sidebar); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; display: flex; flex-direction: column; flex-shrink: 0;">
                        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">
                            🛡️ Система безпеки та бекапів
                        </h3>
                        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px;">Автоматичне дефенсивне копіювання перед кожною важливою транзакцією</p>
                        
                        <button id="btn-trigger-backup" class="btn-save-close" style="width: 100%; margin-bottom: 20px; background-color: rgba(212, 175, 55, 0.15); border-color: var(--color-accent); color: var(--color-text-main);">
                            🔄 Створити точку копіювання зараз
                        </button>

                        <h4 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 10px;">
                            Історія точок відновлення (.xlsx)
                        </h4>
                        
                        <div class="backups-log-wrapper" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                            ${this.buildBackupLogsMarkup()}
                        </div>
                    </section>

                </div>
            </div>
        `;

        this.bindEvents();
    },

    /**
     * Побудова списку заархівованих файлів
     */
    buildDocumentsListMarkup: function () {
        if (this._archivedDocuments.length === 0) {
            return `<div style="color: var(--color-text-muted); font-size: 13px; font-style: italic; text-align: center; margin-top: 40px;">Архів порожній. Згенеруйте свій перший документ у вкладці "Документи".</div>`;
        }

        let html = '';
        this._archivedDocuments.forEach(function (doc) {
            let icon = '📊';
            if (doc.type === 'act_transfer') icon = '📝';
            if (doc.type === 'act_write_off') icon = '🗑️';

            html += `
                <div class="archive-item" data-id="${doc.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background-color: var(--color-bg-main); border: 1px solid var(--color-border); border-radius: 6px; transition: border-color 0.15s;">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <span style="font-size: 20px;">${icon}</span>
                        <div style="min-width: 0;">
                            <p style="font-size: 14px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${doc.filename}</p>
                            <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">Створено: ${doc.date} • Розмір: ${doc.size}</p>
                        </div>
                    </div>
                    <button class="btn-download-doc" data-id="${doc.id}" style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-main); padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; transition: all 0.15s;">
                        👁️ Відкрити
                    </button>
                </div>
            `;
        });
        return html;
    },

    /**
     * Побудова списку логів резервного копіювання
     */
    buildBackupLogsMarkup: function () {
        if (this._backupLogs.length === 0) {
            return `<div style="color: var(--color-text-muted); font-size: 12px; text-align: center; margin-top: 20px;">Журнал резервного копіювання порожній.</div>`;
        }

        let html = '';
        this._backupLogs.forEach(function (log) {
            html += `
                <div style="display: flex; flex-direction: column; gap: 4px; padding: 10px; background-color: var(--color-bg-main); border: 1px solid var(--color-border); border-radius: 6px; border-left: 3px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: #10b981;">✓ Авто-бекап виконано</span>
                        <span style="font-size: 10px; color: var(--color-text-muted);">${log.timestamp}</span>
                    </div>
                    <p style="font-size: 12px; font-family: monospace; color: var(--color-text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${log.file}">
                        ${log.file}
                    </p>
                </div>
            `;
        });
        return html;
    },

    /**
     * Навішування слухачів кліків на елементи керування вкладки
     */
    bindEvents: function () {
        const self = this;
        const container = document.getElementById('view-container');
        if (!container) return;

        // 1. Кліки по кнопках «Відкрити файл»
        container.querySelectorAll('.btn-download-doc').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                const docId = e.target.dataset.id;
                self.handleOpenDocument(docId);
            });
        });

        // 2. Кнопка ручного створення точки копіювання бази
        const btnTriggerBackup = container.querySelector('#btn-trigger-backup');
        if (btnTriggerBackup) {
            btnTriggerBackup.addEventListener('click', function () {
                self.handleManualBackup(btnTriggerBackup);
            });
        }
    },

    /**
     * Запуск нативного відкриття файлу Excel операційною системую
     */
    handleOpenDocument: function (docId) {
        console.log(`[ArchivePanel] Спроба відкрити документ ID: ${docId}`);
        const found = this._archivedDocuments.find(function (d) { return d.id === docId; });
        if (found) {
            alert(`Запит на відкриття файлу через ОС:\nArchive/${found.filename}`);
        }
    },

    /**
     * Створення примусового резервного копіювання Excel
     */
    handleManualBackup: function (buttonElement) {
        console.log('[ArchivePanel] Ініційовано ручний дефенсивний бекап бази...');
        const self = this;

        buttonElement.disabled = true; // Виправлено: з маленької літери 'true'
        buttonElement.textContent = '🔒 Фіксація бази даних...';

        // Емуляція виклику сервісу резервного копіювання
        setTimeout(function () {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '🔄 Створити точку копіювання зараз';
            alert('✓ Стан бази даних Excel успішно зафіксовано в каталозі Backups/.');

            self.fetchArchiveData(); // Перезавантажити списки
        }, 800);
    }
};

// Експортуємо у глобальну область видимості Chromium
window.ArchivePanel = ArchivePanel;