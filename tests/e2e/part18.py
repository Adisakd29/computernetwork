# Part 18: real device photos (photo / photos lesson blocks) in a real browser.
# The photo loads (phone-size copy through srcset), numbered markers match the legend, the credit links to the Commons file page,
# tapping the photo opens an accessible lightbox (dialog, Esc closes, focus returns), the credits page lists the photo and
# where it is used, long cache headers, the service worker keeps a viewed photo, no horizontal scroll at 390 and 1366 px,
# light and dark themes, axe-core on the lesson section.
# usage: E2E_BASE=http://127.0.0.1:3990 python3 tests/e2e/part18.py <out-dir>   (guests can read every week; no login needed)
import asyncio, sys, os, json, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/tmp/netlab-e2e'; os.makedirs(OUT,exist_ok=True)
BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AXE_PATH=os.path.join(ROOT,'node_modules','axe-core','axe.min.js')
AXE_RUN="async(sel)=>{const r=await axe.run(document.querySelector(sel),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '))}"
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
# the photo under test and the lesson section that shows it, read from the server's own lesson data
INFO=json.loads(subprocess.check_output(['node','-e',r"""
const L = require('./server/lessons'); const P = require('./content/photos');
let hit = null;
for (const [lid, js] of L.PUBLIC) { const j = JSON.parse(js); for (const s of j.sections) for (const b of s.blocks)
  if (!hit && b.type === 'photo' && b.items.some(i => i.id === 'crimper-rj45')) hit = { lesson: lid, section: s.id, name: b.name, item: b.items.find(i => i.id === 'crimper-rj45') }; }
console.log(JSON.stringify(hit));"""],cwd=ROOT))
URL=f"{BASE}/#/lesson/{INFO['lesson']}/content/{INFO['section']}" if INFO else BASE

async def axe(pg,sel,name):
    await pg.add_script_tag(path=AXE_PATH); v=await pg.evaluate(AXE_RUN,sel)
    check(not v,f'axe-core WCAG 2.1 AA: {name} '+('; '.join(v[:3])))

