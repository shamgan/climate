"""Browser integration and independent numeric checks for additive teaching layers."""
import functools, gzip, hashlib, http.server, json, math, os, pathlib, struct, threading
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).parent.parent
# Original data/field fingerprints; interface.css updated for the authorized viewport UI.
preserved = {
    'layers.js':'cc7f4e338e18e0a30cc2220c048a0838ebef1203',
    'layers.css':'49d66d14ed993872f4273378b22546ea38d1fa7a',
    'currents.js':'f1aa87d81cd8fa8a9f1361cde68af62cf95369ce',
    'interface.css':'abf9ee105360ef076a23860572578c935d7b012e',
    'data/era5/manifest.json':'2d5abe3ff4cab612ee4949ca4183730ee448b31a',
    'data/era5/temperature-01.bin.gz':'7e1065e6a47953b9a6ac872e4e53abfb75015dc4',
    'data/era5/temperature-07.bin.gz':'404e668939526521ee0cd45b1ffcbfdbde6e93af',
    'data/era5/precipitation-01.bin.gz':'4e437d52ef2250d86ed7028de266264ae7ff060e',
    'data/era5/precipitation-07.bin.gz':'cc911ad0c0473b849368886d8bf39bfed5547555',
}
for path, expected in preserved.items():
    data=(root/path).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==expected,path
