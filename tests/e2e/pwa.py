# Part 5 (2.4): PWA (manifest, icons, service worker, offline, privacy of the cache, updates) + accessibility (axe WCAG 2.1 AA)
# usage: python3 tests/e2e/pwa.py <out-dir>    (server from tests/e2e/run.sh on 127.0.0.1:3990)
import asyncio, sys, json, os, io, re
from playwright.async_api import async_playwright
from PIL import Image
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
import subprocess, time, urllib.request, signal
SERVER=None
def server_up():
    try: return urllib.request.urlopen(BASE+'/healthz',timeout=1).read()==b'ok'
    except Exception: return False
def stop_server():
    # a real outage: Chromium's offline emulation does not apply to service-worker fetches, so stop the server instead
    for pid in subprocess.run(['pgrep','-f','^node server.js'],capture_output=True,text=True).stdout.split(): os.kill(int(pid),signal.SIGTERM)
    for _ in range(50):
        if not server_up(): return
        time.sleep(0.1)
def start_server():
    global SERVER
    env=dict(os.environ, PORT='3990', DATABASE_URL=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e'), APP_SECRET='e2e', ADMIN_USERNAME='admin', ADMIN_PASSWORD='admin-pass-123')
    SERVER=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=open(os.path.join(OUT,'server-restart.log'),'w'),stderr=subprocess.STDOUT)
    for _ in range(100):
        if server_up(): return
        time.sleep(0.1)
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok
CACHE_DUMP="""async()=>{ const out={}; for(const k of await caches.keys()){ const c=await caches.open(k); out[k]=[]; for(const r of await c.keys()){ const res=await c.match(r); const t=res.headers.get('content-type')||''; out[k].push({url:new URL(r.url).pathname, body:t.includes('json')?await res.clone().text():''}); } } return out; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== manifest and icons')
        ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
        r=await ctx.request.get(BASE+'/manifest.webmanifest'); m=await r.json()
        check(r.headers['content-type'].startswith('application/manifest+json'),'manifest served as application/manifest+json')
        check(m['display']=='standalone' and m['start_url'].startswith('/') and m['scope']=='/' and m['short_name'] and m['name'],'manifest: name, short_name, start_url, scope, display standalone')
        sizes={}
        for ic in m['icons']:
            rr=await ctx.request.get(BASE+ic['src']); im=Image.open(io.BytesIO(await rr.body())); sizes[(ic['src'],ic.get('purpose'))]=im.size
            if f'{im.size[0]}x{im.size[1]}'!=ic['sizes']: bad(f'icon {ic["src"]} is {im.size}, manifest says {ic["sizes"]}')
        check(any(s==(512,512) for s in sizes.values()) and any(k[1]=='maskable' for k in sizes),'icons: 192 and 512 px, including maskable, real sizes match')
        rr=await ctx.request.get(BASE+'/icons/apple-touch-icon.png'); check(rr.ok and Image.open(io.BytesIO(await rr.body())).size==(180,180),'apple-touch-icon 180x180 for iPhone/iPad')
        print('== service worker, offline reading, privacy')
        await login(ctx,'s1','Stud1234')
        pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.cont')
        await pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
        await pg.reload(); await pg.wait_for_selector('.cont')
        check(await pg.evaluate('!!navigator.serviceWorker.controller'),'service worker installed and controls the page')
        # use the app online: lesson content, a pre-test page, practice, profile (personal data)
        await pg.goto(BASE+'/#/lesson/w3/content'); await pg.wait_for_selector('.lsec')
        await pg.goto(BASE+'/#/lesson/w3/pre'); await pg.wait_for_selector('.qcard')
        await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip'); await pg.tap('button:has-text("เริ่มฝึก")'); await pg.wait_for_selector('.bq')
        await pg.goto(BASE+'/#/me'); await pg.wait_for_selector('.ghero')
        await pg.goto(BASE+'/#/sim/subnet'); await pg.wait_for_timeout(1500)
        dump=await pg.evaluate(CACHE_DUMP)
        urls=[x['url'] for v in dump.values() for x in v]
        check(any(k.startswith('netlab-shell-') for k in dump) and '/js/app.js' in urls and '/index.html' in urls,'app shell is cached')
        leaked=[u for u in urls if re.match(r'^/api/(me|auth|practice|exams|game|teacher|sims|account|labs|check|lessons/w\d+/)',u)]
        check(not leaked,'no personal data, practice/exam questions, simulators or answers in the cache '+str(leaked[:5]))
        lesson=[x for v in dump.values() for x in v if x['url']=='/api/lessons/w3']
        body=json.loads(lesson[0]['body']) if lesson else {}
        check(lesson and 'sections' in body and 'quiz' not in body and 'quizPost' not in body,'cached lesson keeps the content but not the pre/post-test items')
        allbody=' '.join(x['body'] for v in dump.values() for x in v)
        check('"explain"' not in allbody and '"correct"' not in allbody and 'Stud1234' not in allbody and 'สมชาย' not in allbody,'cached data contains no answer keys, explanations or the student name')
        # offline (server unreachable)
        stop_server()
        await pg.goto(BASE+'/#/'); await pg.reload(); await pg.wait_for_timeout(2500)
        check(await pg.locator('#app').inner_text()!='' and await pg.locator('#netbar').is_visible(),'offline: app opens from the home screen and shows the offline bar')
        await pg.goto(BASE+'/#/lesson/w3/content'); await pg.wait_for_selector('.lsec',timeout=8000)
        check(await pg.locator('.lsec').count()>=5 and await pg.locator('.dgm svg').count()>=1,'offline: a lesson opened before is readable with diagrams')
        await pg.goto(BASE+'/#/lesson/w3/pre'); await pg.reload(); await pg.wait_for_timeout(1500)
        check('ต้องเชื่อมต่ออินเทอร์เน็ต' in await pg.inner_text('#app'),'offline: pre-test asks for internet (tests are not stored on the device)')
        await pg.goto(BASE+'/#/lesson/w11/content'); await pg.reload(); await pg.wait_for_timeout(1500)
        t=await pg.inner_text('#app'); check('ต้องเชื่อมต่ออินเทอร์เน็ต' in t or 'ไม่สำเร็จ' in t,'offline: a lesson never opened shows a clear message')
        await pg.goto(BASE+'/#/practice'); await pg.reload(); await pg.wait_for_timeout(1500)
        check('ต้องเชื่อมต่ออินเทอร์เน็ต' in await pg.inner_text('#app'),'offline: practice explains it needs internet')
        await pg.goto(BASE+'/#/app'); await pg.wait_for_selector('.offtable')
        check(await pg.locator('.offtable tr').count()>=8,'offline help page lists what works offline')
        await pg.screenshot(path=f'{OUT}/pwa_390_offline_help.png')
        start_server(); await pg.reload(); await pg.wait_for_selector('.offtable'); await pg.wait_for_timeout(800)
        check(not await pg.locator('#netbar').is_visible() and 'สมชาย' in await pg.inner_text('#side'),'back online: offline bar disappears and the student is signed in again')
        # download all lessons
        await pg.goto(BASE+'/#/app'); await pg.wait_for_selector('.offtable')
        await pg.tap('button:has-text("ดาวน์โหลดบทเรียนทั้ง 18")'); await pg.wait_for_function("document.querySelector('[aria-live]') && /พร้อมอ่านออฟไลน์ 18/.test(document.body.innerText)",timeout=20000)
        ok('"ดาวน์โหลดบทเรียน" stores all 18 weeks for offline reading')
        stop_server(); await pg.goto(BASE+'/#/lesson/w11/content'); await pg.reload(); await pg.wait_for_selector('.lsec',timeout=8000); ok('offline: week 11 readable after download'); start_server()
        # logout keeps nothing personal
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.cont')
        await pg.evaluate("logout()"); await pg.wait_for_timeout(800)
        dump2=await pg.evaluate(CACHE_DUMP); all2=' '.join(x['url']+x['body'] for v in dump2.values() for x in v)
        check('สมชาย' not in all2,'after logout the cache holds nothing about the student')
        check(not E,'no JS errors: '+'; '.join(E[:2]))
        print('== update flow')
        f=os.path.join(ROOT,'public','js','pwa.js'); orig=open(f).read()
        try:
            open(f,'w').write(orig+'\n/* test change */\n')
            await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
            await pg.wait_for_selector('.updbar',timeout=15000); ok('a new version shows "มี NetLab เวอร์ชันใหม่"')
            v1=await pg.evaluate("caches.keys().then(k=>k.filter(x=>x.startsWith('netlab-shell-')).join(','))")
            async with pg.expect_navigation(timeout=15000): await pg.tap('.updbar button:has-text("อัปเดตตอนนี้")')
            await pg.wait_for_timeout(1500)
            v2=await pg.evaluate("caches.keys().then(k=>k.filter(x=>x.startsWith('netlab-shell-')).join(','))")
            check(v1!=v2 and v2.count('netlab-shell-')==1,'"อัปเดตตอนนี้" reloads with the new version and removes the old cache')
        finally:
            open(f,'w').write(orig)
        await ctx.close()

        print('== accessibility: axe-core WCAG 2.1 A/AA, keyboard')
        AXE=open(AXE_PATH).read() if os.path.exists(AXE_PATH) else None
        if AXE:
            res=[]
            for theme in ['light','dark']:
                c=await b.new_context(viewport={'width':1280,'height':900},color_scheme=theme); await login(c,'s1','Stud1234'); cp=await c.new_page()
                for rt in ['#/','#/learn','#/rooms','#/room/r1','#/results','#/lesson/w3','#/lesson/w3/pre','#/lesson/w3/content','#/lesson/w13/content','#/sims','#/sim/topology','#/sim/subnet','#/sim/crimp','#/sim/terminal','#/sim/troubleshoot','#/practice','#/exams','#/me','#/app']:
                    await cp.goto(BASE+'/'+rt); await cp.wait_for_timeout(1100); await cp.add_script_tag(content=AXE)
                    v=await cp.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}")
                    if v: res.append(f'{theme} {rt}: {v}')
                await c.close()
            for r_ in res[:12]: print('     ',r_[:300])
            check(not res,f'axe-core WCAG 2.1 AA: no violations on 19 pages x 2 themes ({len(res)} pages with problems)')
        c=await b.new_context(viewport={'width':1280,'height':900}); kp=await c.new_page(); await kp.goto(BASE+'/#/learn'); await kp.wait_for_selector('.unitlist')
        await kp.keyboard.press('Tab'); f1=await kp.evaluate("document.activeElement.className")
        check('skip' in f1,'first Tab reaches "ข้ามไปยังเนื้อหาหลัก" (skip link)')
        await kp.keyboard.press('Enter'); await kp.wait_for_timeout(200)
        check(await kp.evaluate("document.activeElement.id")=='app' and (await kp.evaluate('location.hash'))=='#/learn','skip link moves focus to the content without changing the page')
        await kp.keyboard.press('Tab'); st=await kp.evaluate("getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth")
        check(not st.startswith('none'),'keyboard focus is visible ('+st+')')
        rm=await b.new_context(viewport={'width':1280,'height':900},reduced_motion='reduce'); rp=await rm.new_page(); await rp.goto(BASE+'/#/'); await rp.wait_for_selector('.cont')
        d=await rp.evaluate("getComputedStyle(document.querySelector('.shell')).transitionDuration")
        check(all(float(x.strip()[:-1] or 0)<=0.001 for x in d.split(',')),'reduced motion: transitions switched off ('+d+')')
        await b.close()
    if SERVER: SERVER.terminate()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
asyncio.run(main())

sys.exit(1 if issues else 0)
