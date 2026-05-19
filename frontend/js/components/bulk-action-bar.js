/**
 * Модуль плаваючої панелі масових дій F.Int (Фаза 4)
 * Керує відображенням кнопок, модальними підтвердженнями та викликами API.
 */

// Локальний стан вибраних ідентифікаторів у поточному сеансі
let _currentUUIDs = [];

// DOM-елементи панелі (ініціалізуються при першому рендерингу)
let barEl = null;
let countLabel = null;
let spinner = null;
let btnMove = null;
let btnWriteOff = null;
let btnExport = null;
let btnReset = null;

/**
 * Автоматична ініціалізація та побудова структури панелі в DOM
 */
function initBulkActionBar() {
    if (document.getElementById('bulk-action-bar')) return;

    // Створення кореневого контейнера панелі
    barEl = document.createElement('div');
    barEl.id = 'bulk-action-bar';
    barEl.className = 'bulk-action-bar';

    // Створення лічильника вибраних елементів
    countLabel = document.createElement('div');
    countLabel.className = 'bulk-action-bar__info';
    barEl.appendChild(countLabel);

    // Створення контейнера для кнопок дій
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'bulk-action-bar__actions';

    // Індикатор завантаження (Spinner)
    spinner = document.createElement('div');
    spinner.className = 'bulk-spinner';
    actionsContainer.appendChild(spinner);

    // Кнопка [Перемістити]
    btnMove = document.createElement('button');
    btnMove.className = 'btn-bulk btn-bulk--move';
    btnMove.textContent = 'Перемістити';
    btnMove.addEventListener('click', handleMove);
    actionsContainer.appendChild(btnMove);

    // Кнопка [Списати]
    btnWriteOff = document.createElement('button');
    btnWriteOff.className = 'btn-bulk btn-bulk--write-off';
    btnWriteOff.textContent = 'Списати';
    btnWriteOff.addEventListener('click', handleWriteOff);
    actionsContainer.appendChild(btnWriteOff);

    // Кнопка [Експорт PDF]
    btnExport = document.createElement('button');
    btnExport.className = 'btn-bulk btn-bulk--export';
    btnExport.textContent = 'PDF';
    btnExport.addEventListener('click', handleExport);
    actionsContainer.appendChild(btnExport);

    // Кнопка [Скинути]
    btnReset = document.createElement('button');
    btnReset.className = 'btn-bulk btn-bulk--reset';
    btnReset.textContent = 'Скинути';
    btnReset.addEventListener('click', () => {
        // Очищення виділення ініціює ланцюг подій через AssetTable
        if (window.clearSelection) window.clearSelection();
    });
    actionsContainer.appendChild(btnReset);

    barEl.appendChild(actionsContainer);
    document.body.appendChild(barEl);
}

/**
 * Підписка на події виділення чекбоксів таблиці через EventBus
 */
EventBus.on('assets:selected', ({ uuids, count }) => {
    // Гарантуємо наявність панелі в DOM дереві
    if (!barEl) initBulkActionBar();

    if (count === 0) {
        barEl.style.display = 'none'; // Повне приховування при нульовому лічильнику
        _currentUUIDs = [];
        return;
    }

    _currentUUIDs = uuids;

    // Формування динамічного тексту з відмінюванням слів (Пункт 14 Чек-листа)
    const textWord = pluralize(count, 'позиція', 'позиції', 'позицій');
    countLabel.textContent = `Вибрано: ${count} ${textWord}`;

    barEl.style.display = 'flex'; // Відображення панелі
});

/**
 * Обробник масового переміщення об'єктів
 */
