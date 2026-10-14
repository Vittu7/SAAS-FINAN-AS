"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem("tema", novo ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={escuro}
      className="h-9 rounded-lg border border-line bg-surface px-3 text-sm transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    >
      {escuro ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
