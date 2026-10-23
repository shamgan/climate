import functools, http.server, json, pathlib, threading
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
    retry.route('**/data/climatology.json*',lambda route:route.fulfill(status=503,body='unavailable'))
    retry.goto(url)
    retry.wait_for_function('ready === true')
    retry.locator('[data-field="temperature"]').click()
    retry.locator('#retryLayer').wait_for()
    assert not retry.locator('.legend').is_visible()
    retry.unroute('**/data/climatology.json*')
    retry.locator('#retryLayer').click()
    retry.wait_for_function('document.querySelector("#layerStatus").hidden === true')
    assert not errors,errors
    print('BROWSER_CHECKS_PASSED: month switch, exclusive fields, currents overlay, latitude labels, climate return, mobile overflow, loading retry; no runtime errors')
    browser.close()
server.shutdown()
