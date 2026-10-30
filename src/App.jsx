import { useEffect, useRef, useState } from 'react';

// In production, configure VITE_API_BASE_URL to the absolute API origin, e.g.
// https://api.example.com. In local development, an empty value uses Vite's /api proxy.
const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = (() => {
  if (!rawApiBaseUrl) return import.meta.env.DEV ? '' : null;

  try {
    const parsed = new URL(rawApiBaseUrl);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const isOriginOnly = parsed.pathname === '/' && !parsed.search && !parsed.hash;
    const isSecureInProduction = !import.meta.env.PROD || parsed.protocol === 'https:';
    if (!isHttp || !isOriginOnly || !isSecureInProduction) return null;
    return parsed.origin;
  } catch {
    return null;
  }
})();

function apiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

let turnstileScriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      turnstileScriptPromise = undefined;
      reject(new Error('Не удалось загрузить Cloudflare Turnstile. Проверьте подключение к интернету.'));
    };
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function App() {
  const widgetRef = useRef(null);
  const containerRef = useRef(null);
  const [siteKey, setSiteKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: 'info', text: 'Загружаем защиту…' });

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        if (API_BASE_URL === null) {
          setConfigured(false);
          setStatus({
            kind: 'error',
            text: 'API не настроен. Укажите абсолютный HTTPS-адрес в VITE_API_BASE_URL и пересоберите frontend.'
          });
          return;
        }

        const response = await fetch(apiUrl('/api/captcha/config'), { cache: 'no-store' });
        if (!response.ok) throw new Error('Не удалось получить настройки сервера.');
        const config = await response.json();
        if (cancelled) return;

        setSiteKey(config.siteKey || '');
        setConfigured(Boolean(config.configured && config.siteKey));
        if (!config.configured || !config.siteKey) {
          setStatus({ kind: 'error', text: 'Сервис ещё не настроен. Проверьте ключи и секретную строку в backend.' });
          return;
        }

        await loadTurnstile();
        if (cancelled || !containerRef.current || widgetRef.current !== null) return;

        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: config.siteKey,
          theme: 'light',
          action: 'reveal_secret',
          callback: (newToken) => {
            setToken(newToken);
            setStatus({ kind: 'ready', text: 'Проверка готова. Можно запросить сообщение.' });
          },
          'expired-callback': () => {
            setToken('');
            setStatus({ kind: 'error', text: 'Срок проверки истёк. Подождите, пока CAPTCHA обновится.' });
          },
          'error-callback': () => {
            setToken('');
            setStatus({ kind: 'error', text: 'Не удалось выполнить проверку. Обновите страницу или попробуйте позже.' });
          },
          'timeout-callback': () => {
            setToken('');
            setStatus({ kind: 'error', text: 'Время проверки истекло. Попробуйте ещё раз.' });
          }
        });
        setStatus({ kind: 'info', text: 'Завершите проверку, если Cloudflare попросит об этом.' });
      } catch (error) {
        if (!cancelled) setStatus({ kind: 'error', text: error.message || 'Не удалось загрузить CAPTCHA.' });
      }
    }

    initialize();
    return () => { cancelled = true; };
  }, []);

  async function requestSecret() {
    if (!token || busy) return;
    setBusy(true);
    setSecret('');
    setStatus({ kind: 'info', text: 'Проверяем токен на сервере…' });

    try {
      const response = await fetch(apiUrl('/api/captcha/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Сервер не подтвердил CAPTCHA. Обновите проверку и попробуйте снова.');
      }
      setSecret(data.secret || '');
      setToken('');
      setStatus({ kind: 'success', text: 'Проверка подтверждена сервером.' });
    } catch (error) {
      setToken('');
      setStatus({ kind: 'error', text: error.message || 'Запрос не выполнен.' });
      if (window.turnstile && widgetRef.current !== null) {
        try { window.turnstile.reset(widgetRef.current); } catch { /* widget may already have expired */ }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="panel" aria-labelledby="page-title">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <span className="brand-name">CAPTCHA GUARD</span>
          <span className="brand-label">ACCESS CHECK</span>
        </div>

        <div className="intro">
          <p className="eyebrow">ЗАЩИЩЁННЫЙ РЕСУРС</p>
          <h1 id="page-title">Подтвердите запрос</h1>
          <p className="subtitle">Пройдите проверку, чтобы открыть защищённое сообщение.</p>
        </div>

        <div className="verification-block">
          <div className="verification-title">
            <span>Проверка безопасности</span>
            <span className={`status-dot ${status.kind === 'success' ? 'is-success' : status.kind === 'error' ? 'is-error' : ''}`} />
          </div>
          <div className="widget-frame" ref={containerRef} aria-label="Cloudflare Turnstile CAPTCHA" />
          <p id="status" className={`status-message ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
        </div>

        <button
          id="verify-button"
          className="primary-button"
          type="button"
          onClick={requestSecret}
          disabled={!configured || !token || busy || Boolean(secret)}
        >
          {busy ? <><span className="spinner" /> Проверяем…</> : secret ? 'Доступ подтверждён' : 'Получить сообщение'}
          {!busy && !secret && <span aria-hidden="true">↗</span>}
        </button>

        {secret && (
          <section className="secret-card" aria-labelledby="secret-title">
            <div className="secret-heading">
              <span className="secret-check" aria-hidden="true">✓</span>
              <div>
                <p className="eyebrow">ДОСТУП РАЗРЕШЁН</p>
                <h2 id="secret-title">Защищённое сообщение</h2>
              </div>
            </div>
            <code id="secret-output" className="secret-value">{secret}</code>
          </section>
        )}

        <footer className="footer-row">
          <span>Защита Cloudflare Turnstile</span>
          <span>Ваша проверка подтверждается сервером</span>
        </footer>
      </section>
      <p className="page-note">Если проверка не отображается, разрешите скрипты и cookies для challenges.cloudflare.com.</p>
    </main>
  );
}
