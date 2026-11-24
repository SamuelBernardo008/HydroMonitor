import { useState, useEffect } from "react";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [usuario, setUsuario] = useState(null);

  // Recupera a sessão salva caso o usuário recarregue a página
  useEffect(() => {
    const token = localStorage.getItem("hydrosystem_token");
    const savedUser = localStorage.getItem("hydrosystem_user");

    if (token && savedUser) {
      setUsuario(JSON.parse(savedUser));
    }
  }, []);

  // Limpa a sessão e volta para a tela de login
  function handleLogout() {
    localStorage.removeItem("hydrosystem_token");
    localStorage.removeItem("hydrosystem_user");
    setUsuario(null);
  }

  // Bloqueia o acesso ao painel se não estiver logado (RF10)
  if (!usuario) {
    return <Auth onLoginSuccess={(userData) => setUsuario(userData)} />;
  }

  // Libera o painel principal passando os dados do usuário e a função de sair
  return <Dashboard usuario={usuario} onLogout={handleLogout} />;
}