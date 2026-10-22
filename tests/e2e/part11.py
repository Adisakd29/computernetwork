# Part 11 (3.0 Phase 2): weekly practice plan from content/curriculum.js
# - /api/curriculum: 18 weeks, real missions only, no answers
# - 3.2 practical step: the plan lists Guided / Independent / Troubleshooting; work counts only inside a running session
#   (a mission passed earlier in the simulator is not counted); per-item states and reasons; summary shows the practical result
# - phone + desktop, no overflow; no bare null/undefined on any lesson page (old step URLs included)
# usage: python3 tests/e2e/part11.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE=os.environ.get('E2E_BASE','http://127.0.0.1:3990')
DB=os.environ.get('E2E_DATABASE_URL','postgres://postgres@127.0.0.1:5433/netlab_e2e')
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
issues=[]
def bad(m): issues.append(m); print('  ✗',m)
def ok(m): print('  ✓',m)
def check(c,m): ok(m) if c else bad(m)
async def login(ctx,u,p):
    r=await ctx.request.post(BASE+'/api/auth/login',data={'username':u,'password':p},headers={'X-NetLab':'1'}); assert r.ok, await r.text()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== /api/curriculum')
        C=await b.new_context(); r=await C.request.get(BASE+'/api/curriculum'); d=await r.json()
        check(r.ok and len(d['weeks'])==18,'18 weeks served')
        s=json.dumps(d,ensure_ascii=False); check(all(k not in s for k in ['"answers"','"correct"','"explain"','"accept"']),'no answers in the plan')
        w13=[w for w in d['weeks'] if w['id']=='w13'][0]
        check(w13['guided'][0]['title'] and w13['guided'][0]['minutes']>0 and w13['guided'][0]['simTitle'],'missions carry title, simulator name and time estimate')
        await C.close()
        print('== student: plan, one session, per-item results (3.2: results count only inside a running practical session)')
        for vw,vh,mob,user in [(1366,860,False,'s1'),(360,740,True,'s2')]:
            sid=subprocess.check_output(['psql',DB,'-tAc',f"SELECT id FROM users WHERE username='{user}'"]).decode().strip()
            # done in the simulator outside the practical: kept in sim_results, but not counted in the week practical
            subprocess.check_call(['psql',DB,'-qc',f"INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES({sid},'topology','t3',10,10,10,1,now()) ON CONFLICT DO NOTHING"])
            S=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); await login(S,user,'Stud1234'); pg=await S.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            await pg.goto(BASE+'/#/lesson/w13/lab'); await pg.wait_for_selector('#prPlan .prplanpart'); await pg.wait_for_timeout(500)
            parts=await pg.eval_on_selector_all('#prPlan .prplanpart','e=>e.map(x=>x.dataset.part)'); t=await pg.inner_text('#prPlan')
            check(parts==['guided','independent','trouble'] and 'Guided Lab' in t and 'Independent Lab' in t and 'Troubleshooting Lab' in t,f'{vw}px: the plan lists Guided, Independent and Troubleshooting Lab ({parts})')
            check(await pg.locator('#prPlan .prplanitem[data-key="topology:t3"]').count()==1 and await pg.locator('#prPlan .prplanitem[data-key="troubleshoot:x12"]').count()==1,f'{vw}px: t3 is in Guided, x12 in Troubleshooting')
            ov=await pg.evaluate('document.scrollingElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: no horizontal scroll on the plan')
            await pg.screenshot(path=f'{OUT}/p11_plan_{vw}.png',full_page=True)
            await pg.click('#prStart'); await pg.wait_for_selector('#prClock')
            check(await pg.get_attribute('.pritem[data-key="topology:t3"]','data-state')=='todo',f'{vw}px: t3 passed earlier outside the session is not counted in this session ("ยังไม่ทำ")')
            # what the server records when the simulator submits inside the session (POST /api/sims/... is tested in part20)
            subprocess.check_call(['psql',DB,'-qc',f"""INSERT INTO practical_items(session_id,item,part,score,max,solved) SELECT id,'topology:t3','guided',10,10,true FROM practical_sessions WHERE user_id={sid} AND status='running';
                INSERT INTO practical_items(session_id,item,part,score,max,solved) SELECT id,'troubleshoot:x12','trouble',6,10,false FROM practical_sessions WHERE user_id={sid} AND status='running'"""])
            await pg.reload(); await pg.wait_for_selector('#prClock'); await pg.wait_for_timeout(500)
            check(await pg.get_attribute('.pritem[data-key="topology:t3"]','data-state')=='passed',f'{vw}px: t3 recorded in the session shows as passed')
            await pg.click('.prpart[data-part=trouble]'); await pg.wait_for_selector('.pritem[data-key="troubleshoot:x12"]')
            x=pg.locator('.pritem[data-key="troubleshoot:x12"]'); xt=await x.inner_text()
            check(await x.get_attribute('data-state')=='done' and 'รอบนี้ได้ 6/10 (60%)' in xt and 'ต้องได้อย่างน้อย 70%' in await x.locator('.prreason').inner_text(),f'{vw}px: x12 at 6/10 shows "ยังไม่ผ่าน" with the score and what to fix')
            await pg.screenshot(path=f'{OUT}/p11_trouble_{vw}.png',full_page=True)
            await pg.click('#prSubmit'); await pg.click('#prSubmitYes'); await pg.wait_for_selector('#prResult')
            check(await pg.locator('.prresitem[data-key="topology:t3"] .prmark.ok').count()==1 and await pg.locator('.prresitem[data-key="troubleshoot:x12"] .prmark.ok').count()==0
                  and await pg.locator('.prresitem[data-key="troubleshoot:x12"] .prreason').count()==1,f'{vw}px: results: a check mark on t3 only, x12 has its reason')
            await pg.goto(BASE+'/#/lesson/w13/summary'); await pg.wait_for_selector('#prSummary .compare'); await pg.wait_for_timeout(500)
            t=await pg.inner_text('#prSummary'); st=await (await S.request.get(BASE+'/api/practical/w13',headers={'X-NetLab':'1'})).json()
            check(f"{st['best']['total']}%" in t and 'Guided Lab' in t and 'กิจกรรมที่ยังไม่ผ่าน' in t and 'ได้ 6/10' in t,f'{vw}px: summary shows the practical total {st["best"]["total"]}%, the parts and what is not passed yet')
            await pg.screenshot(path=f'{OUT}/p11_summary_{vw}.png',full_page=True)
            rail=await pg.inner_text('.rail .rstep[data-step=lab]')
            if not mob: check(f"ดีที่สุด {st['best']['total']}%" in rail,f'{vw}px: rail shows the best practical score on step 3 ({rail.strip()!r})')   # phones hide the step details
            check(await pg.locator('.rail .rstep').count()==5,f'{vw}px: the rail has 5 steps')
            check(not E,f'{vw}px: no JS errors '+'; '.join(E[:2])); await S.close()
        print('== no stray "null"/"undefined" text on lesson pages (guest)')
        G0=await b.new_context(viewport={'width':1366,'height':860}); pg=await G0.new_page(); found=[]
        for w in range(1,19):
            for step in ['','/pre','/content','/lab','/challenge','/solve','/extra','/post','/summary']:
                await pg.goto(BASE+f'/#/lesson/w{w}{step}'); await pg.wait_for_timeout(350)
                lines=[x.strip() for x in (await pg.inner_text('#app')).split('\n')]
                if 'null' in lines or 'undefined' in lines or 'NaN' in lines: found.append(f'w{w}{step}')
        for rid in ['r1','r5','r9','r12']:
            await pg.goto(BASE+f'/#/room/{rid}'); await pg.wait_for_timeout(500)
            lines=[x.strip() for x in (await pg.inner_text('#app')).split('\n')]
            if 'null' in lines or 'undefined' in lines: found.append(rid)
        check(not found,'no page shows a bare null/undefined/NaN '+', '.join(found[:6])); await G0.close()
        print('== guest')
        G=await b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True); pg=await G.new_page()
        await pg.goto(BASE+'/#/lesson/w5/lab'); await pg.wait_for_selector('#prPage[data-mode=guest] #prPlan')
        t=await pg.inner_text('#prPage'); check('ผ่านแล้ว' not in t and 'Guided Lab' in t and await pg.locator('.pritem').count()==0 and await pg.locator('#prLogin').count()==1,'guest sees the plan without account results (log in to start)')
        await b.close()
    print(f'\npart11: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
