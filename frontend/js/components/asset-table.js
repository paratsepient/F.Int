/**
 * Модуль керування таблицею активів F.Int (Фаза 4)
 * Vanilla JS (Strict Mode)
 */

const _selectedUUIDs = new Set();

EventBus.on('filters:changed', clearSelection);
EventBus.on('bulk:completed', () => {
    clearSelection();
    if (typeof reloadTableData === 'function') {
        reloadTableData();
    } else {
        console.log('[AssetTable] Перезавантаження даних таблиці...');
    }
});

function buildHeaderRow(columns) {
    const tr = document.createElement('tr');

    const thSelect = document.createElement('th');
    thSelect.className = 'col-select';
    thSelect.style.width = '40px';

    const cbAll = document.createElement('input');
    cbAll.type = 'checkbox';
    cbAll.id = 'select-all';
    cbAll.title = 'Вибрати всі видимі позиції';

    cbAll.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.row-checkbox:not([disabled])').forEach(cb => {
            cb.checked = isChecked;
            const currentUuid = cb.dataset.uuid;
            if (isChecked) {
                _selectedUUIDs.add(currentUuid);
            } else {
                _selectedUUIDs.delete(currentUuid);
            }
        });

        EventBus.emit('assets:selected', {
            uuids: Array.from(_selectedUUIDs),
            count: _selectedUUIDs.size
        });
    });

    thSelect.appendChild(cbAll);
    tr.appendChild(thSelect);

    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        tr.appendChild(th);
    });

    return tr;
}

function buildDataRow(asset) {
    const tr = document.createElement('tr');
    tr.dataset.uuid = asset.uuid;

    const tdCb = document.createElement('td');
    tdCb.className = 'col-select';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-checkbox';
    cb.dataset.uuid = asset.uuid;

    cb.checked = _selectedUUIDs.has(asset.uuid);

    cb.addEventListener('change', (e) => {
        updateSelection(asset.uuid, e.target.checked);
    });

    tdCb.appendChild(cb);
    tr.appendChild(tdCb);

    return tr;
}

function updateSelection(uuid, isSelected) {
    if (isSelected) {
        _selectedUUIDs.add(uuid);
    } else {
        _selectedUUIDs.delete(uuid);
    }

    EventBus.emit('assets:selected', {
        uuids: Array.from(_selectedUUIDs),
        count: _selectedUUIDs.size
    });

    syncHeaderCheckbox();
}

function syncHeaderCheckbox() {
    const cbAll = document.querySelector('#select-all');
    if (!cbAll) return;

    const total = document.querySelectorAll('.row-checkbox').length;
    const checked = document.querySelectorAll('.row-checkbox:checked').length;

    cbAll.checked = checked === total && total > 0;
    cbAll.indeterminate = checked > 0 && checked < total;
}

function clearSelection() {
    _selectedUUIDs.clear();

    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = false;
    });

    const cbAll = document.querySelector('#select-all');
    if (cbAll) {
        cbAll.checked = false;
        cbAll.indeterminate = false;
    }

    EventBus.emit('assets:selected', { uuids: [], count: 0 });
}

if (typeof reloadTableData !== 'function') {
    window.reloadTableData = function () {
        console.log('[AssetTable Mock] Запит даних з API бекенду виконано.');
    };
}