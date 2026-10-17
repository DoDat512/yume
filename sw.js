/* Yume Writing service worker: ưu tiên bản mới từ mạng, mất mạng thì dùng bản đã lưu */
const CACHE='yume-v1';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;
  e.respondWith(
    fetch(r).then(res=>{
      if(res&&res.ok){
        const copy=res.clone();
        // trang mở kèm ?text=... (từ nút Share) vẫn lưu chung một bản index.html
        const key=r.mode==='navigate'?'./index.html':r;
        caches.open(CACHE).then(c=>c.put(key,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>
      caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))
    )
  );
});
