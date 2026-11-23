import { useCallback, useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.137.71:5000";
const RASPBERRY_IP = import.meta.env.VITE_MQTT_HOST || "192.168.137.71";
const PORTA_WEBSOCKETS = Number(import.meta.env.VITE_MQTT_PORT) || 9001;

export default function App() {
  const [telemetria, setTelemetria] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [mqttConectado, setMqttConectado] = useState(false);
  const [servidorAtivo, setServidorAtivo] = useState(false);
  const [ultimaHora, setUltimaHora] = useState("--:--:--");

  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const mqttClientRef = useRef(null);

  const aplicarLeitura = useCallback((data) => {
    if (!data) return;
    setTelemetria({
      distancia_cm: data.distancia_cm ?? data.distancia ?? 0,
      luz: data.luz ?? 0,
      nivel: data.nivel ?? 0,
      servo_angulo: data.servo_angulo ?? data.servo ?? 0,
      modo_manual: Boolean(data.modo_manual),
      alarme_silenciado: Boolean(data.alarme_silenciado),
    });
    setUltimaHora(new Date().toLocaleTimeString());
  }, []);

  // --- INICIALIZAÇÃO DO GRÁFICO (Chart.js) ---
  useEffect(() => {
    if (!canvasRef.current) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Distância (cm)",
            data: [],
            borderColor: "#00F5D4",
            backgroundColor: "rgba(0, 187, 249, 0.18)",
            pointBackgroundColor: "#00F5D4",
            pointBorderColor: "#00142F",
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: "#cbd5e1" },
          },
        },
        scales: {
          x: {
            ticks: { color: "#93c5fd" },
            grid: { color: "rgba(255, 255, 255, 0.06)" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#93c5fd" },
            grid: { color: "rgba(255, 255, 255, 0.08)" },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  // --- CONEXÃO MQTT (WebSockets) ---
  useEffect(() => {
    if (!window.Paho?.MQTT) return;

    const clientId = "web_" + Math.floor(Math.random() * 10000);
    const client = new window.Paho.MQTT.Client(
      RASPBERRY_IP,
      Number(PORTA_WEBSOCKETS),
      clientId
    );
    mqttClientRef.current = client;

    client.onConnectionLost = (response) => {
      console.log("Conexão MQTT perdida:", response);
      setMqttConectado(false);
    };

    client.onMessageArrived = (message) => {
      try {
        const data = JSON.parse(message.payloadString);
        aplicarLeitura(data);
      } catch (e) {
        console.error("Erro ao ler mensagem MQTT:", e);
      }
    };

    try {
      client.connect({
        onSuccess: () => {
          console.log("MQTT Conectado!");
          setMqttConectado(true);
          client.subscribe("projeto/estacao/dados");
        },
        onFailure: () => {
          setMqttConectado(false);
        },
      });
    } catch {
      setMqttConectado(false);
    }

    return () => {
      try {
        if (client.isConnected()) {
          client.disconnect();
        }
      } catch {
        // Ignora erro ao encerrar socket
      }
    };
  }, [aplicarLeitura]);

  // --- BUSCA HISTÓRICO DO BANCO DE DADOS (API FLASK) ---
  const carregarHistorico = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/historico`);
      if (!res.ok) throw new Error("Servidor offline");
      const resposta = await res.json();

      setServidorAtivo(true);

      const lista = Array.isArray(resposta) ? resposta : resposta.historico || [];
      setHistorico(lista);

      const atualApi = !Array.isArray(resposta) ? resposta.atual : lista[0];
      if (atualApi) {
        aplicarLeitura(atualApi);
      }

      if (chartRef.current) {
        const labels = lista.map((row) =>
          row.timestamp ? row.timestamp.split(" ")[1] || row.timestamp : ""
        );
        const valoresDistancia = lista.map(
          (row) => row.distancia_cm ?? row.distancia ?? 0
        );

        chartRef.current.data.labels = labels;
        chartRef.current.data.datasets[0].data = valoresDistancia;
        chartRef.current.update();
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      setServidorAtivo(false);
    }
  }, [aplicarLeitura]);

  useEffect(() => {
    carregarHistorico();
    const timer = setInterval(carregarHistorico, 10000);
    return () => clearInterval(timer);
  }, [carregarHistorico]);

  // --- ENVIO DE COMANDOS (MQTT com fallback para HTTP API) ---
  async function enviarComando(cmd) {
    const client = mqttClientRef.current;
    if (client && mqttConectado) {
      const msg = new window.Paho.MQTT.Message(cmd);
      msg.destinationName = "projeto/estacao/comandos";
      client.send(msg);
      return;
    }

    try {
      await fetch(`${API_URL}/api/comandos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comando: cmd }),
      });
    } catch (err) {
      console.error("Erro ao enviar comando:", err);
    }
  }

  // --- CÁLCULOS VISUAIS DO RESERVATÓRIO ---
  const tampaAberta = (telemetria?.luz ?? 0) > 200;

  let bannerTexto = "🔌 Dispositivo Desconectado";
  let bannerClasse = "alert-banner alert-offline";

  if (telemetria) {
    if (tampaAberta) {
      bannerTexto = "⚠️ TAMPA ABERTA (Luz Detectada!)";
      bannerClasse = "alert-banner alert-warn";
    } else {
      bannerTexto = "🔒 Reservatório Fechado";
      bannerClasse = "alert-banner alert-ok";
    }
  }

  let percent = 0;
  let nivelTexto = "⚪ Dispositivo Desconectado";
  let nivelClasse = "level-badge level-0";

  if (telemetria) {
    if (telemetria.nivel === 1) {
      percent = 90;
      nivelTexto = "🟢 Nível CHEIO (LED Verde)";
      nivelClasse = "level-badge level-1";
    } else if (telemetria.nivel === 2) {
      percent = 50;
      nivelTexto = "🟡 Nível MÉDIO (LED Amarelo)";
      nivelClasse = "level-badge level-2";
    } else if (telemetria.nivel === 3) {
      percent = 15;
      nivelTexto = "🔴 Nível CRÍTICO (LED Vermelho)";
      nivelClasse = "level-badge level-3";
    } else {
      percent = 0;
      nivelTexto = "⚪ Status Indeterminado / Fora do Alcance";
      nivelClasse = "level-badge level-0";
    }
  }

  return (
    <div>
      <header className="header">
        <h1>
          💧 HIDRO<span className="header-accent">SAVER</span>
        </h1>
        <div className="header-bar" />
        <p>
          Monitoramento hídrico <span>inteligente</span> e em tempo real.
        </p>
      </header>

      <div className="grid">
        {/* Card 1: Nível em Tempo Real e Reservatório */}
        <div className="card">
          <h2>Nível do Reservatório</h2>

          <div className={bannerClasse}>{bannerTexto}</div>

          <div className="tank-wrapper">
            <div className={`tank-lid ${telemetria && tampaAberta ? "open" : ""}`} />
            <div className="tank-container">
              <div className="tank-water" style={{ height: `${percent}%` }} />
              <span className="tank-percent">{percent}%</span>
            </div>
          </div>

          <div className={nivelClasse}>{nivelTexto}</div>

          <div className="metrics-grid">
            <div className="metric-box">
              <span>Distância</span>
              <strong>{telemetria ? `${telemetria.distancia_cm} cm` : "-- cm"}</strong>
            </div>
            <div className="metric-box">
              <span>Luminosidade (LDR)</span>
              <strong>{telemetria ? telemetria.luz : "--"}</strong>
            </div>
            <div className="metric-box">
              <span>Status do Alarme</span>
              <strong
                style={{
                  color: !telemetria
                    ? "#ffffff"
                    : telemetria.alarme_silenciado
                    ? "#fbbf24"
                    : "#00F5D4",
                }}
              >
                {!telemetria
                  ? "--"
                  : telemetria.alarme_silenciado
                  ? "🔕 Silenciado"
                  : "🔔 Ativo"}
              </strong>
            </div>
            <div className="metric-box">
              <span>Modo Manual</span>
              <strong>
                {telemetria ? (telemetria.modo_manual ? "SIM" : "NÃO") : "--"}
              </strong>
            </div>
            <div className="metric-box metric-box-full">
              <span>Ângulo do Registro (Válvula)</span>
              <strong>{telemetria ? `${telemetria.servo_angulo}°` : "--°"}</strong>
            </div>
          </div>

          <div className="btn-group">
            <button className="btn btn-mute" onClick={() => enviarComando("MUTE")}>
              🔕 Silenciar Alarme
            </button>
            <button className="btn btn-servo" onClick={() => enviarComando("SERVO")}>
              ⚙️ Válvula
            </button>
          </div>
        </div>

        {/* Card 2: Gráfico de Histórico */}
        <div className="card">
          <h2>Histórico da Distância (cm)</h2>
          <canvas ref={canvasRef} height="220" />
        </div>

        {/* Card 3: Diagnóstico do Sistema */}
        <div className="card">
          <h2>Diagnóstico do Sistema</h2>
          <ul className="status-list">
            <li className="status-item">
              <span>Conexão MQTT:</span>
              <span className={`status-pill ${mqttConectado ? "pill-green" : "pill-red"}`}>
                {mqttConectado ? "🟢 Conectado" : "🔴 Desconectado"}
              </span>
            </li>
            <li className="status-item">
              <span>Servidor & Banco:</span>
              <span className={`status-pill ${servidorAtivo ? "pill-green" : "pill-red"}`}>
                {servidorAtivo ? "💾 Ativo (dados.db)" : "🔴 Desativado"}
              </span>
            </li>
            <li className="status-item">
              <span>Última Atualização:</span>
              <strong className="status-hora">{ultimaHora}</strong>
            </li>
            <li className="status-item">
              <span>Registros Exibidos:</span>
              <strong>{historico.length} / 100</strong>
            </li>
            <li className="status-item">
              <span>Capacidade Estimada:</span>
              <strong>{telemetria ? `${percent} %` : "0 %"}</strong>
            </li>
          </ul>

          <div className="diagnostico-box">
            <strong className="diagnostico-titulo">📊 Parâmetros da Operação:</strong>
            <div className="diagnostico-grid">
              <div>
                ⏱️ <strong>Gravação BD:</strong> a cada 2s
              </div>
              <div>
                🔄 <strong>Auto-Refresh:</strong> 2s
              </div>
              <div>
                📏 <strong>Leitura Serial:</strong> 500ms
              </div>
              <div>
                ☀️ <strong>Limiar Luz:</strong> LDR &gt; 200
              </div>
            </div>
            <hr className="diagnostico-divider" />
            <div className="diagnostico-regra">
              🛡️ <strong>Regra de Segurança:</strong> Ao detectar nível crítico/cheio, o
              servo ajusta a válvula automaticamente e dispara o alarme.
            </div>
          </div>
        </div>

        {/* Card 4: Tabela de Histórico */}
        <div className="card card-full">
          <div className="card-table-header">
            <h2>Registros do Banco de Dados (SQLite - Últimos 100)</h2>
            <button className="btn-refresh" onClick={carregarHistorico}>
              🔄 Atualizar Tabela
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Distância (cm)</th>
                  <th>Luminosidade</th>
                  <th>Nível</th>
                  <th>Ângulo Válvula</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan="5">Nenhuma leitura registrada ainda.</td>
                  </tr>
                ) : (
                  historico.map((row, index) => (
                    <tr key={row.id ?? index}>
                      <td>{row.timestamp}</td>
                      <td>{row.distancia_cm ?? row.distancia} cm</td>
                      <td>{row.luz}</td>
                      <td>{row.nivel}</td>
                      <td>{row.servo_angulo ?? row.servo}°</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}