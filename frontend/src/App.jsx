import { useCallback, useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  Droplets,
  Unplug,
  AlertTriangle,
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Bell,
  BellOff,
  Settings,
  Wifi,
  WifiOff,
  Database,
  ServerOff,
  BarChart3,
  Clock,
  RefreshCw,
  Ruler,
  Sun,
  ShieldCheck,
} from "lucide-react";
import "./App.css";
import "./themes.css";
import { ThemeMenu } from "./components/ThemeMenu";

const API_URL = import.meta.env.VITE_API_URL || "http://192.168.137.71:5000";
const RASPBERRY_IP = import.meta.env.VITE_MQTT_HOST || "192.168.137.71";
const PORTA_WEBSOCKETS = Number(import.meta.env.VITE_MQTT_PORT) || 9001;

const CHART_PALETTES = {
  dark: {
    border: "#00F5D4",
    fill: "rgba(0, 187, 249, 0.18)",
    pointBorder: "#00142F",
    legend: "#cbd5e1",
    ticks: "#93c5fd",
    grid: "rgba(255, 255, 255, 0.08)",
  },
  light: {
    border: "#0284c7",
    fill: "rgba(2, 132, 199, 0.16)",
    pointBorder: "#ffffff",
    legend: "#1e293b",
    ticks: "#334155",
    grid: "rgba(15, 23, 42, 0.1)",
  },
  contrast: {
    border: "#00ffff",
    fill: "rgba(0, 255, 255, 0.2)",
    pointBorder: "#000000",
    legend: "#ffffff",
    ticks: "#ffd600",
    grid: "rgba(255, 255, 255, 0.3)",
  },
  comfort: {
    border: "#2a6f63",
    fill: "rgba(42, 111, 99, 0.16)",
    pointBorder: "#f6f1e6",
    legend: "#2b2720",
    ticks: "#5c5446",
    grid: "rgba(92, 84, 70, 0.15)",
  },
};

