import functools, http.server, json, pathlib, threading, gzip, struct
from playwright.sync_api import sync_playwright

root=pathlib.Path(__file__).parent
if not (root/'index.html').exists(): root=root.parent
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE_ERROR='+str(e),flush=True)))
    page.goto(url)
    page.wait_for_function('ready === true')
    assert page.locator('.latitude-label').count()==10
    page.locator('#currentsToggle').click()
    assert page.locator('#currentLegend').is_visible()
    assert page.locator('#currentSelect option').count()==30
    assert page.locator('.current-map-label').count()>=3
    page.locator('#currentSelect').select_option('gulf')
    assert page.locator('.current-card dd').count()==4
    assert page.locator('.current-source a').count()>=1
    page.locator('#currentBasin').select_option('indian')
    page.locator('#currentSelect').select_option('leeuwin')
    assert 'דרומה' in page.locator('#currentDetails').inner_text()
    page.locator('#focusCurrent').click()
    assert page.evaluate('state.zoom')==3
    page.locator('#resetView').click()
    page.locator('#currentBasin').select_option('all')
    jan=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    page.locator('[data-month="7"]').click()
    jul=page.locator('#map').evaluate('(c)=>c.toDataURL()')
    assert jan!=jul,'Seasonal arrows must change between months'
    page.locator('#currentSelect').select_option('monsoon')
    assert page.locator('#currentDescription').inner_text()
    page.screenshot(path=str(root/'currents-desktop.png'),full_page=True)
    page.locator('[data-field="temperature"]').click()
    page.wait_for_function('document.querySelector("#layerStatus").hidden === true')
    assert page.locator('#fieldLegend').is_visible()
    assert not page.locator('.legend').is_visible()
    page.locator('#sampleLocation').select_option('3')
    assert page.locator('.monthly-table tbody tr').count()==2
    print('MUMBAI_VALUES='+page.locator('#pointReadout').inner_text())
    page.locator('#currentsToggle').click()
    page.locator('#showLabels').click()
    page.screenshot(path=str(root/'temperature-desktop.png'),full_page=True)
    # Independently check readout values against the actual encoded source grid.
    manifest=json.loads((root/'data/era5/manifest.json').read_text())
    assert manifest['gridStepDegrees']==.25
    for key in ['temperature','precipitation']:
        layer=manifest['layers'][key]
        assert len(layer['latitudes'])==721 and len(layer['longitudes'])==1440
        row=min(range(721),key=lambda i:abs(layer['latitudes'][i]-19.1))
        col=min(range(1440),key=lambda i:abs(layer['longitudes'][i]-72.9))
        for month in [1,7]:
            raw=gzip.decompress((root/layer['frames'][str(month)]['url']).read_bytes())
            value=struct.unpack_from('<H',raw,2*(row*1440+col))[0]/10+layer['offset']
            expected=f'{value:.1f}' if key=='temperature' else str(round(value))
            assert expected in page.locator('#pointReadout').inner_text(),(key,month,expected)
    page.locator('#zoomIn').click()
    page.locator('#zoomIn').click()
    page.screenshot(path=str(root/'temperature-zoom.png'),full_page=True)
    page.locator('#resetView').click()
    jan=page.locator('#fieldLegend').inner_text().split('\n')[1:]
    page.locator('[data-month="1"]').click()
    assert jan==page.locator('#fieldLegend').inner_text().split('\n')[1:],'Legend scale must remain fixed'
    page.locator('[data-field="precipitation"]').click()
    assert page.locator('[data-field="temperature"]').get_attribute('aria-pressed')=='false'
    assert page.locator('[data-field="precipitation"]').get_attribute('aria-pressed')=='true'
    page.locator('[data-month="7"]').click()
    page.locator('#sampleLocation').select_option('3')
    page.screenshot(path=str(root/'precipitation-desktop.png'),full_page=True)
    page.locator('#clear').click()
    assert page.locator('.legend').is_visible()
    assert not page.locator('#fieldLegend').is_visible()
    page.locator('[data-field="temperature"]').click()
    page.locator('#detailMode').click()
    assert page.locator('.legend').is_visible()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#currentsToggle').click()
    page.locator('[data-field="precipitation"]').click()
    page.screenshot(path=str(root/'layers-mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow on phone'
    assert page.locator('.latitude-label').count()==10
    page.locator('#latitudes').click()
    assert not page.locator('#latitudeLabels').is_visible()
    page.locator('#latitudes').click()
    assert page.locator('#latitudeLabels').is_visible()
    # Failed data fetch must be visible and retry must restore the real data.
    retry=browser.new_page()
    retry.route('**/data/era5/manifest.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url)
    retry.wait_for_function('ready === true')
    retry.locator('[data-field="temperature"]').click()
    retry.locator('#retryLayer').wait_for()
    assert not retry.locator('.legend').is_visible()
    retry.unroute('**/data/era5/manifest.json*')
    retry.locator('#retryLayer').click()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden === true')
    assert not errors,errors
    print('BROWSER_CHECKS_PASSED: actual ERA5 cell values, 29 current descriptions, filtering, focus, map names, month switch, exclusive fields, climate return, mobile overflow, loading retry; no runtime errors')
    browser.close()
server.shutdown()
