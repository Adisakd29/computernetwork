# Cross-browser smoke test (Chromium, Firefox, WebKit/Safari engine).
# usage: BROWSER=firefox python3 tests/e2e/smoke.py <out-dir>   (server from tests/e2e/run.sh)
# Uses only standard Playwright input (no Chromium-only CDP), so it runs on all three engines.
import asyncio, os, sys
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'; ENGINE=os.environ.get('BROWSER','chromium')
ROUTES=['#/','#/learn','#/rooms','#/room/r1','#/results','#/search/subnet','#/lesson/w3/content','#/lesson/w3/pre','#/sims','#/sim/topology','#/sim/subnet','#/sim/crimp','#/sim/terminal','#/sim/troubleshoot','#/practice','#/me','#/app']
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
async def main():
    async with async_playwright() as p:
        bt=getattr(p,ENGINE); b=await bt.launch()
        print(f'== {ENGINE} {b.version}')
        for (w,h,phone) in [(390,844,True),(768,1024,True),(1366,768,False)]:
            opts={'viewport':{'width':w,'height':h},'has_touch':phone}
            if phone and ENGINE!='firefox' and w<600: opts['is_mobile']=True   # Firefox has no mobile emulation
            ctx=await b.new_context(**opts)
            r=await ctx.request.post(BASE+'/api/auth/login',data={'username':'s1','password':'Stud1234'},headers={'X-NetLab':'1'}); assert r.ok
            pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            probs=[]
            for rt in ROUTES:
                await pg.goto(BASE+'/'+rt); await pg.wait_for_timeout(1200)
                o=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); t=await pg.inner_text('#app')
                if o>0: probs.append(f'{rt} overflow {o}')
                if 'ไม่พบหน้านี้' in t or 'เปิดหน้านี้ไม่สำเร็จ' in t or 'โหลดสื่อนี้ไม่สำเร็จ' in t: probs.append(f'{rt} failed to open')
            check(not probs and not E,f'{w}x{h}: {len(ROUTES)} pages open, no horizontal overflow, no JS errors '+'; '.join(probs[:3]+E[:2]))
            act=(lambda s: pg.tap(s)) if phone else (lambda s: pg.click(s))
            if w<760:
                await pg.goto(BASE+'/#/learn'); await pg.wait_for_selector('.unitlist')
                await act('#hamb'); await pg.wait_for_timeout(300); o1=await pg.evaluate('document.body.classList.contains("drawer")')
                await act('#side .drawerclose'); await pg.wait_for_timeout(300); o2=await pg.evaluate('document.body.classList.contains("drawer")')
                check(o1 and not o2,'mobile menu opens and closes')
            await pg.goto(BASE+'/#/lesson/w5/pre'); await pg.wait_for_selector('.opt')
            await pg.locator('.qcard').nth(0).locator('label.opt').nth(1).click()
            check(await pg.locator('.qcard').nth(0).locator('input:checked').count()==1,'quiz answer can be selected')
            await pg.reload(); await pg.wait_for_selector('.opt'); await pg.wait_for_timeout(400)
            check(await pg.locator('.qcard').nth(0).locator('input:checked').count()==1,'answer draft survives reload')
            await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.fchip'); await pg.click('button:has-text("เริ่มฝึก")'); await pg.wait_for_selector('.bq')
            if await pg.locator('.bq label.opt').count(): await pg.locator('.bq label.opt').first.click()
            elif await pg.locator('.bq .obtn:not([disabled])').count(): await pg.locator('.bq .obtn:not([disabled])').first.click()
            elif await pg.locator('.bq select').count():
                for s_ in await pg.locator('.bq select').all(): await s_.select_option(index=1)
            else: await pg.locator('.bq input[type=text], .bq .cmdin').first.fill('x')
            await pg.click('button:has-text("ตรวจคำตอบ")'); await pg.wait_for_selector('.bqfb .verdict'); ok('practice question checked by the server')
            # simulators: tap/click alternatives to drag and drop
            await pg.goto(BASE+'/#/sim/topology'); await pg.wait_for_selector('[data-type="pc"]')
            await pg.evaluate("scrollBy(0, document.querySelector('[data-r=stage]').getBoundingClientRect().top - 60)")
            await act('[data-type="pc"]'); await pg.wait_for_timeout(150); bx=await pg.locator('.nls-topology-canvas').first.bounding_box()
            if phone: await pg.touchscreen.tap(bx['x']+bx['width']*0.4,bx['y']+bx['height']*0.5)
            else: await pg.mouse.click(bx['x']+bx['width']*0.4,bx['y']+bx['height']*0.5)
            await pg.wait_for_timeout(300); check(await pg.locator('[data-r=netl] [data-id]').count()>=1,'topology: device placed by tap/click (no drag needed)')
            vb0=await pg.locator('.nls-topology-canvas').first.get_attribute('viewBox')
            await act('[data-act="zin"]'); await pg.wait_for_timeout(200)
            check(await pg.locator('.nls-topology-canvas').first.get_attribute('viewBox')!=vb0,'topology: zoom button works')
            await pg.goto(BASE+'/#/learn'); await pg.goto(BASE+'/#/sim/crimp'); await pg.wait_for_timeout(1200)
            check(await pg.evaluate('document.documentElement.scrollWidth-innerWidth')<=0,'crimp simulator fits the screen')
            await pg.screenshot(path=f'{OUT}/smoke_{ENGINE}_{w}.png')
            await ctx.close()
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
    sys.exit(1 if issues else 0)
asyncio.run(main())
