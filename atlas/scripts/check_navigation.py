"""Real-browser zoom, multi-touch, optional boundary data and regression checks."""
import functools, hashlib, http.server, json, math, os, pathlib, threading
from playwright.sync_api import sync_playwright

root=pathlib.Path(__file__).parent.parent
baseline=json.loads((root/'scripts/navigation_baseline.json').read_text())
def git_hash(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
for name,expected in baseline['assets'].items():
    assert git_hash((root/name).read_bytes())==expected, 'Changed pre-existing asset: '+name
html=(root/'index.html').read_bytes().decode('utf-8')
for current,original in baseline.get('uiReviewReplacements',[])+baseline.get('htmlReplacements',[]):
    assert html.count(current)==1,current
    html=html.replace(current,original)
for addition in baseline['htmlAdditions']:
    assert html.count(addition)==1, addition
    html=html.replace(addition,'')
assert git_hash(html.encode())==baseline['htmlBlob'], 'Unrelated original HTML changes'
print('NAVIGATION_PRESERVATION_PASSED: all original datasets retained; authorized layout, typography, display and subtitle changes recorded',flush=True)

data=json.loads((root/'data/boundaries/countries.json').read_text(encoding='utf-8'))
assert len(data['features'])>350 and len(data['labels'])>200
assert any(f['properties']['kind']=='disputed' for f in data['features'])
assert all(-180<=p['lon']<=180 and -90<=p['lat']<=90 for p in data['labels'])
assert len({p['code'] for p in data['labels'] if p['code']=='IL'})==1

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.add_init_script('window.localizedRegions=[];const displayRegion=Intl.DisplayNames.prototype.of;Intl.DisplayNames.prototype.of=function(code){window.localizedRegions.push(code);return displayRegion.call(this,code)}')
    page.goto(url);page.wait_for_function('ready && window.atlasNavigation')
    def latitude_labels(p,mobile=False):
        assert p.locator('.latitude-subtitle').count()==0
        if mobile:
            assert p.locator('.latitude-label:visible').count()==0
            assert p.evaluate('state.latitudes'), 'Mobile should retain latitude lines by default'
            return
        assert p.locator('.latitude-label').count()==5
        titles=p.locator('.latitude-label').evaluate_all('es=>es.map(e=>e.title)')
        assert sum('קו ההיפוך הצפוני' in t for t in titles)==1
        assert sum('קו ההיפוך הדרומי' in t for t in titles)==1
        boxes=p.locator('.latitude-label').evaluate_all('''elements=>elements.map(e=>{
          const r=e.getBoundingClientRect(),c=canvas.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,canvasRight:c.right,width:innerWidth};
        })''')
        for b in boxes:
            assert b['left']>=b['canvasRight']-1 and b['right']<=b['width']+1,b
            assert b['top']>=0 and b['bottom']<=p.viewport_size['height'],b
    latitude_labels(page)
    def click(s):
        if s=='#atlasReset' and page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')"):page.locator('#closeDrawer').click()
        page.locator(s).click()
        page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
        if s.startswith('[data-month=') or s.startswith('[data-field='):page.wait_for_function('document.querySelector("#layerStatus").hidden')
    def dock():
        if not page.locator('#mapDrawer').is_visible():click('#openDrawer')
        click('#tabLayers')
    def old_state():return page.evaluate('({state:{...state},climate:{...climateLayers.settings},learning:{...atlasLearning.settings}})')
    def pixels():return page.locator('#map').evaluate('c=>c.toDataURL()')
    def shot(name):page.screenshot(path=str(root/(name+'.png')),full_page=True)
    startup=old_state();startup_pixels=pixels()
    assert page.evaluate('state.framing==="height" && Math.abs(H*view.s-cssH)<2')
    click('#navWorld');assert page.evaluate('state.framing==="world" && state.zoom===1')
    before=old_state();original=pixels()
    assert not any('/data/boundaries/' in r for r in requests), 'Disabled layer fetched data'
    assert page.locator('#bordersToggle').get_attribute('aria-pressed')=='false'
    assert page.locator('#navZoomOut').is_disabled()
    assert page.locator('#bordersControl').evaluate('e=>e.parentElement.querySelector("h3").textContent')=='מוסיפים למפה'
    assert page.locator('#bordersControl').evaluate('e=>e.previousElementSibling.id')=='desertBeltNote'
    assert not page.locator('.navigation-controls #bordersToggle').count()
    def switch_style(selector):
        return page.locator(selector).evaluate('e=>{const s=getComputedStyle(e,"::after");return [s.width,s.height,s.backgroundColor,s.boxShadow]}')
    assert switch_style('#bordersToggle')==switch_style('#currentsToggle')
    click('#bordersToggle');page.wait_for_function('atlasNavigation.ready()')
    assert old_state()==before and pixels()!=original
    # Capture the actual geometries sent to the boundary renderer.
    drawn=page.evaluate('''()=>{
      const seen=[],original=d3.geoPath;
      d3.geoPath=(...args)=>{const path=original(...args);return geo=>{seen.push(...geo.features);return path(geo)}};
      try{atlasNavigation.drawBorders()}finally{d3.geoPath=original;draw()}
      return [...new Map(seen.map(f=>[JSON.stringify(f),f])).values()];
    }''')
    omitted={'land:1746705323','land:1746709121','disputed:1746705871'}
    expected=[f for f in data['features'] if f['properties']['sourceLayer']+':'+str(f['properties']['id']) not in omitted]
    assert len(drawn)==421
    assert len(drawn)==len(expected) and all(f in expected for f in drawn), 'Boundary geometry/property mismatch'
    localized=page.evaluate('window.localizedRegions')
    assert 'PS' not in localized and all(c in localized for c in ['IL','JO','EG','LB','SY'])
    assert not page.evaluate('atlasNavigation.labels().length')
    shot('navigation-world')
    click('#bordersToggle');assert pixels()==original and old_state()==before
    page.locator('#bordersToggle').focus();page.keyboard.press('Space')
    assert page.locator('#bordersToggle').get_attribute('aria-pressed')=='true'
    page.keyboard.press('Enter');assert old_state()==before and pixels()==original
    # Existing keys and original buttons remain available; new menu controls share state.
    click('#zoomIn');assert abs(page.evaluate('state.zoom')-1.3)<1e-12
    assert page.locator('#navZoomValue').inner_text()=='130%'
    click('#zoomIn');assert abs(page.evaluate('state.zoom')-1.69)<1e-12
    click('#navWorld');assert page.evaluate('state.zoom===1 && state.panX===0 && state.panY===0')
    page.locator('#map').focus();page.keyboard.press('+');assert page.evaluate('state.zoom')>1
    page.keyboard.press('Home');assert page.evaluate('state.framing==="height" && state.panX===0 && state.panY===0')
    click('#navWorld')
    # Wheel zoom preserves the geographic location below the pointer away from clamped edges.
    page.evaluate('atlasNavigation.zoomAt(2)')
    rect=page.locator('#map').bounding_box();x=round(rect['x']+rect['width']*.55);y=round(rect['y']+rect['height']*.47)
    point=lambda:page.evaluate('p=>[(p[0]-canvas.getBoundingClientRect().left-view.x)/view.s,(p[1]-canvas.getBoundingClientRect().top-view.y)/view.s]',[x,y])
    anchor=point();page.mouse.move(x,y);page.mouse.wheel(0,-120);page.wait_for_timeout(100)
    assert page.evaluate('state.zoom')>2
    assert math.dist(anchor,point())<.001
    selected=page.evaluate('state.selected');pan=page.evaluate('[state.panX,state.panY]')
    page.mouse.down();page.mouse.move(x+50,y+35,steps=5);page.mouse.up()
    assert page.evaluate('state.selected')==selected and page.evaluate('[state.panX,state.panY]')!=pan
    dock();click('#bordersToggle')
    page.evaluate('()=>{state.framing="manual";state.zoom=5;draw();const p=projection([20,45]);state.panX=-(p[0]-W/2)*view.s;state.panY=-(p[1]-H/2)*view.s;draw()}')
    labels=page.evaluate('atlasNavigation.labels()');assert len(labels)>5,labels
    for i,a in enumerate(labels):
        for b in labels[i+1:]:
            aa=a['box'];bb=b['box'];assert not (aa[0]<bb[2] and aa[2]>bb[0] and aa[1]<bb[3] and aa[3]>bb[1]),(a,b)
    assert any('\u0590'<=c<='\u05ff' for c in ''.join(l['name'] for l in labels))
    shot('navigation-europe')
    click('#countryNames');assert page.evaluate('atlasNavigation.labels().length')==0
    click('#countryNames');assert page.evaluate('atlasNavigation.labels().length')>0
    page.evaluate('()=>{state.framing="manual";state.zoom=6;draw();const p=projection([35.3,31.8]);state.panX=-(p[0]-W/2)*view.s;state.panY=-(p[1]-H/2)*view.s;draw()}')
    assert all(l['code']!='PS' for l in page.evaluate('atlasNavigation.labels()'))
    shot('israel-custom-boundaries')
    # Every existing base field and overlay can still coexist with boundaries.
    click('#navWorld')
    click('#learningAccordion summary')
    for name in ['atmosphere','solar','terrain']:click('#'+name+'Toggle')
    page.wait_for_function('atlasLearning.terrainReady()',timeout=60000)
    click('#currentsToggle');click('#desertBelt')
    assert switch_style('#bordersToggle')==switch_style('#currentsToggle')
    for field in ['temperature','precipitation']:
        click('[data-field="'+field+'"]');page.wait_for_function('document.querySelector("#layerStatus").hidden')
        for month in [1,7]:
            click('[data-month="'+str(month)+'"]')
            assert page.evaluate('atlasNavigation.settings.borders && atlasNavigation.settings.desert')
            prev=old_state();image=pixels();click('#bordersToggle');assert old_state()==prev and pixels()!=image
            assert page.evaluate('atlasNavigation.settings.desert')
            click('#bordersToggle');assert old_state()==prev and pixels()==image
            assert page.evaluate('atlasNavigation.settings.desert')
    page.locator('#bordersToggle').scroll_into_view_if_needed()
    shot('boundaries-overlay-switch')
    shot('navigation-combined')
    # Full reset clears every overlay, selection, month, camera and teaching animation.
    page.evaluate('()=>{state.labels=false;state.latitudes=false;state.framing="manual";state.zoom=4;state.panX=80;climateLayers.settings.month=7;atlasLearning.settings.point=[10,66];atlasLearning.settings.moist=false;document.querySelector("#orographicStep").click();render()}')
    click('#atlasReset');assert old_state()==startup
    assert page.evaluate('atlasLearning.sceneProgress()')==0
    assert pixels()==startup_pixels and not page.evaluate('atlasNavigation.settings.borders')
    # Desert switch is independent and does not reset other map state.
    click('#navWorld')
    before_desert=old_state();image=pixels();click('#desertBelt')
    assert old_state()==before_desert and pixels()!=image
    assert page.locator('#desertBelt').get_attribute('aria-pressed')=='true'
    assert 'ערבות' in page.locator('#desertBeltNote').inner_text()
    shot('navigation-desert-belt')
    page.locator('#clear').evaluate('b=>b.click()');assert page.evaluate('atlasNavigation.settings.desert')
    click('#atlasReset');assert old_state()==startup and pixels()==startup_pixels
    # Actual touch dispatch, not synthetic JS PointerEvents. Pinch must not select a climate.
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)))
    mp.goto(url);mp.wait_for_function('ready && window.atlasNavigation')
    latitude_labels(mp,True)
    mp.locator('#navWorld').click()
    mp.locator('#map').scroll_into_view_if_needed()
    mr=mp.locator('#map').bounding_box();cx=mr['x']+mr['width']/2;cy=mr['y']+mr['height']/2
    session=mobile.new_cdp_session(mp)
    def touches(kind,points):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':px,'y':py,'id':i+1} for i,(px,py) in enumerate(points)]})
    old=mp.evaluate('({selected:state.selected,climate:{...climateLayers.settings},learning:{...atlasLearning.settings}})')
    touches('touchStart',[(cx-35,cy),(cx+35,cy)])
    for d in [45,55,70,85]:touches('touchMove',[(cx-d,cy),(cx+d,cy)])
    touches('touchEnd',[]);mp.wait_for_timeout(80)
    assert mp.evaluate('state.zoom')>2
    assert mp.evaluate('({selected:state.selected,climate:{...climateLayers.settings},learning:{...atlasLearning.settings}})')==old
    # A one-finger drag still works after a completed pinch, without selecting a region.
    pos=mp.evaluate('[state.panX,state.panY]')
    touches('touchStart',[(cx,cy)]);touches('touchMove',[(cx+35,cy+25)]);touches('touchEnd',[])
    assert mp.evaluate('[state.panX,state.panY]')!=pos and mp.evaluate('state.selected')==old['selected']
    mp.locator('#openDrawer').click();mp.locator('#bordersToggle').click();mp.wait_for_function('atlasNavigation.ready()')
    assert mp.locator('#bordersControl').evaluate('e=>e.parentElement.querySelector("h3").textContent')=='מוסיפים למפה'
    assert mp.locator('#mapDrawer').is_visible()
    mp.locator('#bordersToggle').scroll_into_view_if_needed()
    mp.screenshot(path=str(root/'boundaries-mobile-switch.png'),full_page=True)
    mp.locator('#bordersToggle').click();assert not mp.evaluate('atlasNavigation.settings.borders')
    mp.locator('#bordersToggle').click();assert mp.evaluate('atlasNavigation.settings.borders')
    mp.locator('#closeDrawer').click();mp.locator('#zoomIn').click();assert mp.evaluate('state.zoom')>2.5
    mp.locator('#openDrawer').click()
    assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mp.locator('.drawer-scroll').evaluate('e=>e.scrollTop=e.scrollHeight')
    mp.screenshot(path=str(root/'navigation-mobile-menu.png'),full_page=True)
    mp.locator('#closeDrawer').click();mp.locator('#navWorld').click();assert mp.evaluate('state.zoom===1 && state.panX===0 && state.panY===0')
    mp.locator('#openDrawer').click();mp.locator('#desertBelt').click();assert mp.locator('#mapDrawer').is_visible()
    assert mp.evaluate('atlasNavigation.settings.desert')
    mp.locator('#closeDrawer').click();mp.locator('#atlasReset').click();assert not mp.locator('#mapDrawer').is_visible()
    assert mp.evaluate('state.view==="major" && state.selected===0 && state.framing==="height" && state.panX===0 && state.panY===0 && !atlasNavigation.settings.borders')
    mp.screenshot(path=str(root/'navigation-mobile-map.png'),full_page=True)
    assert mp.locator('#mapStage button').count()==0
    # Network errors only affect the optional boundary layer, with a real retry.
    retry=browser.new_page();retry.on('pageerror',lambda e:errors.append(str(e)))
    retry.route('**/data/boundaries/countries.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url);retry.wait_for_function('ready && window.atlasNavigation');retry.locator('#bordersToggle').click();retry.locator('#retryBorders').wait_for()
    assert retry.locator('#layerStatus').is_hidden()
    retry.unroute('**/data/boundaries/countries.json*');retry.locator('#retryBorders').click();retry.wait_for_function('atlasNavigation.ready()')
    assert not errors,errors
    print('NAVIGATION_CHECKS_PASSED: optional/lazy boundary overlay; exact pixel and state restoration; shared zoom controls; wheel point anchoring; mouse pan; actual touch pinch and drag without selection; non-overlapping Hebrew country labels; exact requested local geometry/label filter; single-side gutter latitude labels with tooltip subtitles and mobile lines-only; boundary switch placement and style; existing layers, desert marking and both months combined; full reset; independent desert switch; mobile/menu/keyboard; retry; no runtime errors',flush=True)
    browser.close()
server.shutdown()
