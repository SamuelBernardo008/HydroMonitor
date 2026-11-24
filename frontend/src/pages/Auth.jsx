import { useState, useEffect } from "react";
import { Droplets } from "lucide-react";
import "./Auth.css";
import "../themes.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default function Auth({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Mantém o tema salvo aplicado também na tela de login
  useEffect(() => {
    const savedTheme = localStorage.getItem("hydrosaver-theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  function alternarModo() {
    setIsRegistering(!isRegistering);
    setErro("");
    setSucesso("");
    setSenha("");
    setConfirmarSenha("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (isRegistering) {
      if (senha.length < 6) {
        setErro("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (senha !== confirmarSenha) {
        setErro("As senhas não coincidem.");
        return;
      }
    }

    setCarregando(true);

    const endpoint = isRegistering ? "/api/register" : "/api/login";
    const payload = isRegistering ? { nome, email, senha } : { email, senha };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || "Falha na comunicação com o servidor.");
      }

      if (isRegistering) {
        setSucesso("Conta criada com sucesso! Faça login para continuar.");
        setIsRegistering(false);
        setSenha("");
        setConfirmarSenha("");
      } else {
        localStorage.setItem("hydrosystem_token", data.token);
        localStorage.setItem("hydrosystem_user", JSON.stringify(data.usuario));
        onLoginSuccess(data.usuario);
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Droplets size={28} className="header-icon" />
            <span>
              HIDRO<span className="header-accent">SAVER</span>
            </span>
          </div>
          <h1>{isRegistering ? "Criar Conta" : "Acessar Painel"}</h1>
          <p>
            {isRegistering
              ? "Cadastre-se para gerenciar seu reservatório"
              : "Entre com suas credenciais para monitorar o sistema"}
          </p>
        </div>

        {erro && <div className="auth-alert auth-error">{erro}</div>}
        {sucesso && <div className="auth-alert auth-success">{sucesso}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegistering && (
            <div className="form-group">
              <label htmlFor="nome">Nome completo</label>
              <input
                id="nome"
                type="text"
                placeholder="Ex: Samuel Bernardo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="confirmarSenha">Confirmar senha</label>
              <input
                id="confirmarSenha"
                type="password"
                placeholder="••••••••"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={carregando}>
            {carregando
              ? "Processando..."
              : isRegistering
              ? "Cadastrar"
              : "Entrar"}
          </button>
        </form>

        <div className="auth-footer">
          <span>
            {isRegistering ? "Já possui cadastro?" : "Ainda não tem conta?"}
          </span>
          <button type="button" onClick={alternarModo} className="auth-link">
            {isRegistering ? "Fazer login" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}