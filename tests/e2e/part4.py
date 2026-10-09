# Part 4 (2.4): reading position + continue, table of contents, progress bar, font size, autosave, parallel post-test,
# review mistakes, new diagrams/widgets render in every lesson. usage: python3 tests/e2e/part4.py <out-dir>
import asyncio, sys, json, os, subprocess, re
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
NODE=lambda js: json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
VIS=NODE("const {LESSONS}=require('./server/lessons');const o={};for(const L of LESSONS.values()){o[L.id]={d:[],w:[],s:L.sections.map(s=>s.id)};L.sections.forEach(s=>s.blocks.forEach(b=>{if(b.type==='diagram')o[L.id].d.push(b.name);if(b.type==='widget')o[L.id].w.push(b.name);}))}console.log(JSON.stringify(o))")
FORMB=NODE("const B=require('./content/lessons/forms/w6.js');console.log(JSON.stringify(B.map(q=>({t:q.type,q:q.q,o:q.options,c:q.correct,a:q.answer,ans:q.answers}))))")
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== every lesson renders its diagrams and widgets (1366 and 390)')
        for (w,h,touch) in [(1366,768,False),(390,844,True)]:
            c=await b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch); pg=await c.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            fails=[]
            for lid,v in VIS.items():
                await pg.goto(BASE+f'/#/lesson/{lid}/content'); await pg.wait_for_selector('.lsec'); await pg.wait_for_timeout(300)
                d=await pg.evaluate('[...document.querySelectorAll(".dgm .dgmsvg")].filter(x=>x.querySelector("svg")).length')
                wg=await pg.evaluate('[...document.querySelectorAll("figure.wdg, .wdg, [class*=nlw]")].length')
                broken=await pg.evaluate('[...document.querySelectorAll("#app *")].some(e=>e.childElementCount===0&&/โหลดสื่อนี้ไม่สำเร็จ/.test(e.textContent))')
                ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
                if d!=len(v['d']) or broken or ov>0: fails.append(f'{lid}: diagrams {d}/{len(v["d"])} broken={broken} overflow={ov}')
            check(not fails and not E,f'{w}px: 18 lessons render all {sum(len(x["d"]) for x in VIS.values())} diagrams and {sum(len(x["w"]) for x in VIS.values())} widgets, no overflow, no errors '+'; '.join(fails[:3]+E[:2]))
            await c.close()
        c=await b.new_context(viewport={'width':1366,'height':900}); pg=await c.new_page()
        await pg.goto(BASE+'/#/lesson/w3/content'); await pg.wait_for_selector('.lsec')
        await pg.locator('figure:has-text("IPv6") input').first.fill('2001:0db8:0000:0000:0000:ff00:0042:8329'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        t=await pg.locator('figure:has-text("IPv6")').first.inner_text(); check('2001:db8::ff00:42:8329' in t,'w3 IPv6 widget compresses an address correctly')
        await pg.screenshot(path=f'{OUT}/p4_ipv6.png'); await c.close()

        print('== reading position, continue, TOC, progress, font size (phone, logged in)')
        ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); await login(ctx,'s1','Stud1234')
        pg=await ctx.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
        await pg.goto(BASE+'/#/lesson/w6/content'); await pg.wait_for_selector('.lsec')
        check(await pg.locator('.mtoc').is_visible() and not await pg.locator('.ltoc').is_visible(),'phone shows a collapsible table of contents')
        check('อ่านแล้ว' in await pg.inner_text('.lprog'),'progress bar shows sections read')
        await pg.locator('.mtoc summary').tap(); await pg.locator('.mtoc a').nth(2).tap(); await pg.wait_for_timeout(900)
        top=await pg.evaluate("document.getElementById('sec-s3').getBoundingClientRect().top")
        check(-5<top<260,f'TOC item jumps to section 3 (top {round(top)})')
        await pg.wait_for_timeout(3200)   # position is remembered after a short pause
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.cont')
        await pg.goto(BASE+'/#/lesson/w6/content'); await pg.wait_for_selector('.lsec')
        rs=pg.locator('.resume'); check(await rs.count()==1 and '3.' in await rs.inner_text(),'returning shows "อ่านค้างไว้ที่" with the remembered section')
        await rs.locator('button').tap(); await pg.wait_for_timeout(900)
        top=await pg.evaluate("document.getElementById('sec-s3').getBoundingClientRect().top"); check(-5<top<260,'"อ่านต่อ" jumps back to it')
        d2=await b.new_context(viewport={'width':1366,'height':800}); await login(d2,'s1','Stud1234'); q2=await d2.new_page()
        await q2.goto(BASE+'/#/lesson/w6/content'); await q2.wait_for_selector('.lsec')
        check(await q2.locator('.resume').count()==1,'another device (logged in) also offers to resume (saved on server)'); await d2.close()
        # progress bar moves as sections are read
        n0=int(re.search(r'(\d+)/',await pg.inner_text('.lprog')).group(1))
        await pg.evaluate('window.scrollTo(0,document.body.scrollHeight)'); await pg.wait_for_timeout(800)
        n1=int(re.search(r'(\d+)/',await pg.inner_text('.lprog')).group(1)); check(n1>n0,f'progress increases while reading ({n0} -> {n1})')
        # font size
        await pg.evaluate('window.scrollTo(0,0)'); w0=await pg.evaluate("document.querySelector('.lbody p').getBoundingClientRect().height")
        await pg.locator('.fsbtn[aria-label="เพิ่มขนาดตัวอักษร"]').tap(); await pg.locator('.fsbtn[aria-label="เพิ่มขนาดตัวอักษร"]').tap(); await pg.locator('.fsbtn[aria-label="เพิ่มขนาดตัวอักษร"]').tap()
        w1=await pg.evaluate("document.querySelector('.lbody p').getBoundingClientRect().height")
        check(await pg.inner_text('.fslbl')=='130%' and w1>w0*1.15,f'ก+ enlarges lesson text to 130% (paragraph {round(w0)} -> {round(w1)} px tall)')
        check(await pg.evaluate('document.documentElement.scrollWidth-innerWidth')<=0,'130% text still fits 390px')
        await pg.screenshot(path=f'{OUT}/p4_390_lesson_130.png')
        await pg.reload(); await pg.wait_for_selector('.lsec'); check(await pg.inner_text('.fslbl')=='130%','text size remembered after reload')
        await pg.locator('.fsbtn[aria-label="ขนาดปกติ"]').tap(); check(await pg.inner_text('.fslbl')=='100%','"ปกติ" resets the size')
        # continue card on dashboard
        await pg.goto(BASE+'/#/'); await pg.wait_for_selector('.cont')
        href=await pg.locator('.cont a.btn').get_attribute('href'); ok('continue button: '+href)
        # autosave of an in-lesson exercise
        await pg.goto(BASE+'/#/lesson/w6/content'); await pg.wait_for_selector('.check')
        chk=pg.locator('.check:not(.solved)').first; await chk.scroll_into_view_if_needed()
        if await chk.locator('label.opt').count():
            await chk.locator('label.opt').nth(1).tap(); await pg.reload(); await pg.wait_for_selector('.check')
            check(await pg.locator('.check:not(.solved)').first.locator('input:checked').count()==1,'unchecked exercise answer restored after reload (autosave)')
        else:
            await chk.locator('input[type=text]').fill('ทดสอบ'); await pg.reload(); await pg.wait_for_selector('.check')
            check(await pg.locator('.check:not(.solved)').first.locator('input[type=text]').input_value()=='ทดสอบ','typed exercise answer restored after reload (autosave)')
        print('== parallel post-test')
        await pg.goto(BASE+'/#/lesson/w6/pre'); await pg.wait_for_selector('.qcard'); preQ=await pg.locator('.qcard .qq, .qcard p').first.inner_text()
        await pg.goto(BASE+'/#/lesson/w6/post'); await pg.wait_for_selector('.qcard'); postQ=await pg.locator('.qcard .qq, .qcard p').first.inner_text()
        check(preQ!=postQ and FORMB[0]['q'][:20] in postQ,'post-test shows form B (different items from the pre-test)')
        pg.on('dialog',lambda d: asyncio.ensure_future(d.accept()))
        for i,q in enumerate(FORMB):
            card=pg.locator('.qcard').nth(i)
            if q['t']=='choice': await card.locator('label.opt',has_text=q['o'][(q['c']+1)%len(q['o'])] if i==0 else q['o'][q['c']]).first.tap()
            elif q['t']=='multi':
                for k in q['c']: await card.locator('label.opt',has_text=q['o'][k]).first.tap()
            elif q['t']=='tf': await card.locator('label.opt',has_text='ถูก' if q['a'] else 'ผิด').first.tap()
            else: await card.locator('input[type=text]').fill(q['ans'][0])
        await pg.locator('button:has-text("ส่งแบบทดสอบหลังเรียน")').tap(); await pg.wait_for_selector('.review li')
        txt=await pg.inner_text('.review'); check(FORMB[1]['q'][:15] in txt and 'ทำไมคำตอบที่เลือกจึงผิด' in txt,'post-test review shows form B items, the answer and why the chosen option was wrong')
        await pg.screenshot(path=f'{OUT}/p4_390_postreview.png',full_page=False)
        check(not E,'no JS errors: '+'; '.join(E[:2]))
        print('== review mistakes (practice)')
        await pg.goto(BASE+'/#/learn'); await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.mistakes')
        m0=await pg.inner_text('.mistakes'); n_before=int((re.search(r'มี (\d+) ข้อ',m0) or [0,0])[1]) if 'มี ' in m0 else 0
        await pg.tap('button:has-text("เริ่มฝึก")'); await pg.wait_for_selector('.bq')
        for i in range(2):   # answer two questions with whatever is first (likely wrong), check
            if await pg.locator('.bq label.opt').count(): await pg.locator('.bq label.opt').first.tap()
            elif await pg.locator('.bq select').count():
                for s_ in await pg.locator('.bq select').all(): await s_.select_option(index=1)
            elif await pg.locator('.bq .obtn:not([disabled])').count(): await pg.locator('.bq .obtn:not([disabled])').first.tap()
            else: await pg.locator('.bq input[type=text], .bq .cmdin').first.fill('zzz')
            await pg.tap('button:has-text("ตรวจคำตอบ")'); await pg.wait_for_selector('.bqfb .verdict'); await pg.tap('button:has-text("ข้อต่อไป")')
        await pg.goto(BASE+'/#/learn'); await pg.goto(BASE+'/#/practice'); await pg.wait_for_selector('.mistakes button, .mistakes p')
        m1=await pg.inner_text('.mistakes'); ok('mistakes panel: '+m1.replace('\n',' ')[:80])
        if 'ทบทวน' in m1 and await pg.locator('.mistakes button').count():
            await pg.locator('.mistakes button').tap(); await pg.wait_for_selector('.bq'); check(await pg.locator('.tagt:has-text("ทบทวนข้อที่ผิด")').count()==1,'review run starts with the wrong questions')
        else: bad('no mistakes to review after wrong answers')
        await pg.screenshot(path=f'{OUT}/p4_390_mistakes.png')
        await ctx.close()
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
asyncio.run(main())

sys.exit(1 if issues else 0)
