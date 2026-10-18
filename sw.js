/* Yume. Writing service worker
   - Ưu tiên bản mới từ mạng, mất mạng thì dùng bản đã lưu
   - Nhận nội dung chia sẻ (POST /share-target): lưu tạm vào Cache 'yume-share' rồi chuyển về trang chính */
const CACHE='yume-v2';
const SHARE='yume-share';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==SHARE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function handleShare(r){
  try{
    const fd=await r.formData();
    const c=await caches.open(SHARE);
    for(const k of await c.keys())await c.delete(k);
    const meta={title:String(fd.get('title')||''),text:String(fd.get('text')||''),url:String(fd.get('url')||''),files:[],t:Date.now()};
    let i=0;
    for(const f of fd.getAll('files')){
      if(!f||typeof f==='string'||(!f.size&&!f.name))continue;   // bỏ phần file rỗng
      const key=new URL('./shared/'+(i++),self.registration.scope).href;
      await c.put(key,new Response(f,{headers:{'Content-Type':f.type||'application/octet-stream'}}));
      meta.files.push({key:key,name:f.name||('tep-'+i),type:f.type||'',size:f.size});
    }
    await c.put(new URL('./shared/meta',self.registration.scope).href,new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json'}}));
  }catch(err){}
  return Response.redirect(new URL('./?yshare=1',self.registration.scope).href,303);
}

self.addEventListener('fetch',e=>{
  const r=e.request;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;
  if(r.method==='POST'&&u.pathname.endsWith('/share-target')){
    e.respondWith(handleShare(r));
    return;
  }
  if(r.method!=='GET')return;
  e.respondWith(
    fetch(r).then(res=>{
      if(res&&res.ok){
        const copy=res.clone();
        // trang mở kèm ?text=... hoặc ?yshare=1 vẫn lưu chung một bản index.html
        const key=r.mode==='navigate'?'./index.html':r;
        caches.open(CACHE).then(c=>c.put(key,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>
      caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))
    )
  );
});
