/**
 * F.Int — Адаптер зв'язку бекенду та фронтенду (API Bridge)
 * Стабілізує IPC-шлюз pywebview з підтримкою відкладеного виклику Promises.
 */

window.Api = {
    /**
     * Запит на отримання агрегованої (полегшеної) бази майна
     */
    get_assets: function () {
        return new Promise(function (resolve, reject) {
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_assets === 'function') {
                console.log("[ApiBridge] Запит масиву укрупнених активів get_assets()...");
                window.pywebview.api.get_assets().then(resolve).catch(reject);
            } else {
                console.warn("[ApiBridge] pywebview API не знайдене. Повертаємо дефолтний масив.");
                resolve([]);
            }
        });
    },

    /**
     * Точковий запит всіх локаційних граф для обраного найменування
     */
    get_details_by_name: function (name) {
        return new Promise(function (resolve, reject) {
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_details_by_name === 'function') {
                console.log(`[ApiBridge] Запит деталізованих граф для: "${name}"`);
                window.pywebview.api.get_details_by_name(name).then(resolve).catch(reject);
            } else {
                console.warn("[ApiBridge] Міст pywebview недоступний для get_details_by_name.");
                resolve([]);
            }
        });
    },

    /**
     * Універсальний метод передачі пакетних операцій (Редагування, Переміщення, Списання)
     */
    bulkAction: function (config) {
        return new Promise(function (resolve, reject) {
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.bulkAction === 'function') {
                window.pywebview.api.bulkAction(config).then(resolve).catch(reject);
            } else {
                reject(new Error("Бекенд Python недоступний (pywebview IPC розірвано)"));
            }
        });
    },

    /**
     * Запит на безпечне збереження кешу в чистий Excel та закриття вікна програми
     */
    close_app: function () {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
            window.pywebview.api.close_app();
        } else {
            window.close();
        }
    }
};

// Реєстрація успішного встановлення мосту Chromium
window.addEventListener('pywebviewready', function () {
    console.log("[ApiBridge] ✓ Канал зв'язку з Python бекендом успішно синхронізовано.");
});