(() => {
  'use strict';
  const script = document.currentScript;
  const optional = script.dataset.optional === 'true';
  const nativeUI = script.dataset.nativeUi === 'true';
  const cookies = script.dataset.cookies === 'true';
  const title = script.dataset.project;
  const base = new URL('./', script.src).pathname;
  const key = 'pages-service:' + base;
  let server = '';
  try { server = localStorage.getItem(key) || ''; } catch {}
  const normalize = value => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('请填写不带账号、参数或密钥的 HTTPS 服务地址。');
    return url.href.replace(/\/$/, '');
  };
  try { if (server) server = normalize(server); } catch { server = ''; }
  const paths = /^\/(?:api|admin|member|v1|health|config|media|uploads|files|oauth)(?:\/|$)/;
  function endpoint(value) {
    const url = new URL(value, location.href);
    const apiPath = url.pathname.startsWith(base) ? '/' + url.pathname.slice(base.length) : url.pathname;
    return server && url.origin === location.origin && paths.test(apiPath) ? server + apiPath + url.search : url.href;
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const target = endpoint(url);
    if (target === new URL(url, location.href).href) return originalFetch(input, init);
    const request = input instanceof Request ? new Request(target, input) : target;
    return originalFetch(request, { ...init, credentials: cookies ? 'include' : 'omit' });
  };
  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) window.EventSource = class extends OriginalEventSource {
    constructor(url, options) { super(endpoint(url), { ...options, withCredentials: cookies }); }
  };
  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) window.WebSocket = class extends OriginalWebSocket {
    constructor(value, protocols) {
      const url = new URL(value, location.href);
      const own = url.host === location.host;
      const target = own && server ? server.replace(/^https:/, 'wss:') + url.pathname + url.search : value;
      if (protocols === undefined) super(target); else super(target, protocols);
    }
  };
  const remap = node => {
    if (!(node instanceof Element)) return;
    for (const element of [node, ...node.querySelectorAll('[src],[href]')]) {
      for (const attr of ['src', 'href']) {
        const value = element.getAttribute(attr);
        if (server && value && /^\/(?:media|uploads|files)\//.test(value)) element.setAttribute(attr, endpoint(value));
      }
    }
  };
  let started = false;
  async function start() {
    if (started) return;
    started = true;
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(remap))).observe(document.body, { childList: true, subtree: true });
    for (const source of document.querySelectorAll('script[data-pages-script]')) {
      const next = document.createElement('script');
      for (const attr of source.attributes) if (!['type','data-pages-script','data-original-type'].includes(attr.name)) next.setAttribute(attr.name, attr.value);
      if (source.dataset.originalType) next.type = source.dataset.originalType;
      next.textContent = source.textContent;
      next.async = false;
      const loaded = next.src ? new Promise((resolve,reject) => { next.onload = resolve; next.onerror = reject; }) : Promise.resolve();
      source.replaceWith(next);
      await loaded;
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (nativeUI) { start().catch(console.error); return; }
    const style = document.createElement('style');
    style.textContent = '#pages-connect{font:15px/1.7 system-ui;color:#17252a;border:1px solid #c7dad4;border-radius:16px;background:#fff;padding:28px;max-width:580px;margin:40px auto;box-shadow:0 12px 60px #1232}#pages-connect input{display:block;box-sizing:border-box;width:100%;padding:12px;border:1px solid #9eb7af;border-radius:8px;font:inherit}#pages-connect button,#pages-service-button{font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#215e50;color:white;cursor:pointer}#pages-connect button{margin-top:16px}#pages-connect p{margin:12px 0}#pages-service-button{position:fixed;right:12px;bottom:12px;z-index:2147483646}#pages-connect:modal{z-index:2147483647}';
    document.head.append(style);
    const dialog = document.createElement('dialog');
    dialog.id = 'pages-connect';
    dialog.innerHTML = '<form><h2></h2><p>此网页需要连接已部署的服务，才能使用账号、共享数据和在线功能。服务地址只保存在当前浏览器。</p><label>HTTPS 服务地址<input type="url" required placeholder="https://service.example.com" autocomplete="url"></label><p role="alert"></p><button type="submit">保存并连接</button><p><small>服务需允许来自 ' + location.origin + ' 的跨域请求；使用 Cookie 登录时还需允许跨站凭据。请在应用原有登录页输入账号。</small></p></form>';
    dialog.querySelector('h2').textContent = title + ' · 连接服务';
    dialog.querySelector('input').value = server;
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      try { const value = normalize(dialog.querySelector('input').value); localStorage.setItem(key, value); location.reload(); }
      catch (error) { dialog.querySelector('[role=alert]').textContent = error.message; }
    });
    dialog.addEventListener('cancel', event => { if (!optional && !server) event.preventDefault(); });
    document.body.append(dialog);
    const button = document.createElement('button');
    button.id = 'pages-service-button';
    button.textContent = server ? '服务连接设置' : optional ? '连接行情服务' : '连接服务';
    button.addEventListener('click', () => dialog.showModal());
    document.body.append(button);
    if (!optional && !server) dialog.showModal(); else start().catch(() => { dialog.showModal(); dialog.querySelector('[role=alert]').textContent = '应用文件加载失败，请刷新或检查网络。'; });
  });
})();
