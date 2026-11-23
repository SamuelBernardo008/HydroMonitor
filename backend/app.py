import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_FILE = os.path.join(DATA_DIR, "hydrosaver.db")

app = Flask(__name__)
CORS(app)


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leituras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            distancia_cm REAL,
            luz INTEGER,
            nivel INTEGER,
            alarme_silenciado BOOLEAN,
            modo_manual BOOLEAN,
            servo_angulo INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comandos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comando TEXT,
            executado BOOLEAN DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


init_db()


@app.route("/api/telemetria", methods=["POST"])
def receber_telemetria():
    dados = request.get_json() or {}
    agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO leituras (timestamp, distancia_cm, luz, nivel, alarme_silenciado, modo_manual, servo_angulo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            agora,
            dados.get("distancia_cm", 0),
            dados.get("luz", 0),
            dados.get("nivel", 0),
            1 if dados.get("alarme_silenciado") else 0,
            1 if dados.get("modo_manual") else 0,
            dados.get("servo_angulo", 0),
        ),
    )

    pendentes = cursor.execute(
        "SELECT id, comando FROM comandos WHERE executado = 0 ORDER BY id ASC"
    ).fetchall()
    lista_comandos = [row[1] for row in pendentes]

    if pendentes:
        ids = [row[0] for row in pendentes]
        placeholders = ",".join("?" for _ in ids)
        cursor.execute(f"UPDATE comandos SET executado = 1 WHERE id IN ({placeholders})", ids)

    conn.commit()
    conn.close()

    return jsonify({"status": "ok", "comandos": lista_comandos})


@app.route("/api/historico", methods=["GET"])
def get_historico():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, distancia_cm, luz, nivel, alarme_silenciado, modo_manual, servo_angulo
        FROM leituras
        ORDER BY id DESC LIMIT 100
    """)
    rows = cursor.fetchall()
    conn.close()

    historico = []
    for r in reversed(rows):
        historico.append({
            "timestamp": r[0],
            "distancia_cm": r[1],
            "luz": r[2],
            "nivel": r[3],
            "alarme_silenciado": bool(r[4]),
            "modo_manual": bool(r[5]),
            "servo_angulo": r[6],
        })

    atual = historico[-1] if historico else None
    return jsonify({"atual": atual, "historico": historico})


@app.route("/api/comandos", methods=["POST"])
def enviar_comando():
    dados = request.get_json() or {}
    comando = dados.get("comando", "").strip().upper()
    if comando not in {"MUTE", "SERVO"}:
        return jsonify({"erro": "Comando inválido"}), 400

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO comandos (comando) VALUES (?)", (comando,))
    conn.commit()
    conn.close()

    return jsonify({"status": "ok", "comando": comando}), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)