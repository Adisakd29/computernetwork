# Responsive + touch test (NetLab 2.4). Needs the server from tests/e2e/run.sh (accounts s1/Stud1234, kru4/Teach1234).
# usage: python3 tests/e2e/responsive.py <out-dir>
import asyncio, sys, re
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
VP=[(360,800),(800,360),(390,844),(844,390),(430,932),(932,430),(768,1024),(1024,768),(820,1180),(1180,820),(1366,768)]
ROUTES=['#/','#/learn','#/rooms','#/room/r1','#/results','#/search/subnet','#/search/ไม่มีคำนี้','#/lesson/w3','#/lesson/w3/pre','#/lesson/w3/content','#/lesson/w3/lab','#/lesson/w3/post','#/lesson/w3/summary',
  '#/sims','#/sim/topology','#/sim/subnet','#/sim/crimp','#/sim/terminal','#/sim/troubleshoot','#/practice','#/exams','#/me']
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
PROBE=r"""
() => {
  const W=innerWidth, out={overflow:document.documentElement.scrollWidth-W, overlap:[]};
  const vis=e=>{ const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&r.bottom>0&&r.top<innerHeight*4; };
  const pinned=e=>{ for(let p=e;p&&p!==document.body;p=p.parentElement){ const ps=getComputedStyle(p).position; if(ps==='fixed'||ps==='sticky') return true; } return false; };
  const name=e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
  const ctl=[...document.querySelectorAll('#app a[href],#app button,#app input:not([type=hidden]),#app select,#app textarea')].filter(e=>vis(e)&&!pinned(e)&&!e.closest('svg'));
  const rs=ctl.map(e=>[e,e.getBoundingClientRect()]);
  for(let i=0;i<rs.length;i++) for(let j=i+1;j<rs.length;j++){ const [a,ra]=rs[i],[b,rb]=rs[j]; if(a.contains(b)||b.contains(a)) continue;
    const ix=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left), iy=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);
    if(ix>3&&iy>3) out.overlap.push(name(a)+' & '+name(b)); }
  out.overlap=[...new Set(out.overlap)].slice(0,4);
  return out;
}"""
async def login(ctx,u='s1',p='Stud1234'):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok
def phone(w,h): return w<760 or (h<=500 and w<=1000)

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== every route at 11 viewports (overflow, overlapping controls, JS errors)')
        for (w,h) in VP:
            ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=w<1200,is_mobile=w<600); await login(ctx)
            pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            nbad=0
            for rt in ROUTES:
                await pg.goto(BASE+'/'+rt); await pg.wait_for_timeout(1100)
                d=await pg.evaluate(PROBE)
                if d['overflow']>0: bad(f'{w}x{h} {rt} page overflows {d["overflow"]}px'); nbad+=1
                if d['overlap']: bad(f'{w}x{h} {rt} overlap: {d["overlap"]}'); nbad+=1
                if E: bad(f'{w}x{h} {rt} JS error {E[0][:90]}'); E.clear(); nbad+=1
            if not nbad: ok(f'{w}x{h}: {len(ROUTES)} routes open, no overflow, no overlapping controls, no JS errors')
            if w in (390,768,1366) and h in (844,1024,768):
                for rt,n in [('#/','home'),('#/lesson/w3/content','lesson'),('#/results','results'),('#/practice','practice')]:
                    await pg.goto(BASE+'/'+rt); await pg.wait_for_timeout(1200); await pg.screenshot(path=f'{OUT}/r_{w}x{h}_{n}.png')
            await ctx.close()

        print('== phone navigation (390x844, touch)')
        ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(ctx)
        pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/learn'); await pg.wait_for_selector('.unitlist')
        check(await pg.locator('#bnav').is_visible(),'bottom navigation visible on phone')
        check(await pg.locator('#bnav a.on').inner_text()=='บทเรียน','bottom nav marks the current section')
        for i in range(3):
            await pg.tap('#hamb'); await pg.wait_for_timeout(300)
            if i==0:
                check(await pg.evaluate('document.body.classList.contains("drawer")'),'hamburger opens the drawer')
                check(await pg.evaluate('getComputedStyle(document.documentElement).overflow')=='hidden','page behind the drawer does not scroll')
                check(await pg.locator('#side .drawerclose').is_visible(),'drawer has a visible close button')
                await pg.screenshot(path=f'{OUT}/r_390_drawer.png')
            await pg.tap('#side .drawerclose') if i==0 else (await pg.touchscreen.tap(370,400) if i==1 else await pg.keyboard.press('Escape'))
            await pg.wait_for_timeout(300)
            check(not await pg.evaluate('document.body.classList.contains("drawer")'),['close button','tap outside','Escape'][i]+' closes the drawer')
        check(await pg.locator('#hamb').is_visible(),'hamburger still there after repeated open/close')
        await pg.tap('#bnav button'); await pg.wait_for_timeout(300); check(await pg.evaluate('document.body.classList.contains("drawer")'),'bottom-nav "เมนู" opens the drawer')
        await pg.locator('#side a.nav',has_text='ห้องฝึก').tap(); await pg.wait_for_timeout(600)
        check(not await pg.evaluate('document.body.classList.contains("drawer")') and (await pg.evaluate('location.hash'))=='#/rooms','drawer closes after choosing a page')
        check(await pg.evaluate('getComputedStyle(document.documentElement).overflow')!='hidden','page scroll restored')
        await pg.tap('#bnav a:has-text("จำลอง")'); await pg.wait_for_timeout(800); check((await pg.evaluate('location.hash'))=='#/sims','bottom nav navigates')
        # last control not hidden behind the bottom nav
        await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip'); await pg.evaluate('window.scrollTo(0,document.body.scrollHeight)'); await pg.wait_for_timeout(300)
        r=await pg.locator('button:has-text("เริ่มฝึก")').bounding_box(); nav=await pg.locator('#bnav').bounding_box()
        check(r['y']+r['height']<=nav['y'],'last button on a long page is above the bottom nav')
        # search
        await pg.tap('#hamb'); await pg.fill('#side .sidesearch input','ซับเน็ต'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800)
        th=await pg.inner_text('#app'); check('ไม่พบ' in th or 'subnet' in th.lower() or 'ซับเน็ต' in th,'search with Thai word + Enter shows results or an empty state')
        await pg.goto(BASE+'/#/search/subnet'); await pg.wait_for_timeout(600); check(await pg.locator('#app a[href^="#/lesson/"]').count()>0,'search "subnet" finds lessons')
        # login modal on a small phone (guest)
        g=await b.new_context(viewport={'width':360,'height':640},has_touch=True,is_mobile=True); gp=await g.new_page()
        await gp.goto(BASE+'/#/'); await gp.wait_for_selector('.mtop'); await gp.locator('.mtop .sbtn').tap(); await gp.wait_for_selector('.modal-back form')
        bx=await gp.locator('.modal-back .modal, .modal-back > *').first.bounding_box()
        check(bx['x']>=0 and bx['x']+bx['width']<=360,'login modal fits a 360px screen')
        check(await gp.locator('.modal-back input').count()==2 and await gp.locator('.modal-back button[type=submit]').is_visible(),'login modal shows username, password and submit')
        await gp.screenshot(path=f'{OUT}/r_360_login.png'); await g.close()
        check(not E,'no JS errors in navigation tests '+'; '.join(E[:2]))

        print('== orientation change and reload keep work (lesson pre-test)')
        await pg.goto(BASE+'/#/lesson/w5/pre'); await pg.wait_for_selector('.opt')
        opts=pg.locator('.qcard').nth(0).locator('label.opt'); await opts.nth(1).tap()
        await pg.locator('.qcard').nth(1).locator('label.opt').nth(0).tap(); await pg.wait_for_timeout(300)
        sel=lambda: pg.evaluate('[...document.querySelectorAll(".qcard")].slice(0,2).map(c=>[...c.querySelectorAll("input")].findIndex(i=>i.checked))')
        before=await sel()
        await pg.set_viewport_size({'width':844,'height':390}); await pg.wait_for_timeout(500)
        check(await sel()==before,'rotate to landscape: answers still selected')
        check(await pg.evaluate('document.documentElement.scrollWidth-innerWidth')<=0,'landscape: no overflow')
        await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(400)
        check(await sel()==before,'rotate back: answers still selected')
        await pg.reload(); await pg.wait_for_selector('.opt'); await pg.wait_for_timeout(500)
        check(await sel()==before,'reload: draft answers restored')
        await ctx.close()

        print('== tablet sidebar rail (768x1024 and 1024x768)')
        for (w,h,default) in [(768,1024,True),(1024,768,False)]:
            t=await b.new_context(viewport={'width':w,'height':h},has_touch=True); await login(t); tp=await t.new_page()
            await tp.goto(BASE+'/#/learn'); await tp.wait_for_selector('.unitlist')
            rail=await tp.evaluate('document.body.classList.contains("siderail")'); check(rail==default,f'{w}x{h}: sidebar starts {"collapsed" if default else "expanded"}')
            side=await tp.locator('#side').bounding_box(); main=await tp.locator('#app').bounding_box()
            check(main['x']>=side['x']+side['width']-1,f'{w}x{h}: sidebar does not cover the content')
            await tp.tap('#side .railbtn'); await tp.wait_for_timeout(400)
            check(await tp.evaluate('document.body.classList.contains("siderail")')!=rail,f'{w}x{h}: toggle button collapses/expands the sidebar')
            await tp.reload(); await tp.wait_for_selector('.unitlist')
            check(await tp.evaluate('document.body.classList.contains("siderail")')!=rail,f'{w}x{h}: choice remembered after reload')
            if w==768:
                await tp.evaluate('localStorage.setItem("netlab-rail","1")'); await tp.reload(); await tp.wait_for_selector('.unitlist')
                lbl=await tp.locator('#side a.nav').first.get_attribute('aria-label'); check(bool(lbl),'rail icons have accessible names')
                await tp.screenshot(path=f'{OUT}/r_768_rail.png')
                await tp.set_viewport_size({'width':1024,'height':768}); await tp.wait_for_timeout(400)
                check(await tp.locator('.unitlist').count()==1,'rotating the tablet keeps the page')
            await t.close()

        print('== touch interactions in simulators (390x844)')
        ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(ctx)
        pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/sim/topology'); await pg.wait_for_selector('[data-type="pc"]')
        cv=pg.locator('.nls-topology-canvas').first
        await cv.scroll_into_view_if_needed(); box=await cv.bounding_box()
        await pg.evaluate("scrollBy(0, document.querySelector('[data-r=stage]').getBoundingClientRect().top - 60)"); await pg.wait_for_timeout(200)
        for typ,fx in [('pc',0.3),('switch',0.7)]:
            await pg.tap(f'[data-type={typ}]'); await pg.wait_for_timeout(150); box=await cv.bounding_box()   # tapping may scroll: measure again
            await pg.touchscreen.tap(box['x']+box['width']*fx,box['y']+box['height']*0.5); await pg.wait_for_timeout(300)
        box=await cv.bounding_box()
        n=await pg.evaluate('document.querySelectorAll("[data-r=netl] [data-id]").length'); check(n>=2,f'topology: tap palette then tap canvas placed devices ({n})')
        vb0=await cv.get_attribute('viewBox'); cdp=await ctx.new_cdp_session(pg)
        cx,cy=box['x']+box['width']/2,box['y']+box['height']/2
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-30,'y':cy,'id':1},{'x':cx+30,'y':cy,'id':2}]})
        for k in range(1,8): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-30-k*12,'y':cy,'id':1},{'x':cx+30+k*12,'y':cy,'id':2}]})
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(300)
        vb1=await cv.get_attribute('viewBox'); check(vb1!=vb0 and float(vb1.split()[2])<float(vb0.split()[2]),'topology: pinch-out zooms in')
        await pg.screenshot(path=f'{OUT}/r_390_topology.png')
        await pg.goto(BASE+'/#/sim/crimp'); await pg.wait_for_selector('.nls-crimp-root, [class^="nls-crimp"]'); await pg.wait_for_timeout(500)
        check(await pg.evaluate('document.documentElement.scrollWidth-innerWidth')<=0,'crimp: fits the phone')
        await pg.screenshot(path=f'{OUT}/r_390_crimp.png')
        check(not E,'no JS errors in simulator touch tests '+'; '.join(E[:2]))
        await ctx.close()

        print('== teacher dashboard on phone')
        t=await b.new_context(viewport={'width':360,'height':800},has_touch=True,is_mobile=True); await login(t,'kru4','Teach1234'); tp=await t.new_page()
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('#menuToggle'); await tp.tap('#menuToggle'); await tp.locator('.side .navbtn').nth(1).tap(); await tp.wait_for_selector('.tabs')
        for tab in ['คะแนนแล็บ','วิเคราะห์ผล','การสอบ','ห้องจำลอง','นักเรียน','ตั้งค่าห้อง']:
            await tp.locator('.tabs button',has_text=tab).tap(); await tp.wait_for_timeout(700)
            o=await tp.evaluate('document.documentElement.scrollWidth-innerWidth');
            if o>0: bad(f'teacher {tab} overflows {o}px')
        ok('teacher tabs checked at 360px'); await tp.screenshot(path=f'{OUT}/r_360_teacher.png'); await t.close()
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
asyncio.run(main())

sys.exit(1 if issues else 0)
