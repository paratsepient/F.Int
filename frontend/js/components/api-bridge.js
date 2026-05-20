/**
 * Компонент: ApiBridge
 * Описує міст взаємодії між Vanilla JS та Python (pywebview)
 */
const ApiBridge = {
    /**
     * Отримання повного розгорнутого списку майна
     */
    async getAssets() {
        try {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_assets();
            }
            console.warn("API pywebview ще не ініціалізовано.");
            return [];
        } catch (error) {
            console.error("Помилка при отриманні активів через ApiBridge:", error);
            return [];
        }
    },

    /**
     * Отримання детальної розбивки граф обліку для модалки за назвою
     */
    async getDetailsByName(name) {
        try {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_details_by_name(name);
            }
            return [];
        } catch (error) {
            console.error("Помилка getDetailsByName через ApiBridge:", error);
            return [];
        }
    },

    /**
     * Виклик масових операцій (bulkAction) над майном
     */
    async bulkAction(config) {
        try {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.bulkAction(config);
            }
            return { success: false, error: "API недоступне" };
        } catch (error) {
            console.error("Помилка bulkAction через ApiBridge:", error);
            return { success: false, error: error.message };
        }
    },

    /**
     * МІСТ ДЛЯ КНОПКИ: Синхронне подвійне збереження та вихід
     */
    async saveAndExit() {
        try {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.save_and_exit();
            }
            return { success: false, error: "Критична помилка: міст pywebview відсутній." };
        } catch (error) {
            console.error("Помилка при виконанні saveAndExit через ApiBridge:", error);
            return { success: false, error: error.message };
        }
    }
};

// Експортуємо глобально для доступу з інших компонентів
window.ApiBridge = ApiBridge;