async function handleMove() {
    // 1. Запит цільового МВО та Об'єкту (Phase E)
    const target = await openMoveDialog();
    if (!target) return; // Скасовано користувачем

    // 2. Обов'язкове модальне підтвердження операції (Пункт 12.1)
    const confirmed = await openConfirmDialog({
        title: 'Підтвердити переміщення',
        message: `Буде переміщено ${_currentUUIDs.length} позицій до МВО "${target.new_mvo}".`,
        mode: 'Впровадити'
    });
    if (!confirmed) return;

    setLoading(true);

    try {
        // Виклик уніфікованого API-моста
        const result = await Api.bulkAction({
            uuids: _currentUUIDs,
            actionType: 'move',
            mode: 'commit',
            payload: target
        });
        handleResult(result, 'переміщено');
    } catch (err) {
        showToast(`Помилка: ${err.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Обробник масового списання активів (Деструктивна операція)
 */
async function handleWriteOff() {
    // 1. Запит причин та дати акту списання
    const details = await openWriteOffDialog();
    if (!details) return;

    // 2. Посилене підтвердження небезпечної дії (danger: true)
    const confirmed = await openConfirmDialog({
        title: 'Підтвердити списання',
        message: `Буде списано ${_currentUUIDs.length} позицій. Причина: ${details.reason}`,
        mode: 'Впровадити',
        danger: true
    });
    if (!confirmed) return;

    setLoading(true);

    try {
        const result = await Api.bulkAction({
            uuids: _currentUUIDs,
            actionType: 'write_off',
            mode: 'commit',
            payload: details
        });
        handleResult(result, 'списано');
    } catch (err) {
        showToast(`Помилка: ${err.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Обробник операції експорту виділеного набору у PDF
 */
async function handleExport() {
    setLoading(true);
    try {
        const result = await Api.bulkAction({
            uuids: _currentUUIDs,
            actionType: 'export',
            mode: 'export',
            payload: { format: 'pdf' }
        });
        showToast(`Файл збережено: ${result.doc_path}`, 'success');
        // База даних не зазнала змін, bulk:completed не викликається (Пункт 11)
    } catch (err) {
        showToast(`Помилка експорту: ${err.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Обробка та інтерпретація результату відповіді бекенду
 * @param {Object} result - Структура відповіді {success, processed, failed, doc_path}
 * @param {string} verb - Дієслово для відображення в інтерфейсі (списано/переміщено)
 */
function handleResult(result, verb) {
    const ok = result.processed.length;
    const fail = result.failed.length;

    if (fail === 0) {
        const word = pluralize(ok, 'позицію', 'позиції', 'позицій');
        showToast(`${ok} ${word} успішно ${verb}`, 'success');
    } else {
        // Частковий успіх пакетної транзакції (Пункт 12.7)
        showToast(`${ok} оброблено, для ${fail} виникла помилка. Деталі в консолі.`, 'warn');
        console.warn('Bulk failed UUIDs:', result.failed);
    }

    // Сповіщення системи про завершення для оновлення asset-table.js
    EventBus.emit('bulk:completed', result);
}

/**
 * Керування станом блокування інтерфейсу користувача (UI) під час обробки
 * @param {boolean} isLoading - Прапор стану завантаження
 */
function setLoading(isLoading) {
    const buttons = [btnMove, btnWriteOff, btnExport, btnReset];
    buttons.forEach(btn => { if (btn) btn.disabled = isLoading; });

    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (countLabel && isLoading) {
        countLabel.textContent = `Обробка: ${_currentUUIDs.length} позицій...`;
    }
}

/**
 * Правила відмінювання іменників для української локалізації
 */
function pluralize(n, one, few, many) {
    if (n % 10 === 1 && n % 100 !== 11) return one;
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few;
    return many;
}

/* ==========================================================================
   Утилітарні інтерфейсні заглушки (Підлягають заміні на реальні Modals у Phase E)
   ========================================================================== */

async function openMoveDialog() {
    // Тимчасова реалізація діалогу вибору
    const mvo = prompt("Введіть ПІБ нового МВО:");
    if (!mvo) return null;
    const obj = prompt("Введіть назву Об'єкту (Кімнати):");
    return { new_mvo: mvo, new_object: obj };
}

async function openWriteOffDialog() {
    const reason = prompt("Вкажіть причину списання:");
    if (!reason) return null;
    return { reason: reason, date: new Date().toISOString().split('T')[0] };
}

async function openConfirmDialog({ title, message, danger }) {
    return confirm(`[${title}]\n\n${message}\n\nПродовжити операцію?`);
}

function showToast(message, type = 'info') {
    alert(`[TOAST - ${type.toUpperCase()}] ${message}`);
}