import { useState, useEffect, useRef } from "react";
import {
  ZoomOut,
  ZoomIn,
  Palette,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Contrast,
  Leaf,
} from "lucide-react";

export function ThemeMenu({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(() => {
    const saved = Number(localStorage.getItem("hydrosaver-zoom"));
    return saved >= 80 && saved <= 130 ? saved : 100;
  });

  const menuRef = useRef(null);

  // Aplica o nível de zoom na página e salva no localStorage
  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}%`;
    localStorage.setItem("hydrosaver-zoom", String(zoom));
  }, [zoom]);

  // Fecha o menu ao clicar fora dele ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleZoomOut = () => setZoom((prev) => Math.max(80, prev - 10));
  const handleZoomIn = () => setZoom((prev) => Math.min(130, prev + 10));

  const isLight = theme === "light";
  const isContrast = theme === "contrast";
  const isComfort = theme === "comfort";

  const toggleLightDark = () => setTheme(isLight ? "dark" : "light");
  const toggleContrast = () => setTheme(isContrast ? "dark" : "contrast");
  const toggleComfort = () => setTheme(isComfort ? "dark" : "comfort");

  return (
    <div className="theme-menu-wrapper" ref={menuRef}>
      {/* Botão -Zoom */}
      <button
        type="button"
        className="theme-menu-trigger zoom-btn"
        onClick={handleZoomOut}
        disabled={zoom <= 80}
        title={`Diminuir zoom (Atual: ${zoom}%)`}
        aria-label="Diminuir zoom"
      >
        <ZoomOut size={16} />
        <span>Zoom</span>
      </button>

      {/* Botão +Zoom */}
      <button
        type="button"
        className="theme-menu-trigger zoom-btn"
        onClick={handleZoomIn}
        disabled={zoom >= 130}
        title={`Aumentar zoom (Atual: ${zoom}%)`}
        aria-label="Aumentar zoom"
      >
        <ZoomIn size={16} />
        <span>Zoom</span>
      </button>

      {/* Menu Suspenso de Aparência */}
      <div className="theme-dropdown-anchor">
        <button
          type="button"
          className="theme-menu-trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Abrir menu de aparência e acessibilidade"
        >
          <Palette size={17} />
          <span>Aparência</span>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {open && (
          <div className="theme-menu-dropdown" role="menu">
            <div className="theme-menu-title">Exibição e Acessibilidade</div>

            {/* Botão 1: Alternar Claro / Escuro */}
            <button
              type="button"
              role="menuitem"
              className={`theme-option-btn ${theme === "dark" || isLight ? "active" : ""}`}
              onClick={toggleLightDark}
            >
              <div className="theme-option-info">
                <span className="theme-option-label">
                  {isLight ? (
                    <>
                      <Moon size={16} /> Mudar para Modo Escuro
                    </>
                  ) : (
                    <>
                      <Sun size={16} /> Mudar para Modo Claro
                    </>
                  )}
                </span>
                <span className="theme-option-desc">
                  Atual:{" "}
                  {isLight
                    ? "Modo Claro"
                    : theme === "dark"
                    ? "Modo Escuro (Padrão)"
                    : "Outro modo ativo"}
                </span>
              </div>
              {(theme === "dark" || isLight) && (
                <span className="theme-badge-active">Ativo</span>
              )}
            </button>

            {/* Botão 2: Alto Contraste */}
            <button
              type="button"
              role="menuitem"
              className={`theme-option-btn ${isContrast ? "active" : ""}`}
              onClick={toggleContrast}
            >
              <div className="theme-option-info">
                <span className="theme-option-label">
                  <Contrast size={16} /> Alto Contraste
                </span>
                <span className="theme-option-desc">
                  Fundo preto, bordas nítidas e leitura máxima
                </span>
              </div>
              {isContrast && <span className="theme-badge-active">Ativo</span>}
            </button>

            {/* Botão 3: Modo Conforto */}
            <button
              type="button"
              role="menuitem"
              className={`theme-option-btn ${isComfort ? "active" : ""}`}
              onClick={toggleComfort}
            >
              <div className="theme-option-info">
                <span className="theme-option-label">
                  <Leaf size={16} /> Modo Conforto
                </span>
                <span className="theme-option-desc">
                  Cores quentes suaves para descanso ocular
                </span>
              </div>
              {isComfort && <span className="theme-badge-active">Ativo</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}