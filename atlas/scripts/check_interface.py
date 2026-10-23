import functools, http.server, json, pathlib, threading, gzip, struct, os
from playwright.sync_api import sync_playwright

root=pathlib.Path(__file__).parent.parent
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('ATLAS_CHROMIUM_PATH'))
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE_ERROR='+str(e),flush=True)))
    page.goto(url);page.wait_for_function('ready && window.atlasInterface')
    def click(s): page.locator(s).click()
    def dock(name):
        if not page.locator('#mapDrawer').is_visible(): click('#openDrawer')
        click('#tab'+name.capitalize())
    def settings():
        dock('layers')
        if not page.locator('.display-settings').evaluate('e=>e.open'): click('.display-settings summary')
    def info(kind='data'):
        dock('info')
        if page.locator('#infoChoices').is_visible(): click('#'+kind+'Info')
    def shot(name): page.screenshot(path=str(root/(name+'.png')),full_page=True)
    assert page.locator('.latitude-label').count()==10
    assert page.locator('#mapStage button').count()==0
    assert page.locator('#mapStage').bounding_box()['y']<200
    shot('ui-desktop')
    width=page.locator('#mapStage').bounding_box()['width']
    click('#closeDrawer');assert page.locator('#mapStage').bounding_box()['width']>width+250
    click('#openDrawer');page.locator('#tabLayers').focus();page.keyboard.press('ArrowLeft')
    assert page.locator('#tabLegend').get_attribute('aria-selected')=='true'
    page.keyboard.press('Escape');assert not page.locator('#mapDrawer').is_visible()
    dock('legend');click('#legendItems [data-region="101"]')
    assert page.locator('#tabInfo').get_attribute('aria-selected')=='true'
    assert page.evaluate('state.selected')==101
    dock('legend');click('#clear');assert page.evaluate('state.selected')==0
    dock('layers');click('#currentsToggle');click('#openCurrents')
    assert page.locator('#currentLegend').is_visible()
    assert page.locator('#currentSelect option').count()==30
    assert page.locator('.current-map-label').count()>=3
    settings();click('#currentLabelsToggle');assert not page.locator('#currentMapLabels').is_visible()
    click('#currentLabelsToggle');assert page.locator('.current-map-label').count()>=3
    info('current');page.locator('#currentSelect').select_option('gulf')
    assert page.locator('.current-card dd').count()==4
    assert page.locator('.current-source a').count()>=1
    page.locator('#currentBasin').select_option('indian');page.locator('#currentType').select_option('cold')
    assert page.locator('#currentSelect option').count()==2
    assert 'מערב אוסטרליה' in page.locator('#currentSelect').inner_text()
    page.locator('#currentType').select_option('all');page.locator('#currentSelect').select_option('leeuwin')
    assert 'דרומה' in page.locator('#currentDetails').inner_text()
    click('#resetCurrent');assert page.locator('.current-card').count()==0
    page.locator('#currentSelect').select_option('leeuwin');click('#focusCurrent')
    assert page.evaluate('state.zoom')==3
    click('#resetView');page.locator('#currentBasin').select_option('all')
    jan=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    dock('layers');click('[data-month="7"]');assert jan!=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    info('current');page.locator('#currentSelect').select_option('monsoon');shot('currents-desktop')
    dock('layers');click('[data-field="temperature"]')
    page.wait_for_function('document.querySelector("#layerStatus").hidden')
    assert page.locator('#compactLegend .field-gradient').is_visible()
    info();page.locator('#sampleLocation').select_option('3')
    readout=page.locator('#pointReadout').inner_text();print('MUMBAI_VALUES='+readout)
    manifest=json.loads((root/'data/era5/manifest.json').read_text())
    assert manifest['gridStepDegrees']==.25
    for key in ['temperature','precipitation']:
        layer=manifest['layers'][key]
        assert len(layer['latitudes'])==721 and len(layer['longitudes'])==1440
        row=min(range(721),key=lambda i:abs(layer['latitudes'][i]-19.1));col=min(range(1440),key=lambda i:abs(layer['longitudes'][i]-72.9))
        for month in [1,7]:
            raw=gzip.decompress((root/layer['frames'][str(month)]['url']).read_bytes())
            value=struct.unpack_from('<H',raw,2*(row*1440+col))[0]/10+layer['offset']
            expected=f'{value:.1f}' if key=='temperature' else str(round(value))
            assert expected in readout,(key,month,expected)
    dock('layers');click('#currentsToggle');settings();click('#showLabels');info();shot('temperature-desktop')
    click('#zoomIn');click('#zoomIn');shot('temperature-zoom');click('#resetView')
    ticks=page.locator('#compactLegend .field-ticks').inner_text()
    dock('layers');click('[data-month="1"]');assert ticks==page.locator('#compactLegend .field-ticks').inner_text()
    click('[data-field="precipitation"]');assert page.locator('[data-field="temperature"]').get_attribute('aria-pressed')=='false'
    assert page.locator('[data-field="precipitation"]').get_attribute('aria-pressed')=='true'
    click('[data-month="7"]');info();page.locator('#sampleLocation').select_option('3');shot('precipitation-desktop')
    dock('layers');click('#climateBase');click('#detailMode');dock('legend')
    assert page.locator('#legendItems button').count()==13
    click('#clear');info();click('[data-tab="compare"]');assert page.evaluate('state.tab')=='compare'
    click('[data-tab="inquiry"]');assert page.evaluate('state.tab')=='inquiry'
    dock('layers');click('#mainMode')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function('!document.querySelector("#mapDrawer").open')
    assert page.locator('#mapStage').bounding_box()['y']<200
    assert page.locator('#mapStage').bounding_box()['height']<320
    assert page.locator('.latitude-label').count()==10
    shot('ui-mobile');dock('layers')
    assert page.locator('#mapDrawer').evaluate("d=>d.matches(':modal')")
    shot('ui-mobile-controls')
    for _ in range(20):
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector("#mapDrawer").contains(document.activeElement)')
    page.keyboard.press('Escape');assert not page.locator('#mapDrawer').is_visible()
    assert page.locator('#openDrawer').evaluate('e=>e===document.activeElement')
    dock('layers');click('[data-field="precipitation"]');click('#applyDrawer');shot('layers-mobile')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    settings();click('#latitudes');assert not page.locator('#latitudeLabels').is_visible()
    click('#latitudes');assert page.locator('#latitudeLabels').is_visible();click('#applyDrawer')
    click('.header-menu summary');click('#fontSize');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    click('.header-menu summary');click('#sources');assert page.locator('#sourceDialog').is_visible();click('#closeSources')
    retry=browser.new_page();retry.on('pageerror',lambda e:errors.append(str(e)))
    retry.route('**/data/era5/manifest.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url);retry.wait_for_function('ready && window.atlasInterface')
    retry.locator('[data-field="temperature"]').click();retry.locator('#retryLayer').wait_for()
    assert retry.locator('#layerStatus').is_visible()
    retry.unroute('**/data/era5/manifest.json*');retry.locator('#retryLayer').click()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden')
    assert not errors,errors
    print('BROWSER_CHECKS_PASSED: map-first desktop/mobile layout; no controls over canvas; drawer, keyboard tabs, Escape, modal focus; climate legends, comparison, inquiry; actual ERA5 values; 29 currents; months, zoom, labels, font size, sources, retry; no runtime errors')
    browser.close()
server.shutdown()
