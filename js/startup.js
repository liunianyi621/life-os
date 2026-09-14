// This small boundary also works when a later script cannot load or initialize.
function reportAppFailure(message) {
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => reportAppFailure(message), { once: true });
    return;
  }
  let notice = document.getElementById("appRecoveryNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "appRecoveryNotice";
    notice.setAttribute("role", "alert");
    Object.assign(notice.style, {
      position: "fixed", top: "env(safe-area-inset-top, 0px)", left: "12px", right: "12px",
      zIndex: "10000", padding: "12px", background: "#fff", color: "#242424",
      border: "1px solid #ddd", borderRadius: "8px", font: "14px/1.4 system-ui"
    });
    const text = document.createElement("span");
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "重新加载";
    reload.style.cssText = "min-height:44px;margin-left:12px;background:transparent;border:0;color:inherit";
    reload.addEventListener("click", () => location.reload());
    notice.append(text, reload);
    document.body.append(notice);
  }
  notice.firstChild.textContent = message;
}

window.addEventListener("error", event => {
  if (event.target instanceof HTMLScriptElement) {
    reportAppFailure("应用文件加载失败，请重新加载。设备上的数据未被清除。");
  } else if (event.error) {
    reportAppFailure("应用遇到异常，请重新加载。设备上的数据未被清除。");
  }
}, true);
window.addEventListener("unhandledrejection", () => {
  reportAppFailure("操作暂时未能完成。设备上的数据未被清除。");
});
