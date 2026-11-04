// Runs inside streaming documents. It has no Novus IPC permissions.
(() => {
  if (window.__novus_fullscreen_initialized) return;
  window.__novus_fullscreen_initialized = true;
  let button;
  let hideTimer;
  const hide = () => {
    if (!button) return;
    if (button === document.activeElement) return;
    button.style.opacity = "0";
    button.style.pointerEvents = "none";
    button.tabIndex = -1;
    button.inert = true;
    button.setAttribute("aria-hidden", "true");
  };
  const show = () => {
    if (!button) return;
    clearTimeout(hideTimer);
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
    button.tabIndex = 0;
    button.inert = false;
    button.removeAttribute("aria-hidden");
    hideTimer = setTimeout(hide, 3000);
  };
  document.addEventListener("fullscreenchange", () => {
    clearTimeout(hideTimer);
    button?.remove();
    button = undefined;
    const target = document.fullscreenElement;
    // A fullscreen <video> uses the browser's own video controls instead.
    if (!target || target instanceof HTMLVideoElement || target instanceof HTMLIFrameElement) return;
    button = document.createElement("button");
    button.type = "button";
    button.textContent = "전체화면 종료";
    button.setAttribute("aria-label", "전체화면 종료");
    Object.assign(button.style, {
      position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
      zIndex: "2147483647", minHeight: "44px", padding: "8px 18px", border: "1px solid #777",
      borderRadius: "22px", background: "rgba(20,24,32,0.92)", color: "#fff",
      font: "14px system-ui", cursor: "pointer", transition: "opacity 140ms ease",
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void document.exitFullscreen().catch(() => {});
    });
    button.addEventListener("focus", show);
    button.addEventListener("blur", show);
    target.appendChild(button);
    show();
  });
  document.addEventListener("pointermove", (event) => {
    if (event.clientY <= 56) show();
  }, { passive: true });
  document.addEventListener("pointerdown", (event) => {
    if (event.clientY <= 56) show();
  }, { passive: true });
})();
