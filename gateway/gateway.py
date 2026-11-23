import serial
import time
import json
import requests

PORTA_SERIAL = '/dev/ttyACM0'  # Altere para /dev/ttyUSB0 ou COM3 (Windows) se necessário
BAUDRATE = 9600
API_URL = "http://127.0.0.1:5000/api/telemetria"

try:
    ser = serial.Serial(PORTA_SERIAL, BAUDRATE, timeout=1)
    time.sleep(2)
    print(f"[SERIAL OK] Conectado à porta {PORTA_SERIAL}")
except Exception as e:
    print(f"[ERRO SERIAL]: {e}")
    exit(1)

ultimo_envio = 0

while True:
    try:
        if ser.in_waiting > 0:
            linha = ser.readline().decode('utf-8', errors='ignore').strip()
            if linha.startswith('{') and linha.endswith('}'):
                agora = time.time()
                if agora - ultimo_envio >= 2:
                    dados = json.loads(linha)
                    resposta = requests.post(API_URL, json=dados, timeout=5)

                    if resposta.status_code == 200:
                        comandos = resposta.json().get("comandos", [])
                        for comando in comandos:
                            print(f"[COMANDO RECEBIDO]: {comando}")
                            if comando == "MUTE":
                                ser.write(b'M')
                            elif comando == "SERVO":
                                ser.write(b'S')

                    ultimo_envio = agora
    except Exception as e:
        print(f"[ERRO GATEWAY]: {e}")

    time.sleep(0.05)