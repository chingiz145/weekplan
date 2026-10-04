// WeekPlan Service Worker — офлайн-режим и установка как приложение
const CACHE = 'weekplan-v4';

// Файлы оболочки приложения (кэшируются для работы офлайн)
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

// Установка — кэшируем оболочку
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// Активация — чистим старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Запросы:
//  - к Supabase и другим API — всегда через сеть (данные должны быть свежими)
//  - к оболочке — network-first, с откатом в кэш при отсутствии сети
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Данные и внешние API не кэшируем
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('api.anthropic.com') ||
      req.method !== 'GET') {
    return; // пусть идёт напрямую в сеть
  }

  // Google Fonts — cache-first (стабильны)
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => cached))
    );
    return;
  }

  // Оболочка приложения — network-first
  event.respondWith(
    fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
  );
});