async def run(b,w,h,theme):
    tag=f'{w}-{theme}'
    print(f'== {w} px, {theme} theme')
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=w<500,is_mobile=w<500,color_scheme=theme)
    await ctx.add_init_script(f"try{{localStorage.setItem('netlab-theme','{theme}')}}catch(e){{}}")
    pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
    await pg.goto(URL); await pg.wait_for_selector('.lhead')
    fig=pg.locator('figure.photo').filter(has=pg.locator('img[src*="/photos/crimper-rj45"]')).first
    await fig.scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
    img=fig.locator('.phbox img').first
    await pg.wait_for_function("e=>e.complete&&e.naturalWidth>0",arg=await img.element_handle(),timeout=10000)
    d=await img.evaluate("e=>({nw:e.naturalWidth,cur:e.currentSrc,w:e.getAttribute('width'),h:e.getAttribute('height'),alt:e.alt,lazy:e.loading,srcset:e.srcset})")
    check(d['nw']>0,f'photo loads (naturalWidth {d["nw"]})')
    check(d['w']==str(INFO['item']['w']) and d['h']==str(INFO['item']['h']) and d['alt']==INFO['item']['alt'] and d['lazy']=='lazy','img has width, height, alt and loading=lazy')
    check('-800.jpg' in d['srcset'] and 'crimper-rj45.jpg' in d['srcset'],'srcset offers the phone-size and the large file')
    if w<500: check('-800.jpg' in d['cur'],f'phone loads the phone-size copy ({d["cur"].split("/")[-1]})')
    cr=fig.locator('.phcredit a').first
    href=await cr.get_attribute('href'); t=await cr.inner_text()
    check(href==INFO['item']['page'] and href.startswith('https://commons.wikimedia.org/wiki/File:'),'credit link points to the Commons file page')
    check(t==INFO['item']['commons'][len('File:'):] and await cr.get_attribute('rel')=='noopener' and await cr.get_attribute('target')=='_blank','credit link text is the file name, opens in a new tab with rel=noopener')
    ct=await fig.locator('.phcredit').first.inner_text()
    check(ct.startswith('ภาพถ่าย: Wikimedia Commons') and 'ดูชื่อผู้ถ่ายและสัญญาอนุญาตที่หน้าไฟล์' in ct,f'credit line: {ct[:90]}')
    # markers (this photo has none, so check the markers of any labelled photo on the page match its legend)
    mk=await pg.evaluate("""()=>{const it=[...document.querySelectorAll('.phitem')].find(i=>i.querySelector('.phmark'));if(!it)return null;
      const m=[...it.querySelectorAll('.phmark')];const r=m[0].getBoundingClientRect();const cs=getComputedStyle(m[0]);
      return {n:m.map(x=>x.textContent),aria:m.every(x=>x.getAttribute('aria-hidden')==='true'),leg:it.querySelectorAll('.phlegend li').length,w:r.width,h:r.height,bg:cs.backgroundColor,fg:cs.color}}""")
    if mk:
        check(mk['n']==[str(i+1) for i in range(len(mk['n']))] and mk['leg']==len(mk['n']),f'markers 1..{len(mk["n"])} match the legend items')
        check(mk['aria'] and mk['w']>=24 and mk['h']>=24,f'markers are aria-hidden and at least 24 px ({mk["w"]:.0f}x{mk["h"]:.0f}, {mk["fg"]} on {mk["bg"]})')
    # lightbox: tap the photo, Esc closes, focus returns to the zoom button of that photo
    await fig.locator('.phbox').first.click()
    dlg=pg.locator('.phov[role=dialog]'); await dlg.wait_for(timeout=3000)
    st=await pg.evaluate("()=>{const d=document.querySelector('.phov');const i=d.querySelector('img');return {modal:d.getAttribute('aria-modal'),label:d.getAttribute('aria-label'),focus:document.activeElement&&document.activeElement.className,src:i&&i.getAttribute('src')}}")
    check(st['modal']=='true' and st['label'] and 'phclose' in (st['focus'] or ''),'lightbox is a labelled modal dialog and focus moves to its close button')
    check(st['src'] and '/photos/crimper-rj45.jpg' in st['src'],'lightbox shows the large file')
    await pg.wait_for_function("()=>{const i=document.querySelector('.phov img');return i&&i.complete&&i.naturalWidth>0}",timeout=10000)
    await pg.screenshot(path=f'{OUT}/part18-lightbox-{tag}.png')
    await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab')
    check(await pg.evaluate("()=>document.querySelector('.phov').contains(document.activeElement)"),'Tab keeps focus inside the lightbox')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    check(await dlg.count()==0,'Esc closes the lightbox')
    check(await pg.evaluate("()=>document.activeElement&&document.activeElement.classList.contains('phzoom')&&!!document.activeElement.closest('.phitem').querySelector('img[src*=\"crimper-rj45\"]')"),'focus returns to the zoom button of the same photo')
    # the close button too
    await fig.locator('.phzoom').first.click(); await dlg.wait_for(timeout=3000); await pg.locator('.phov .phclose').click()
    check(await dlg.count()==0 and await pg.evaluate("()=>document.activeElement.classList.contains('phzoom')"),'close button closes the lightbox and returns focus')
    sw=await pg.evaluate("()=>document.documentElement.scrollWidth-window.innerWidth")
    check(sw<=0,f'no horizontal scroll (overflow {sw}px)')
    await fig.scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
    await fig.screenshot(path=f'{OUT}/part18-figure-{tag}.png')
    await pg.screenshot(path=f'{OUT}/part18-section-{tag}.png')
    # axe on every photo figure of the section (must be clean); the rest of the section is reported, not failed,
    # because it holds other helpers' widgets (known: the pinout widget's .nlw-scroll table, public/js/widgets.js)
    await pg.add_script_tag(path=AXE_PATH)
    v=await pg.evaluate("async()=>{const out=[];for(const f of document.querySelectorAll('figure.photo')){const r=await axe.run(f,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});out.push(...r.violations.map(v=>v.id+'('+v.impact+'):'+v.nodes.length+' '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | ')))}return out}")
    check(not v,f'axe-core WCAG 2.1 AA: every photo figure in {INFO["lesson"]} {INFO["section"]} ({tag}) '+('; '.join(v[:3])))
    v=await pg.evaluate(AXE_RUN,'#app')
    if v: print(f'  ! axe-core on the whole section ({tag}), outside the photo system: '+'; '.join(v[:3]))
    else: ok(f'axe-core WCAG 2.1 AA: whole section {INFO["lesson"]} {INFO["section"]} ({tag})')
    # credits page
    await pg.goto(BASE+'/#/credits'); await pg.wait_for_selector('.phcredits li')
    row=pg.locator('.phcredits li').filter(has=pg.locator('img[src*="crimper-rj45"]')).first
    rt=await row.inner_text(); links=await row.locator('a').evaluate_all("as=>as.map(a=>a.getAttribute('href'))")
    check('ยังไม่ได้ตรวจ' in rt and INFO['item']['page'] in links,'credits page row: Commons link and "ยังไม่ได้ตรวจ"')
    check(f"#/lesson/{INFO['lesson']}/content/{INFO['section']}" in links and 'สัปดาห์ 5' in rt,'credits page says where the photo is used (week and section)')
    sw=await pg.evaluate("()=>document.documentElement.scrollWidth-window.innerWidth"); check(sw<=0,f'credits page: no horizontal scroll ({sw}px)')
    await pg.screenshot(path=f'{OUT}/part18-credits-{tag}.png')
    await axe(pg,'#app' if await pg.locator('#app').count() else 'main',f'credits page ({tag})')
    check(not E,'no JS errors '+'; '.join(E[:2]))
    await ctx.close()

