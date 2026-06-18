import "./styles.css";

declare global {
  interface Window {
    bootible?: { version: string };
  }
}

const status = document.querySelector<HTMLElement>(".sysstatus");
if (status && window.bootible?.version) {
  status.textContent = `${window.bootible.version} · local`;
}
