/**
 * F.Int — Глобальна шина подій (EventBus / PubSub Pattern)
 * Забезпечує повну ізоляцію компонентів інтерфейсу.
 */
const EventBus = {
    _listeners: {},

    /**
     * Підписка на подію (Слухач)
     */
    on: function (event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    },

    /**
     * Трансляція події в систему (Еміт)
     */
    emit: function (event, data) {
        // Якщо на подію ще ніхто не підписався, просто ігноруємо без виклику помилок
        if (!this._listeners[event]) return;

        this._listeners[event].forEach(function (callback) {
            try {
                callback(data);
            } catch (e) {
                console.error(`[EventBus] Помилка обробки події "${event}":`, e);
            }
        });
    }
};

window.EventBus = EventBus;