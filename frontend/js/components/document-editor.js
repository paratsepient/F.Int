/**
 * F.Int — Компонент вкладки Документи (Document Editor)
 * Керує генерацією документів, вибором шаблонів та збереженням чернеток.
 * Оптимізовано під специфікацію APP MAP v1.1 та tokens.css з повною сумісністю.
 */

const DocumentEditor = {
    // Поточний стан редактора документів
    state: {
        selectedTemplate: 'act_transfer', // 'act_transfer' | 'inventory_inv' | 'act_write_off'
        documentMode: 'draft',            // 'draft' | 'save' | 'commit'
        title: '',
        content: '',
        attachedAssetUuids: []
    },

    /**
     * Ініціалізація компонента. Реєструє глобальні слухачі подій.
     */
    init: function () {
        console.log("[DocumentEditor] Ініціалізація компонента генератора документів...");
        const self = this;

        // Слухаємо подію від таблиці активів, якщо користувач виділив позиції і перейшов створювати документ
        if (window.EventBus) {
            window.EventBus.on('assets:selected', function (data) {
                self.state.attachedAssetUuids = data.uuids || [];
                console.log(`[DocumentEditor] До нового документа прив'язано масовий вибір: ${self.state.attachedAssetUuids.length} шт.`);
            });
        }
    },

    /**
     * Головний метод рендерингу, який викликається SPA-маршрутизатором (app.js)
     */
    render: function () {
        // Оновлюємо заголовок за замовчуванням залежно від обраного шаблону
        this.updateDefaultTitle();

        const placeholder = document.getElementById('view-container');
        if (!placeholder) return;

        placeholder.innerHTML = `
            <div class="document-editor-container">
                <div class="view-header">
                    <div class="header-title-zone">
                        <h1>📁 Документи</h1>
                        <p class="text-muted" style="margin-top: 4px; color: var(--color-text-muted);">Формування офіційних актів та відомостей на основі бази майна</p>
                    </div>
                </div>

                <div class="document-grid">
                    <aside class="doc-config-sidebar">
                        <div class="config-card">
                            <h3>1. Оберіть шаблон</h3>
                            <div class="template-selector">
                                <label class="template-option ${this.state.selectedTemplate === 'act_transfer' ? 'active' : ''}">
                                    <input type="radio" name="doc_template" value="act_transfer" ${this.state.selectedTemplate === 'act_transfer' ? 'checked' : ''}>
                                    <div class="opt-meta">
                                        <span class="opt-icon">📝</span>
                                        <div>
                                            <h4>Акт приймання-передачі</h4>
                                            <p>Зміна МВО або переміщення між об'єктами</p>
                                        </div>
                                    </div>
                                </label>

                                <label class="template-option ${this.state.selectedTemplate === 'inventory_inv' ? 'active' : ''}">
                                    <input type="radio" name="doc_template" value="inventory_inv" ${this.state.selectedTemplate === 'inventory_inv' ? 'checked' : ''}>
                                    <div class="opt-meta">
                                        <span class="opt-icon">📋</span>
                                        <div>
                                            <h4>Інвентаризаційний опис</h4>
                                            <p>Звірка фактичної наявності по об'єкту</p>
                                        </div>
                                    </div>
                                </label>

                                <label class="template-option ${this.state.selectedTemplate === 'act_write_off' ? 'active' : ''}">
                                    <input type="radio" name="doc_template" value="act_write_off" ${this.state.selectedTemplate === 'act_write_off' ? 'checked' : ''}>
                                    <div class="opt-meta">
                                        <span class="opt-icon">🗑️</span>
                                        <div>
                                            <h4>Акт на списання майна</h4>
                                            <p>Вибуття активів з балансу організації</p>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="config-card attached-info">
                            <h3>2. Склад документа</h3>
                            <div class="attached-status">
                                <span class="attach-count-icon">🔗</span>
                                <div>
                                    <p class="attach-title">Прив'язано позицій майна</p>
                                    <p class="attach-count-value" style="font-weight: 700; color: var(--color-accent);">${this.state.attachedAssetUuids.length} позицій</p>
                                </div>
                            </div>
                            ${this.state.attachedAssetUuids.length === 0 ?
                `<p class="attach-warning" style="font-size: 11px; color: #f59e0b; line-height: 1.4; margin-top: 4px;">⚠️ Ви не виділили рядки в таблиці. Документ створиться порожнім або для всієї бази.</p>` :
                `<p class="attach-success" style="font-size: 11px; color: #10b981; font-weight: 500; margin-top: 4px;">✓ Рядки завантажено з таблиці обліку успішно.</p>`
            }
                        </div>
                    </aside>

                    <section class="doc-editor-workspace">
                        <div class="editor-paper">
                            <div class="field-group">
                                <label>Назва документа (Збережеться в архів)</label>
                                <input type="text" id="doc-title-input" class="doc-title-input" value="${this.state.title}" placeholder="Введіть назву документа...">
                            </div>

                            <div class="field-group flex-grow" style="display: flex; flex-direction: column; flex: 1; margin-top: 12px;">
                                <label>Текстовий зміст / Супровідні примітки</label>
                                <textarea id="doc-content-textarea" class="doc-content-textarea" style="flex: 1; min-height: 200px;" placeholder="Текст документа або автоматично згенеровані таблиці з'являться тут...">${this.state.content}</textarea>
                            </div>

                            <div class="editor-footer-buttons">
                                <button id="btn-save-draft" class="btn-save-close" style="width: auto; padding: 10px 20px; border-color: var(--color-border);">💾 Зберегти чернетку</button>
                                <button id="btn-export-excel" class="btn-save-close" style="width: auto; padding: 10px 20px; background-color: rgba(212, 175, 55, 0.15); border-color: var(--color-accent); color: var(--color-text-main);">📊 Згенерувати Excel</button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    /**
     * Навішує локальні обробники подій після впровадження HTML в DOM.
     */
    bindEvents: function () {
        const self = this;
        const container = document.getElementById('view-container');
        if (!container) return;

        // 1. Зміна шаблону (Radio inputs)
        container.querySelectorAll('input[name="doc_template"]').forEach(function (radio) {
            radio.addEventListener('change', function (e) {
                self.state.selectedTemplate = e.target.value;
                self.updateDefaultTitle();
                self.render(); // миттєвий локальний перерендер інтерфейсу
            });
        });

        // 2. Синхронізація вводу назви
        const titleInput = container.querySelector('#doc-title-input');
        if (titleInput) {
            titleInput.addEventListener('input', function (e) {
                self.state.title = e.target.value;
            });
        }

        // 3. Синхронізація тексту
        const contentTextarea = container.querySelector('#doc-content-textarea');
        if (contentTextarea) {
            contentTextarea.addEventListener('input', function (e) {
                self.state.content = e.target.value;
            });
        }

        // 4. Кнопка «Зберегти чернетку»
        const btnSaveDraft = container.querySelector('#btn-save-draft');
        if (btnSaveDraft) {
            btnSaveDraft.addEventListener('click', function () {
                self.handleSaveDraft();
            });
        }

        // 5. Кнопка «Згенерувати Excel-документ»
        const btnExportExcel = container.querySelector('#btn-export-excel');
        if (btnExportExcel) {
            btnExportExcel.addEventListener('click', function () {
                self.handleExportDocument();
            });
        }
    },

    /**
     * Автоматично підставляє назву документа, якщо користувач її ще не змінив
     */
    updateDefaultTitle: function () {
        if (this.state.title && !this.state.title.startsWith("Акт") && !this.state.title.startsWith("Інв")) {
            return;
        }

        const dateStr = new Date().toLocaleDateString('uk-UA');
        if (this.state.selectedTemplate === 'act_transfer') {
            this.state.title = `Акт приймання-передачі від ${dateStr}`;
        } else if (this.state.selectedTemplate === 'inventory_inv') {
            this.state.title = `Інвентаризаційний опис від ${dateStr}`;
        } else if (this.state.selectedTemplate === 'act_write_off') {
            this.state.title = `Акт на списання майна від ${dateStr}`;
        }
    },

    /**
     * Логіка збереження локальної чернетки документа на диск
     */
    handleSaveDraft: function () {
        console.log('[DocumentEditor] Збереження чернетки документа...');

        // Інтеграція з нашою уніфікованою структурою масових дій ApiBridge
        if (window.Api && typeof window.Api.bulkAction === 'function') {
            window.Api.bulkAction({
                uuids: this.state.attachedAssetUuids.length > 0 ? this.state.attachedAssetUuids : ["BASE_DRAFT"],
                actionType: this.state.selectedTemplate === 'act_write_off' ? 'write_off' : 'move',
                mode: 'save',
                payload: { title: this.state.title, content: this.state.content }
            }).then(function (res) {
                alert('✓ Чернетку документа успішно внесено до реєстру.');
            }).catch(function (err) {
                console.error(err);
            });
        } else {
            alert('Чернетку збережено локально в сесії інтерфейсу (Емуляція).');
        }
    },

    /**
     * Логіка генерації фінального Excel файлу документа в директорію Archive
     */
    handleExportDocument: function () {
        console.log('[DocumentEditor] Направлення запиту формування Excel відомості...');

        if (window.Api && typeof window.Api.bulkAction === 'function') {
            window.Api.bulkAction({
                uuids: this.state.attachedAssetUuids,
                actionType: this.state.selectedTemplate === 'act_write_off' ? 'write_off' : 'move',
                mode: 'commit',
                payload: { title: this.state.title, content: this.state.content }
            }).then(function (res) {
                alert(`⚡ Документ успішно сформовано на бекенді та збережено в Архів!`);
            }).catch(function (err) {
                alert(`Помилка генерації: ${err.message}`);
            });
        } else {
            alert('Генерація Excel запущена (Емуляція автономного фронтенду).');
        }
    }
};

// Реєструємо компонент у глобальному просторі імен для провідника SPA
window.DocumentEditor = DocumentEditor;