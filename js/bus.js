export function navigate(screen, param = null) {
  document.dispatchEvent(new CustomEvent('app:navigate', { detail: { screen, param } }));
}

// 화면 모듈이 등록하는 진입/이탈 콜백 (app.js가 아닌 이곳에 두어 import 순환 방지)
export const screenHandlers = {};
export const leaveHandlers = {};
export function registerScreen(name, onShow) { screenHandlers[name] = onShow; }
export function registerLeave(name, onLeave) { leaveHandlers[name] = onLeave; }
