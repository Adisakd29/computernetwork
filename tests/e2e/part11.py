# Part 11 (3.0 Phase 2): weekly practice plan from content/curriculum.js
# - /api/curriculum: 18 weeks, real missions only, no answers
# - lab step: Guided / Independent lists; challenge step: Troubleshooting; summary: practice results
# - a logged-in student's passed mission shows as passed in every week that uses it; phone + desktop, no overflow
# usage: python3 tests/e2e/part11.py <out-dir>
import asyncio, sys, json, os, subprocess
from playwright.async_api import async_playwright
OUT=sys.argv[1]; BASE='http://127.0.0.1:3990'
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
        print('== student sees the plan and own results')
        sid=subprocess.check_output(['psql',DB,'-tAc',"SELECT id FROM users WHERE username='s1'"]).decode().strip()
        subprocess.check_call(['psql',DB,'-qc',f"INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES({sid},'topology','t3',10,10,10,1,now()),({sid},'troubleshoot','x12',6,10,6,2,NULL) ON CONFLICT DO NOTHING"])
        for vw,vh,mob in [(1366,860,False),(390,844,True)]:
            S=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); await login(S,'s1','Stud1234'); pg=await S.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            await pg.goto(BASE+'/#/lesson/w13/lab'); await pg.wait_for_selector('.simlinks h2'); await pg.wait_for_timeout(1200)
            t=await pg.inner_text('.simlinks')
            check('Guided Lab' in t and 'Independent Lab' in t,f'{vw}px: lab step lists Guided and Independent Lab')
            check('ผ่านแล้ว' in t and await pg.locator('.simlinks a.done').count()>=1,f'{vw}px: the passed mission t3 shows as passed')
            check('ยังไม่ได้ทำ' in t,f'{vw}px: missions not yet done are marked')
            ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth'); check(ov<=0,f'{vw}px: no horizontal scroll on the lab step')
            await pg.screenshot(path=f'{OUT}/p11_lab_{vw}.png',full_page=True)
            await pg.goto(BASE+'/#/lesson/w13/challenge'); await pg.wait_for_selector('.simlinks h2'); await pg.wait_for_timeout(1000)
            t=await pg.inner_text('#app'); check('Troubleshooting Challenge' in t and 'ได้ 6/10' in t,f'{vw}px: challenge step shows the troubleshooting mission with the partial score')
            await pg.goto(BASE+'/#/lesson/w13/summary'); await pg.wait_for_selector('.compare'); await pg.wait_for_timeout(1200)
            t=await pg.inner_text('#app'); check('ผลการฝึกปฏิบัติ' in t and 'Guided Lab' in t and '1/2' in t,f'{vw}px: summary counts passed guided missions (1/2)')
            await pg.screenshot(path=f'{OUT}/p11_summary_{vw}.png',full_page=True)
            await pg.goto(BASE+'/#/sim/topology/t4'); await pg.wait_for_function('document.querySelector(".simroot") && document.querySelector(".simroot").children.length>0',timeout=15000)
            await pg.goto(BASE+'/#/lesson/w13'); await pg.wait_for_selector('.rail')
            rail=await pg.inner_text('.rail')
            if not mob: check('แก้ปัญหา' in rail,f'{vw}px: rail shows the troubleshooting count on the challenge step')   # phones hide the step details
            check(not E,f'{vw}px: no JS errors '+'; '.join(E[:2])); await S.close()
        print('== no stray "null"/"undefined" text on lesson pages (guest)')
        G0=await b.new_context(viewport={'width':1366,'height':860}); pg=await G0.new_page(); found=[]
        for w in range(1,19):
            for step in ['','/pre','/content','/lab','/challenge','/post','/summary']:
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
        await pg.goto(BASE+'/#/lesson/w5/lab'); await pg.wait_for_selector('.simlinks h2')
        t=await pg.inner_text('.simlinks'); check('ผ่านแล้ว' not in t and 'Guided Lab' in t,'guest sees the plan without account results')
        await b.close()
    print(f'\npart11: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
