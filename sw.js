/* Service worker do app de Chopeiras.

   Serve para a aplicação abrir sem rede depois de instalada. Nada mais.

   A estratégia é deliberada, por causa de uma armadilha conhecida: um
   service worker que serve primeiro da cache faz a página velha continuar
   a aparecer depois de publicada uma correção, e o sintoma é
   indistinguível de um erro no código.

     - Navegação (o HTML): rede primeiro, cache só se a rede falhar.
     - Ficheiros fixos (ícones, manifesto): cache primeiro, com
       atualização em segundo plano.

   O SDK do Firebase e as chamadas ao Firestore NÃO passam por aqui: o
   próprio Firestore guarda os dados no aparelho (enablePersistence).

   Ao mudar a aplicação, incrementar VERSAO — as caches antigas são
   apagadas no activate — e atualizar o número em #versaoApp no index.html.
*/
const VERSAO = 'chopeiras-v5';
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './icone-mascara.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Firebase e fontes passam direto

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(VERSAO).then(c => c.put('./index.html', copia));
          return r;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cacheado => {
      const rede = fetch(req).then(r => {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return r;
      }).catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