print('LAYER_ASSETS_VERIFIED: authorized UI/monthly manifest; original January/July data and current geometry unchanged',flush=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
manifest = json.loads((root/'data/terrain/manifest.json').read_text())
compressed = (root/manifest['file']['url']).read_bytes()
assert hashlib.sha256(compressed).hexdigest() == manifest['file']['sha256']
raw = gzip.decompress(compressed)
assert len(raw) == 3600*1801*2

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page = browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_function('ready && window.atlasLearning')
    def click(s):
        page.locator(s).click()
        if s.startswith('[data-month=') or s.startswith('[data-field='):page.wait_for_function('document.querySelector("#layerStatus").hidden')
    def dock(name):
        if not page.locator('#mapDrawer').is_visible():click('#openDrawer')
        click('#tab'+name.capitalize())
    def shot(name):page.screenshot(path=str(root/(name+'.png')),full_page=True)
    def canvas_hash():return page.locator('#map').evaluate('(c)=>c.toDataURL()')
    def existing():return page.evaluate('({climate:{...climateLayers.settings},view:state.view,selected:state.selected,tab:state.tab})')
    click('#navWorld')
    before=existing();base_image=canvas_hash()
    assert page.locator('#tabLearning').is_hidden()
    assert page.locator('#mapStage button').count()==0
    assert not page.locator('#learningAccordion').evaluate('e=>e.open')
    click('#learningAccordion summary')
    for layer in ['atmosphere','solar','terrain']:
        click('#'+layer+'Toggle')
        assert page.locator('#'+layer+'Toggle').get_attribute('aria-pressed')=='true'
        assert existing()==before, 'Overlay changed existing layer state'
    page.wait_for_function('atlasLearning.terrainReady()',timeout=60000)
    assert canvas_hash()!=base_image
    assert page.locator('.latitude-label').count()==5
    assert page.locator('#monthControl').is_visible()
    assert page.locator('#terrainStatus').is_hidden()
    assert page.evaluate('atlasLearning.terrainInfo().sha256')==manifest['file']['sha256']
    for sample in manifest['validationSamples']:
        lon,lat=sample['longitude'],sample['latitude']
        row=round((90-lat)/.1);col=round((lon+180)/.1)%3600
        expected=struct.unpack_from('<h',raw,2*(row*3600+col))[0]
        actual=page.evaluate('p=>atlasLearning.elevationAt(...p)',[lon,lat])
        assert actual==(None if 'seabed' in sample['place'] else expected),(sample,expected,actual)
    shot('learning-all-desktop')
    click('#openLearning');assert page.locator('#dockLearning').is_visible()
    page.locator('#learningTopic').select_option('solar');page.locator('#learningPlace').select_option('0')
    assert page.locator('#solarDaylight').inner_text()=='10:08'
    assert page.locator('#solarAltitude').inner_text()=='36.9°'
    jan=canvas_hash();click('[data-month="7"]')
    assert page.evaluate('climateLayers.settings.month')==7
    assert page.locator('#solarDaylight').inner_text()=='13:54'
    assert page.locator('#solarAltitude').inner_text()=='79.9°'
    assert jan!=canvas_hash()
    page.locator('#learningPlace').select_option('5');assert page.locator('#solarDaylight').inner_text()=='24:00'
    shot('learning-solar-desktop')
    click('[data-month="1"]');assert page.locator('#solarDaylight').inner_text()=='0:00'
    assert float(page.locator('#solarAltitude').inner_text().replace('°',''))<0
    page.locator('#learningPlace').select_option('1');assert page.locator('#solarDaylight').inner_text()=='12:00'
    page.locator('#learningTopic').select_option('atmosphere')
    click('[data-pressure-point="30"]');assert 'גבוה' in page.locator('#pressureTitle').inner_text()
    shot('learning-pressure-desktop')
    click('[data-pressure-point="0"]');assert 'התכנסות' in page.locator('#pressureTitle').inner_text()
    click('[data-pressure-point="60"]');assert 'נמוך' in page.locator('#pressureTitle').inner_text()
    page.locator('#learningTopic').select_option('terrain')
    assert not page.locator('#learningMonths').count()
    page.locator('#ridgeSelect').select_option('himalaya');click('#focusRidge')
    assert page.evaluate('state.zoom')==3
    elevation=page.locator('#terrainElevation').inner_text();assert elevation not in ['מחוץ ליבשה','טוען…']
    click('#orographicStep');click('#orographicStep')
    wet=page.locator('#orographicScene').evaluate('c=>c.toDataURL()')
    assert 'רוויה' in page.locator('#orographicStepText').inner_text()
    shot('learning-terrain-zoom')
    click('#orographicMoist');assert wet!=page.locator('#orographicScene').evaluate('c=>c.toDataURL()')
    assert 'לא נוצר ענן' in page.locator('#orographicStepText').inner_text()
    click('#orographicReset');assert page.evaluate('atlasLearning.sceneProgress()')==0
    click('#orographicPlay');page.wait_for_timeout(200);click('#orographicPlay')
    paused=page.evaluate('atlasLearning.sceneProgress()');assert paused>0
    page.wait_for_timeout(150);assert page.evaluate('atlasLearning.sceneProgress()')==paused
    click('#orographicReset');assert page.evaluate('atlasLearning.sceneProgress()')==0
    click('#orographicMoist');click('#orographicStep');click('#orographicStep');click('#orographicStep')
    assert 'יורד' in page.locator('#orographicStepText').inner_text()
    low=canvas_hash();page.locator('#terrainOpacity').fill('15');assert low!=canvas_hash()
    page.locator('#terrainOpacity').fill('65');click('#navWorld')
    # Explicit inspection consumes only the new-layer click, preserving base selection.
    before_pick=existing();click('#pickLearningPoint')
    assert page.evaluate('atlasLearning.settings.inspect')
    pos=page.evaluate('()=>{const p=projection([88,33]),r=canvas.getBoundingClientRect();return{x:r.left+view.x+p[0]*view.s,y:r.top+view.y+p[1]*view.s}}')
    page.mouse.click(pos['x'],pos['y']);assert page.locator('#dockLearning').is_visible()
    assert existing()==before_pick
    assert abs(page.evaluate('atlasLearning.settings.point[1]')-33)<.2
    assert '5,061' in page.locator('#terrainElevation').inner_text()
    click('#learningInspect');assert not page.evaluate('atlasLearning.settings.inspect')
    # Overlay state coexists with actual old monthly fields and currents.
    dock('layers');click('[data-field="precipitation"]');click('#currentsToggle')
    page.wait_for_function('document.querySelector("#layerStatus").hidden')
    state_with_old=existing();assert state_with_old['climate']['field']=='precipitation'
    assert state_with_old['climate']['currents']
    assert page.locator('#compactLegend .field-gradient').is_visible()
    for layer in ['terrain','solar','atmosphere']:click('#'+layer+'Toggle')
    assert existing()==state_with_old
    assert page.locator('#tabLearning').is_hidden()
    click('#currentsToggle');click('#climateBase')
    assert canvas_hash()==base_image, 'All overlays off did not restore original map pixels'
    # Add a new layer again; existing three tabs plus the optional fourth are keyboard reachable.
    click('#solarToggle');page.locator('#tabLayers').focus();page.keyboard.press('End')
    assert page.locator('#tabLearning').get_attribute('aria-selected')=='true'
    page.keyboard.press('ArrowLeft');assert page.locator('#tabLayers').get_attribute('aria-selected')=='true'
    for width,height in [(1280,720),(1024,768),(800,1280),(390,844),(360,740)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('#mapStage button').count()==0
        if width<=900:
            dock('learning');assert page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')")
            page.locator('#learningTopic').select_option('solar')
            for _ in range(8):
                page.keyboard.press('Tab');assert page.evaluate('document.querySelector("#mapDrawer").contains(document.activeElement)')
            if width==390:shot('learning-solar-mobile')
            click('#pickLearningPoint');assert not page.locator('#mapDrawer').is_visible()
            if width==390:shot('learning-solar-mobile-map')
            click('#learningInspect')
    # Fault recovery is isolated to the new terrain data.
    retry=browser.new_page();retry.on('pageerror',lambda e:errors.append(str(e)))
    retry.route('**/data/terrain/manifest.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url);retry.wait_for_function('ready && window.atlasLearning')
    retry.locator('#learningAccordion summary').click();retry.locator('#terrainToggle').click();retry.locator('#retryTerrain').wait_for()
    assert retry.locator('#layerStatus').is_hidden()
    retry.unroute('**/data/terrain/manifest.json*');retry.locator('#retryTerrain').click()
    retry.wait_for_function('atlasLearning.terrainReady()',timeout=60000)
    assert not errors,errors
    print('LEARNING_CHECKS_PASSED: all toggles, exact old-state preservation and pixel restoration; real 0.1-degree height samples; sun numeric/polar cases; independent inspection; actual ERA5 and currents combined; orographic animation pause/step/reset/humidity; keyboard/mobile; retry; no runtime errors',flush=True)
    browser.close()
server.shutdown()
