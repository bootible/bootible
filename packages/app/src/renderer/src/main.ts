import "./styles.css";

declare global {
  interface Window {
    bootible?: { version: string };
  }
}

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  const version = window.bootible?.version ?? "v2";
  root.innerHTML = `
    <main class="shell">
      <div class="brand">bootible</div>
      <p class="tagline">Set up your handheld.</p>
      <span class="version">${version}</span>
    </main>
  `;
}
