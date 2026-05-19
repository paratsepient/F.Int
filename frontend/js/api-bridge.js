/**
 * Модуль інтеграційного мосту між Frontend (Vanilla JS) та Backend (Python/pywebview)
 * Забезпечує дефенсивну валідацію параметрів перед відправкою через IPC-протокол.
 */

// Ініціалізація або розширення існуючого глобального об'єкта Api
window.Api = window.Api || {};

/**
 * Пакетна відправка масових операцій на бекенд
 * @param {Object} params - Параметри запиту
 * @param {string[]} params.uuids - Масив унікальних ідентифікаторів позицій
 * @param {string} params.actionType - Тип масової операції ('move' | 'write_off' | 'export')
 * @param {string} params.mode - Режим документа ('export' | 'save' | 'commit')
 * @param {Object} params.payload - Додаткові специфічні дані операції
 * @returns {Promise<Object>} Очікувана відповідь бекенду {success, processed, failed, doc_path}
 */
window.Api.bulkAction = async function ({ uuids, actionType, mode, payload }) {

    // 1. Захист від порожнього або некоректного виклику на рівні клієнта (Пункт 8 / 12.1)
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        throw new Error('Не вибрано жодної позиції для виконання масової операції'); // [cite: 51]
    }

    // 2. Строга валідація типу операції згідно зі специфікацією V1 (Пункт 2 / 8)
    const allowedActions = ['move', 'write_off', 'export'];
    if (!allowedActions.includes(actionType)) {
        throw new Error(`Невідомий тип операції: ${actionType}`); // [cite: 52]
    }

    // 3. Строга валідація сумісності режимів обробки документів (Пункт 11)
    const allowedModes = ['export', 'save', 'commit'];
    if (!allowedModes.includes(mode)) {
        throw new Error(`Невідомий режим обробки документа: ${mode}`); // [cite: 53]
    }

    // 4. Безпечна перевірка наявності глобального об'єкта pywebview (рантайм середовища програми)
    if (typeof pywebview === 'undefined' || !pywebview.api || typeof pywebview.api.bulk_action !== 'function') {
        console.error('[API Bridge] Контекст pywebview відсутній. Емуляція відповіді для Dev-середовища.');
        return simulateBackendResponse(uuids, actionType, mode, payload);
    }

    // 5. Маршрутизація у мікропроцесорний міст pywebview API (Пункт 8)
    return pywebview.api.bulk_action(uuids, actionType, mode, payload); // [cite: 54]
};

/**
 * Емулятор бекенд-відповіді для автономного тестування інтерфейсу у звичайному браузері
 */
function simulateBackendResponse(uuids, actionType, mode, payload) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Частина UUID (наприклад, кожен п'ятий) емулюється як помилка для перевірки стійкості UI
            const failed = uuids.filter((_, index) => index % 5 === 4);
            const processed = uuids.filter((_, index) => index % 5 !== 4);

            resolve({
                success: true,
                processed: processed,
                failed: failed,
                doc_path: mode !== 'export' ? `C:/F.Int/Archive/act_${actionType}_2026.xlsx` : `C:/Users/Downloads/export_${Date.now()}.pdf`
            });
        }, 1200); // Штучна затримка для візуалізації роботи Spinner
    });
}