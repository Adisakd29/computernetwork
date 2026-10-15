# Browser test for Phase 5 (XP, badges, weekly challenge, progress page, leaderboard privacy, teacher analytics)
import asyncio, json, sys, zipfile, re
from playwright.async_api import async_playwright
SP=sys.argv[1]; BASE='http://127.0.0.1:3990'
ANS=json.load(open(SP+'/bankans.json'))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
def right(a):
    t=a['type']
    if t in ('choice',) or (t=='diagram' and (a.get('answerType') or 'choice')=='choice'): return a['correct']
    if t in ('multi','diagram'): return a['correct']
    if t=='tf': return a['answer']
    if t=='match': return a['answer']
    if t=='order': return a['items']
    if t=='fill': return [b[0] for b in a['blanks']]
    if t=='subnet': return a['sub']
    if t=='command': return a['example']
    return None
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
async def errs_of(pg):
    E=[]; pg.on('pageerror',lambda e: E.append(str(e))); return E
async def overflow(pg): return await pg.evaluate('document.documentElement.scrollWidth-innerWidth')

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        s=await b.new_context(viewport={'width':1280,'height':900}); await login(s,'s1','Stud1234')
        sp=await s.new_page(); SE=await errs_of(sp)
        print('== student: XP from real actions')
        await sp.goto(BASE+'/#/'); await sp.wait_for_selector('.gstrip .lvring')
        st=await sp.inner_text('.gstrip'); check('XP' in st and 'วันต่อเนื่อง' in st,'dashboard shows level strip')
        x0=int(re.search(r'(\d+) XP',st).group(1))
        # 50 distinct correct practice answers through the public API the page uses
        ids=[k for k,a in ANS.items() if right(a) is not None and a['type'] in ('choice','tf','multi')][:52]
        for q in ids:
            j=await sp.evaluate('([id,a])=>api("POST","/api/practice/check",{id,answer:a})',[q,right(ANS[q])])
            if not j.get('correct'): bad('practice answer not correct '+q)
        await sp.goto(BASE+'/#/learn'); await sp.wait_for_selector('.unitlist')
        try:
            await sp.wait_for_selector('.toast:has-text("ได้รับเหรียญใหม่")',timeout=6000); ok('new badge toast shown: '+(await sp.inner_text('.toast')))
        except Exception: bad('no new-badge toast')
        chip=await sp.inner_text('#xpchip'); x1=int(re.search(r'(\d+) XP',chip).group(1))
        g=await (await s.request.get(BASE+'/api/game/me')).json()
        check(g['xp']['practice']==len(ids)*3 and x1==x0+len(ids)*3+g['xp']['challenges'],f"sidebar XP rose by 3 per new correct question + weekly goals ({x0} -> {x1}, challenge XP {g['xp']['challenges']})")
        await sp.wait_for_timeout(3000)
        await sp.goto(BASE+'/#/sims'); await sp.wait_for_selector('.simcard')
        check(await sp.locator('.toast:has-text("ได้รับเหรียญใหม่")').count()==0,'badge toast not repeated')
        print('== student: progress page')
        await sp.goto(BASE+'/#/me'); await sp.wait_for_selector('.ghero')
        check(await sp.locator('.goals li').count()==3,'weekly challenge shows 3 goals')
        check(await sp.locator('.badge').count()==21,'21 badges listed')
        got=await sp.locator('.badge.got').all_inner_texts(); check(any('ขยันฝึก' in g for g in got),'"ขยันฝึก" badge earned (50 practice)')
        check(await sp.locator('.hbars').first.locator('.hrow').count()==10,'mastery bars for 10 units')
        check(await sp.locator('.hday').count()==84,'activity grid has 12 weeks x 7 days')
        check(await sp.locator('.hday.on.today').count()==1,'today marked active')
        tot=await sp.inner_text('.btable tr.tot'); check(str(x1) in tot,'XP table total matches sidebar')
        lb=await sp.inner_text('section:has(h2:has-text("กระดานคะแนน"))'); check('ยังไม่ได้เปิด' in lb,'leaderboard off by default')
        await sp.screenshot(path=SP+'/p5_me.png',full_page=True)
        sug=sp.locator('.sugg a').first
        if await sug.count():
            href=await sug.get_attribute('href'); await sug.click(); await sp.wait_for_timeout(800)
            if href.startswith('#/practice/u'):
                u=href.split('u')[-1]; on=await sp.locator('.fchip.on').all_inner_texts()
                check(any(t.startswith('หน่วย '+u) for t in on),f'suggestion opens practice preset to unit {u}')
            else: ok('suggestion link opens '+href)
        print('== teacher: leaderboard + analytics')
        t=await b.new_context(viewport={'width':1280,'height':900},accept_downloads=True); await login(t,'kru4','Teach1234')
        tp=await t.new_page(); TE=await errs_of(tp)
        await tp.goto(BASE+'/teacher.html'); await tp.wait_for_selector('.side'); await tp.locator('.side .navbtn',has_text='ปวช.2/4').click()
        await tp.locator('.tabs button',has_text='วิเคราะห์ผล').click(); await tp.wait_for_selector('.an')
        txt=await tp.inner_text('main')
        check('นักเรียนที่ควรดูแล' in txt and 'สมหญิง' in txt,'flag list includes inactive student')
        row=await tp.locator('table.an tr',has_text='สมชาย').inner_text(); check(str(x1) in row,'teacher sees same XP as student')
        check(await tp.locator('.cols .col').count()==28,'daily activity chart has 28 days')
        await tp.click('th.sortable:has-text("XP สัปดาห์นี้")'); first=await tp.locator('table.an tr').nth(1).inner_text(); check('สมชาย' in first,'sort by week XP puts active student first')
        await tp.screenshot(path=SP+'/p5_t_analytics.png',full_page=True)
        async with tp.expect_download() as dl: await tp.click('text=ส่งออก Excel')
        f=await dl.value; await f.save_as(SP+'/p5.xlsx'); check(zipfile.is_zipfile(SP+'/p5.xlsx'),'analytics Excel downloads')
        await tp.locator('.tabs button',has_text='ตั้งค่าห้อง').click(); await tp.wait_for_selector('text=กระดานคะแนน (Leaderboard)')
        await tp.locator('.card:has-text("กระดานคะแนน (Leaderboard)") input[type=checkbox]').check(); await tp.wait_for_selector('.toast:has-text("เปิดกระดานคะแนนแล้ว")')
        ok('teacher turned leaderboard on')
        print('== privacy')
        s2=await b.new_context(viewport={'width':1280,'height':900}); await login(s2,'s2','Stud1234'); p2=await s2.new_page()
        await sp.goto(BASE+'/#/'); await sp.goto(BASE+'/#/me'); await sp.wait_for_selector('table.lb')
        lbt=await sp.inner_text('table.lb'); check('สมหญิง' not in lbt and 'ไม่เปิดเผยชื่อ' in lbt,'other student hidden by default')
        check('คุณ' in lbt,'own row marked')
        await p2.goto(BASE+'/#/me'); await p2.wait_for_selector('table.lb')
        await p2.locator('label:has-text("ให้เพื่อนในห้องเห็นชื่อของฉัน") input').check(); await p2.wait_for_selector('.toast:has-text("แสดงชื่อของคุณ")')
        await sp.reload(); await sp.wait_for_selector('table.lb'); await sp.click('.segs button:has-text("ทั้งหมด")'); await sp.wait_for_timeout(600)
        lbt=await sp.inner_text('table.lb'); check('สมหญิง' in lbt,'name shown after the student opted in')
        await sp.screenshot(path=SP+'/p5_me_lb.png',full_page=True)
        print('== phone / dark')
        mp=await s.new_page(); ME=await errs_of(mp); await mp.set_viewport_size({'width':390,'height':844})
        for h in ['#/','#/me']:
            await mp.goto(BASE+'/'+h); await mp.wait_for_timeout(1500); o=await overflow(mp); check(o<=0,f'{h} fits 390px ({o})')
        await mp.screenshot(path=SP+'/p5_m_me.png',full_page=True)
        await mp.emulate_media(color_scheme='dark'); await mp.reload(); await mp.wait_for_selector('.ghero'); await mp.screenshot(path=SP+'/p5_m_me_dark.png',full_page=True)
        mt=await t.new_page(); await mt.set_viewport_size({'width':390,'height':844}); await mt.goto(BASE+'/teacher.html'); await mt.wait_for_selector('#menuToggle')
        await mt.click('#menuToggle'); await mt.locator('.side .navbtn',has_text='ปวช.2/4').click(); await mt.locator('.tabs button',has_text='วิเคราะห์ผล').click(); await mt.wait_for_selector('.an')
        o=await overflow(mt); check(o<=0,f'teacher analytics fits phone ({o})'); await mt.screenshot(path=SP+'/p5_m_t.png',full_page=True)
        check(not SE and not TE and not ME,'no JS errors: '+'; '.join((SE+TE+ME)[:3]))
        await b.close()
    print('\nISSUES',len(issues)); [print(' -',i) for i in issues]
asyncio.run(main())

sys.exit(1 if issues else 0)
