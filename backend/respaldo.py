import sqlite3
from datetime import datetime
from pathlib import Path

from database import RUTA_BD

CARPETA = RUTA_BD.parent / "respaldos"
MAX_RESPALDOS = 30
MINUTOS_ENTRE_RESPALDOS = 60


def hacer_respaldo() -> Path | None:
    if not RUTA_BD.exists():
        return None

    CARPETA.mkdir(exist_ok=True)
    existentes = sorted(CARPETA.glob("inventario_*.db"))

    # Evita llenar la carpeta si el servidor se reinicia muchas veces seguidas
    if existentes:
        antiguedad = datetime.now().timestamp() - existentes[-1].stat().st_mtime
        if antiguedad < MINUTOS_ENTRE_RESPALDOS * 60:
            return None

    destino = CARPETA / f"inventario_{datetime.now():%Y-%m-%d_%H-%M-%S}.db"
    origen = sqlite3.connect(RUTA_BD)
    copia = sqlite3.connect(destino)
    try:
        origen.backup(copia)
    finally:
        copia.close()
        origen.close()

    # Conserva solo los más recientes
    sobrantes = max(0, len(existentes) + 1 - MAX_RESPALDOS)
    for viejo in existentes[:sobrantes]:
        viejo.unlink()

    return destino