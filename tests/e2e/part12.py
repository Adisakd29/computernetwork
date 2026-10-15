# Part 12 (3.0 Phase 3): new labs integrated into the app
# - every mission of switching / ipv6 / packets / netops and topology t10-t13 opens by deep link (phone + desktop), no page errors, no horizontal scroll
# - simulators page lists the 10 labs with icons; a logged-in submit is saved and shows as passed in the week plan; teacher sims tab lists the new labs
# usage: python3 tests/e2e/part12.py <out-dir>
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
MISSIONS=json.loads(subprocess.check_output(['node','-e',"const {MODS}=require('./server/sims-api');const o={};for(const s of ['switching','ipv6','packets','netops'])o[s]=MODS[s].missions.map(m=>m.id);o.topology=['t10','t11','t12','t13'];console.log(JSON.stringify(o))"],cwd=ROOT,stderr=subprocess.DEVNULL))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        print('== simulators page')
        C=await b.new_context(viewport={'width':1366,'height':860}); pg=await C.new_page()
        await pg.goto(BASE+'/#/sims'); await pg.wait_for_selector('.simcard')
        check(await pg.locator('.simcard').count()==10,'10 labs on the simulators page')
        check(await pg.locator('.simcard .simic svg').count()==10,'every lab card has an icon')
        await pg.screenshot(path=f'{OUT}/p12_sims.png',full_page=True); await C.close()
        for vw,vh,mob in [(1366,860,False),(390,844,True)]:
            print(f'== every new mission opens by deep link at {vw}px')
            C=await b.new_context(viewport={'width':vw,'height':vh},has_touch=mob,is_mobile=mob); pg=await C.new_page(); E=[]; pg.on('pageerror',lambda e:E.append(str(e)))
            probs=[]
            for sim,ms in MISSIONS.items():
                for m in ms:
                    await pg.goto(BASE+f'/#/sim/{sim}/{m}'); 
                    try: await pg.wait_for_function('document.querySelector(".simroot") && document.querySelector(".simroot").children.length>0',timeout=15000)
                    except Exception: probs.append(f'{sim}/{m} did not mount'); continue
                    await pg.wait_for_timeout(500)
                    if not pg.url.endswith(f'/{sim}/{m}'): probs.append(f'{sim}/{m} url changed to {pg.url}')
                    ov=await pg.evaluate('document.documentElement.scrollWidth-innerWidth')
                    if ov>0: probs.append(f'{sim}/{m} overflow {ov}px')
            n=sum(len(v) for v in MISSIONS.values())
            check(not probs,f'{n} missions open by deep link without horizontal scroll '+'; '.join(probs[:4]))
            check(not E,f'no page errors at {vw}px '+'; '.join(E[:2])); await C.close()
        print('== saved result appears in the week plan; teacher sees the new labs')
        sid=subprocess.check_output(['psql',DB,'-tAc',"SELECT id FROM users WHERE username='s1'"]).decode().strip()
        S=await b.new_context(viewport={'width':1366,'height':860}); await login(S,'s1','Stud1234')
        # a real graded submission through the API: sw7 hub vs switch with an empty run must be saved with a partial score
        r=await S.request.post(BASE+'/api/sims/switching/submit',data={'mission':'sw7','payload':{}},headers={'X-NetLab':'1'}); j=await r.json()
        check(r.ok and j.get('saved') and j['score']<j['max'],f"switching sw7 graded on the server and saved (score {j.get('score')}/{j.get('max')})")
        subprocess.check_call(['psql',DB,'-qc',f"INSERT INTO sim_results(user_id,sim,mission,best,max,last,attempts,first_full_at) VALUES({sid},'switching','sw3',10,10,10,1,now()) ON CONFLICT (user_id,sim,mission) DO UPDATE SET best=10"])
        pg=await S.new_page(); await pg.goto(BASE+'/#/lesson/w4/lab'); await pg.wait_for_selector('.simlinks h2'); await pg.wait_for_timeout(1200)
        t=await pg.inner_text('.simlinks'); check('ตั้ง VLAN' in t or 'VLAN' in t,'week 4 plan lists the VLAN missions')
        check(await pg.locator('.simlinks a.done[href="#/sim/switching/sw3"]').count()==1,'passed sw3 shows as passed in week 4')
        await pg.screenshot(path=f'{OUT}/p12_w4_plan.png',full_page=True)
        sk=await (await S.request.get(BASE+'/api/game/skills')).json(); sw=[x for x in sk['skills'] if x['id']=='switching'][0]
        check(sw['hands']>=1,'switching skill counts the new lab as hands-on evidence')
        T=await b.new_context(viewport={'width':1280,'height':900}); await login(T,'kru4','Teach1234')
        cid=subprocess.check_output(['psql',DB,'-tAc',"SELECT id FROM classes LIMIT 1"]).decode().strip()
        d=await (await T.request.get(BASE+f'/api/teacher/classes/{cid}/sims')).json()
        check(len(d['sims'])==10 and any(s['id']=='packets' for s in d['sims']),'teacher simulator report includes the 4 new labs')
        await b.close()
    print(f'\npart12: {len(issues)} issue(s)'); sys.exit(1 if issues else 0)
asyncio.run(main())
