/**
 * F.Int — Головний контролер та ядро SPA-маршрутизації
 */

const App = {
    currentView: null,
    viewContainer: null,

    init: function () {
        this.viewContainer = document.getElementById('view-container');
        this.navigate('asset-table');
    },

    navigate: function (view) {
        if (this.currentView === view) return;
        this.currentView = view;

        if (view === 'asset-table') {
            this.viewContainer.innerHTML = `
                <div id="filter-panel-placeholder" style="width: 100%;"></div>
                <div id="asset-table-placeholder" style="display: flex; flex-direction: column; flex: 1; width: 100%; overflow: hidden;"></div>
            `;

            // Послідовний запуск ізольованих компонентів
            if (window.FilterPanel && typeof window.FilterPanel.init === 'function') {
                window.FilterPanel.init();
            }
            if (window.AssetTable && typeof window.AssetTable.init === 'function') {
                window.AssetTable.init();
            }
        }
    }
};

window.addEventListener('pywebviewready', function () {
    App.init();
});

window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        if (!App.currentView) {
            App.init();
        }
    }, 1000);
});