async def main():
    if not INFO: bad('crimper-rj45 is not placed in any lesson'); return
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for w,h in ((390,844),(1366,900)):
            for theme in ('light','dark'): await run(b,w,h,theme)
        print('== headers and offline cache')
        ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page()
        r=await ctx.request.get(BASE+INFO['item']['small'])
        cc=r.headers.get('cache-control',''); check(r.status==200 and 'max-age=31536000' in cc and 'immutable' in cc,f'photo is served with a long cache header ({cc})')
        check(r.headers.get('content-type','').startswith('image/jpeg'),'photo is image/jpeg')
        csp=(await ctx.request.get(BASE+'/')).headers; pol=csp.get('content-security-policy') or csp.get('content-security-policy-report-only') or ''
        check("img-src 'self'" in pol,'CSP allows same-origin images')
        await pg.goto(BASE+'/'); await pg.wait_for_function("()=>navigator.serviceWorker&&navigator.serviceWorker.ready.then(()=>true)",timeout=15000)
        await pg.reload(); await pg.wait_for_function("()=>!!navigator.serviceWorker.controller",timeout=15000)
        await pg.goto(URL); await pg.wait_for_selector('.lhead')
        fig=pg.locator('figure.photo').filter(has=pg.locator('img[src*="/photos/crimper-rj45"]')).first
        await fig.scroll_into_view_if_needed(); await pg.wait_for_timeout(1500)
        keys=await pg.evaluate("async()=>{const c=await caches.open('netlab-data-v1');return (await c.keys()).map(r=>new URL(r.url).pathname)}")
        check('/photos/crimper-rj45-800.jpg' in keys,'service worker keeps the viewed photo (phone size) for offline reading')
        shell=await pg.evaluate("async()=>{const ks=await caches.keys();let n=0;for(const k of ks) if(k.startsWith('netlab-shell-')) n+=(await (await caches.open(k)).keys()).filter(r=>r.url.includes('/photos/')).length;return n}")
        check(shell==0,'photos are not in the precache (app shell)')
        await ctx.close(); await b.close()
    print('part18:', 'PASS' if not issues else f'FAIL ({len(issues)})')
    sys.exit(1 if issues else 0)

asyncio.run(main())
