const ApiBridge = {
    async getAssets() {
        return (window.pywebview && window.pywebview.api) ? await window.pywebview.api.get_assets() : [];
    },
    async addAsset(payload) {
        return (window.pywebview && window.pywebview.api) ? await window.pywebview.api.add_asset(payload) : { success: false };
    },
    // НОВИЙ МЕТОД ВИДАЛЕННЯ
    async deleteAsset(uuid) {
        return (window.pywebview && window.pywebview.api) ? await window.pywebview.api.delete_asset(uuid) : { success: false, error: "API Bridge Disconnected" };
    },
    async bulkAction(config) {
        return (window.pywebview && window.pywebview.api) ? await window.pywebview.api.bulkAction(config) : { success: false };
    },
    async saveAndExit() {
        return (window.pywebview && window.pywebview.api) ? await window.pywebview.api.save_and_exit() : { success: false };
    }
};
window.ApiBridge = ApiBridge;