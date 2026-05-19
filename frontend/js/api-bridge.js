/**
 * F.Int — Інфраструктурний міст API (API Bridge)
 * Забезпечує попередню валідацію типів та трансляцію асинхронних викликів до Python layer.
 * Повністю адаптовано під специфікацію APP MAP v1.1 та технічний регламент Фази 4.
 */

const Api = {
    /**
     * Первинний запит на отримання всього майна з бази даних Excel
     * Повертає: Promise -> Array (масив об'єктів активів)
     */
    get_assets: function () {
        console.log('[ApiBridge] Запит масиву активів get_assets()...');

        // Перевіряємо наявність об'єкта pywebview, який впроваджує бекенд
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_assets === 'function') {
            return window.pywebview.api.get_assets();
        }

        // Емуляція дефолтних тестових даних на випадок автономного тестування фронтенду
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve([
                    { "UUID": "a1-b2-c3-d4", "Найменування": "Стіл офісний", "Інв. / Номенкл. №": "00-0123", "Кількість (факт)": 2, "Сума (балансова)": 4800, "МВО (Прізвище)": "Іваненко О.П.", "Об'єкт": "Кімната 101" },
                    { "UUID": "e5-f6-g7-h8", "Найменування": "Крісло ергономічне", "Інв. / Номенкл. №": "00-0124", "Кількість (факт)": 5, "Сума (балансова)": 3500, "МВО (Прізвище)": "Іваненко О.П.", "Об'єкт": "Кімната 101" },
                    { "UUID": "x9-y0-z1-w2", "Найменування": "Ноутбук Pro", "Інв. / Номенкл. №": "00-0567", "Кількість (факт)": 0, "Сума (балансова)": 45000, "МВО (Прізвище)": "Петренко В.С.", "Об'єкт": "Склад", "Відмітка про вибуття": "Фізичний знос (19.05.2026)" }
                ]);
            }, 500);
        });
    },

    /**
     * Єдина точка входу для виконання всіх масових операцій (Bulk Operations)
     * Аргументи:
     * - uuids: масив рядків UUID [cite: 387]
     * - actionType: "move" | "write_off" | "export" [cite: 387, 388]
     * - mode: "export" | "save" | "commit" [cite: 387]
     * - payload: конфігурація операції (new_mvo, reason тощо) [cite: 387, 388]
     */
    bulkAction: function (options) {
        console.log('[ApiBridge] Ініційовано bulkAction із параметрами:', options);

        // 1. Дефенсивна перевірка на порожній виклик (Захист клієнта)
        if (!options || !options.uuids || options.uuids.length === 0) { // cite: 384
            return Promise.reject(new Error('Не вибрано жодної позиції майна для обробки.')); // cite: 384
        }

        // 2. Сувора валідація дозволених типів масових операцій
        const allowedTypes = ['move', 'write_off', 'export']; // cite: 385
        if (!allowedTypes.includes(options.actionType)) { // cite: 385
            return Promise.reject(new Error(`Невідомий тип масової операції: ${options.actionType}`)); // cite: 385
        }

        // 3. Сувора валідація дозволених режимів впливу на базу
        const allowedModes = ['export', 'save', 'commit']; // cite: 385
        if (!allowedModes.includes(options.mode)) { // cite: 385
            return Promise.reject(new Error(`Невідомий режим транзакції: ${options.mode}`)); // cite: 385
        }

        // 4. Трансляція асинхронного виклику безпосередньо у віконне API pywebview
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.bulk_action === 'function') {
            return window.pywebview.api.bulk_action(options.uuids, options.actionType, options.mode, options.payload || {}); // cite: 386
        }

        // Емуляція відповіді сервера для ізольованого тестування інтерфейсу
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve({
                    "success": true,
                    "processed": options.uuids,
                    "failed": [],
                    "doc_path": "Export/Накладна_Емуляція_2026.xlsx"
                });
            }, 1000);
        });
    },

    /**
     * Безпечне закриття програми на рівні ядра ОС через подію on_closed
     */
    close_application: function () {
        console.log('[ApiBridge] Передача сигналу примусового завершення до main.py...');

        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_application === 'function') {
            window.pywebview.api.close_application();
        } else {
            console.warn('[ApiBridge] Нативний інтерфейс закриття відсутній. Руйнування вікна на фронтенді.');
            window.close();
        }
    }
};

// Публікуємо у глобальну область видимості Chromium під двома аліасами для зворотної сумісності
window.Api = Api;
window.ApiBridge = Api;