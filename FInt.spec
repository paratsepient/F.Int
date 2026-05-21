# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Додаємо папки, які мають бути всередині exe
added_files = [
    ('frontend', 'frontend'),              # Копіюємо папку frontend
#    ('Import', 'Import'),                  # Якщо дані лежать тут
    ('backend', 'backend'),                # Ваш бекенд
]

a = Analysis(
    ['main.py'],                           # Ваш головний файл запуску
    pathex=[],
    binaries=[],
    datas=added_files,                     # Список файлів для включення
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='F.Int',                          # Назва вашого exe
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,                         # False = без чорного вікна консолі
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico'                        # Якщо маєте іконку, покладіть її в корінь
)