export default function App() {
  const [telemetria, setTelemetria] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [mqttConectado, setMqttConectado] = useState(false);
  const [servidorAtivo, setServidorAtivo] = useState(false);
  const [ultimaHora, setUltimaHora] = useState("--:--:--");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("hydrosaver-theme") || "dark";
  });

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
    const initialTheme = localStorage.getItem("hydrosaver-theme") || "dark";
    const palette = CHART_PALETTES[initialTheme] || CHART_PALETTES.dark;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Distância (cm)",
            data: [],
            borderColor: palette.border,
            backgroundColor: palette.fill,
            pointBackgroundColor: palette.border,
            pointBorderColor: palette.pointBorder,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: palette.legend },
          },
        },
        scales: {
          x: {
            ticks: { color: palette.ticks },
            grid: { color: palette.grid },
          },
          y: {
            beginAtZero: true,
            ticks: { color: palette.ticks },
            grid: { color: palette.grid },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // --- SINCRONIZA O TEMA NO HTML, LOCALSTORAGE E GRÁFICO ---
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("hydrosaver-theme", theme);

    const chart = chartRef.current;
    const palette = CHART_PALETTES[theme] || CHART_PALETTES.dark;
    if (chart && chart.canvas) {
      chart.data.datasets[0].borderColor = palette.border;
      chart.data.datasets[0].backgroundColor = palette.fill;
      chart.data.datasets[0].pointBackgroundColor = palette.border;
      chart.data.datasets[0].pointBorderColor = palette.pointBorder;
      chart.options.plugins.legend.labels.color = palette.legend;
      chart.options.scales.x.ticks.color = palette.ticks;
      chart.options.scales.x.grid.color = palette.grid;
      chart.options.scales.y.ticks.color = palette.ticks;
      chart.options.scales.y.grid.color = palette.grid;
      chart.update();
    }
  }, [theme]);

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

      if (chartRef.current && chartRef.current.canvas) {
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

  let BannerIcon = Unplug;
  let bannerTexto = "Dispositivo Desconectado";
  let bannerClasse = "alert-banner alert-offline";

  if (telemetria) {
    if (tampaAberta) {
      BannerIcon = AlertTriangle;
      bannerTexto = "TAMPA ABERTA (Luz Detectada!)";
      bannerClasse = "alert-banner alert-warn";
    } else {
      BannerIcon = Lock;
      bannerTexto = "Reservatório Fechado";
      bannerClasse = "alert-banner alert-ok";
    }
  }

  let percent = 0;
  let NivelIcon = HelpCircle;
  let nivelTexto = "Dispositivo Desconectado";
  let nivelClasse = "level-badge level-0";

  if (telemetria) {
    if (telemetria.nivel === 1) {
      percent = 90;
      NivelIcon = CheckCircle2;
      nivelTexto = "Nível CHEIO (LED Verde)";
      nivelClasse = "level-badge level-1";
    } else if (telemetria.nivel === 2) {
      percent = 50;
      NivelIcon = AlertCircle;
      nivelTexto = "Nível MÉDIO (LED Amarelo)";
      nivelClasse = "level-badge level-2";
    } else if (telemetria.nivel === 3) {
      percent = 15;
      NivelIcon = XCircle;
      nivelTexto = "Nível CRÍTICO (LED Vermelho)";
      nivelClasse = "level-badge level-3";
    } else {
      percent = 0;
      NivelIcon = HelpCircle;
      nivelTexto = "Status Indeterminado / Fora do Alcance";
      nivelClasse = "level-badge level-0";
    }
  }

  return (
    <div className="app-shell">
      <ThemeMenu theme={theme} setTheme={setTheme} />

      <header className="header">
        <h1>
          <Droplets size={34} className="header-icon" />
          <span>
            HIDRO<span className="header-accent">SAVER</span>
          </span>
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

          <div className={bannerClasse}>
            <BannerIcon size={17} className="icon-fixed" />
            <span>{bannerTexto}</span>
          </div>

          <div className="tank-wrapper">
            <div className={`tank-lid ${telemetria && tampaAberta ? "open" : ""}`} />
            <div className="tank-container">
              <div className="tank-water" style={{ height: `${percent}%` }} />
              <span className="tank-percent">{percent}%</span>
            </div>
          </div>

          <div className={nivelClasse}>
            <NivelIcon size={17} className="icon-fixed" />
            <span>{nivelTexto}</span>
          </div>

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
                className="metric-inline"
                style={{
                  color: !telemetria
                    ? "var(--text-primary)"
                    : telemetria.alarme_silenciado
                    ? "var(--warn-text)"
                    : "var(--accent-primary)",
                }}
              >
                {!telemetria ? (
                  "--"
                ) : telemetria.alarme_silenciado ? (
                  <>
                    <BellOff size={16} /> Silenciado
                  </>
                ) : (
                  <>
                    <Bell size={16} /> Ativo
                  </>
                )}
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
              <BellOff size={17} />
              <span>Silenciar Alarme</span>
            </button>
            <button className="btn btn-servo" onClick={() => enviarComando("SERVO")}>
              <Settings size={17} />
              <span>Válvula</span>
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
                {mqttConectado ? (
                  <>
                    <Wifi size={14} /> Conectado
                  </>
                ) : (
                  <>
                    <WifiOff size={14} /> Desconectado
                  </>
                )}
              </span>
            </li>
            <li className="status-item">
              <span>Servidor & Banco:</span>
              <span className={`status-pill ${servidorAtivo ? "pill-green" : "pill-red"}`}>
                {servidorAtivo ? (
                  <>
                    <Database size={14} /> Ativo (dados.db)
                  </>
                ) : (
                  <>
                    <ServerOff size={14} /> Desativado
                  </>
                )}
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
            <strong className="diagnostico-titulo">
              <BarChart3 size={16} className="icon-fixed" />
              <span>Parâmetros da Operação:</span>
            </strong>
            <div className="diagnostico-grid">
              <div>
                <Clock size={14} className="icon-fixed" />
                <span>
                  <strong>Gravação BD:</strong> a cada 2s
                </span>
              </div>
              <div>
                <RefreshCw size={14} className="icon-fixed" />
                <span>
                  <strong>Auto-Refresh:</strong> 2s
                </span>
              </div>
              <div>
                <Ruler size={14} className="icon-fixed" />
                <span>
                  <strong>Leitura Serial:</strong> 500ms
                </span>
              </div>
              <div>
                <Sun size={14} className="icon-fixed" />
                <span>
                  <strong>Limiar Luz:</strong> LDR &gt; 200
                </span>
              </div>
            </div>
            <hr className="diagnostico-divider" />
            <div className="diagnostico-regra">
              <ShieldCheck size={16} className="icon-fixed" />
              <span>
                <strong>Regra de Segurança:</strong> Ao detectar nível crítico/cheio, o
                servo ajusta a válvula automaticamente e dispara o alarme.
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Tabela de Histórico */}
        <div className="card card-full">
          <div className="card-table-header">
            <h2>Registros do Banco de Dados (SQLite - Últimos 100)</h2>
            <button className="btn-refresh" onClick={carregarHistorico}>
              <RefreshCw size={15} />
              <span>Atualizar Tabela</span>
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