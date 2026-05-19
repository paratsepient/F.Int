/**
 * F.Int — Глобальна шина подій (EventBus)
 * Реалізує патерн Pub/Sub для ізольованого спілкування компонентів.
 * Оновлено під специфікацію APP MAP v1.1.
 */

const EventBus = {
    // Реєстр суворо дозволених подій системи згідно з архітектурним планом v1.1
    _allowedEvents: new Set([
        'filters:changed',   // Зміна фільтрів у панелі
        'asset-table:ready', // Таблиця успішно відрендерена
        'asset:updated',      // Оновлення картки об'єкта
        'asset:added',        // Додавання нової позиції
        'assets:selected',    // Виділення рядків чекбоксами (для BulkActionBar)
        'bulk:completed',     // Масова операція завершена
        'document:saved',     // Збереження чернетки або акта
        'settings:changed',   // Зміна масштабу / теми / шрифту
        'backup:created',     // Створення фонової резервної копії
        'route:changed'       // [ДОДАНО] Перемикання екранів у боковому меню
    ]),

    _listeners: {},

    /**
     * Підписка на подію (Слухач)
     */
    on(event, callback) {
        if (!this._allowedEvents.has(event)) {
            console.warn(`[EventBus] Підписка на незареєстровану подію: ${event}`);
            return;
        }

        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    },

    /**
     * Альтернативний метод для сумісності (subscribe)
     */
    subscribe(event, callback) {
        this.on(event, callback);
    },

    /**
     * Публікація події (Тригер)
     */
    emit(event, data) {
        if (!this._allowedEvents.has(event)) {
            console.error(`[EventBus] Блокування публікації незареєстрованої події: ${event}`);
            return;
        }

        if (!this._listeners[event]) return;

        // Виклик усіх зареєстрованих слухачів
        this._listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error(`[EventBus] Помилка виконання слухача для події ${event}:`, err);
            }
        });
    },

    /**
     * Альтернативний метод для сумісності (publish)
     */
    publish(event, data) {
        this.emit(event, data);
    },

    /**
     * Відписка від події (Очищення пам'яті)
     */
    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
};

// Експортуємо у глобальну область видимості браузера Chromium
window.EventBus = EventBus;