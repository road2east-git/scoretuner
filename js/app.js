import './bus.js';

const handlers = {}; // 화면 모듈이 등록하는 onShow 콜백

export function registerScreen(name, onShow) { handlers[name] = onShow; }

function show(name, param) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  document.querySelectorAll('#tabbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.screen === name));
  handlers[name]?.(param);
  window.scrollTo(0, 0);
}

document.addEventListener('app:navigate', e => show(e.detail.screen, e.detail.param));
document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-screen]');
  if (btn) show(btn.dataset.screen);
});

// 테마
const savedTheme = localStorage.getItem('st_theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

// Service Worker (sw.js는 Task 17에서 생성)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

show('tuner');
