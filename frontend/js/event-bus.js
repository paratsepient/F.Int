/**
 * Патерн Publisher/Subscriber (Event Bus).
 * Забезпечує слабку зв'язність (loose coupling) між Vanilla JS компонентами.
 */
class EventBusSystem {
    constructor() {
        this.listeners = {};

        // Реєстр дозволених подій для суворої типізації (уникнення помилок в іменах)
        // Включає як існуючі, так і нові події з Фази 4.
        this.ALLOWED_EVENTS = new Set([
            'filters:changed', // Зміна фільтрів
            'asset:updated',   // Одиночне редагування
            'assets:selected', // Вибір чекбоксів (Фаза 4)
            'bulk:completed'   // Завершення масової дії (Фаза 4)
        ]);
    }

    /**
     * Підписка на подію.
     * @param {string} event - Назва події.
     * @param {Function} callback - Функція-обробник.
     */
    on(event, callback) {
        if (!this.ALLOWED_EVENTS.has(event)) {
            console.warn(`[EventBus] Підписка на незареєстровану подію: ${event}`);
        }

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Відписка від події.
     * @param {string} event - Назва події.
     * @param {Function} callback - Функція-обробник, яку потрібно видалити.
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Публікація події.
     * @param {string} event - Назва події.
     * @param {Object} payload - Дані для передачі підписникам.
     */
    emit(event, payload) {
        if (!this.ALLOWED_EVENTS.has(event)) {
            console.warn(`[EventBus] Публікація незареєстрованої події: ${event}`);
        }

        if (!this.listeners[event] || this.listeners[event].length === 0) {
            return; // Немає підписників — ігноруємо
        }

        // Синхронний виклик підписників із захистом від падіння всього ланцюга
        this.listeners[event].forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error(`[EventBus] Помилка в обробнику події '${event}':`, error);
            }
        });
    }

    /**
     * Очищення всіх підписників (для тестів або скидання стану).
     */
    clearAll() {
        this.listeners = {};
    }
}

// Експорт глобального синглтону для середовища Vanilla JS
window.EventBus = new EventBusSystem();