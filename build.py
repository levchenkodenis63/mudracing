import re, io, os
order=['src/core.js','src/store.js','src/sound.js','src/render.js','src/game.js']
html=open('index.html',encoding='utf-8').read()

# фото встраиваем как data-URI, чтобы одиночный файл не зависел от папки img/
import base64, os, json
def embed(m):
    path=m.group(1)
    if not os.path.exists(path): return m.group(0)
    b64=base64.b64encode(open(path,'rb').read()).decode('ascii')
    return 'url("data:image/jpeg;base64,'+b64+'")'
html=re.sub(r'url\("(img/[\w-]+\.jpg)"\)', embed, html)

# вопросы по регламенту («Экстрим») встраиваем в <script type="application/json">
if os.path.exists('questions.json'):
    q=json.dumps(json.load(open('questions.json',encoding='utf-8')), ensure_ascii=False).replace('</','<\\/')
    html=html.replace('<script type="application/json" id="mr-questions" data-src="questions.json"></script>',
                      '<script type="application/json" id="mr-questions">'+q+'</script>')
js='\n'.join('/* ===== %s ===== */\n%s'%(p, open(p).read()) for p in order)
inline='<script>\n'+js.replace('</script>','<\\/script>')+'\n</script>'
html=re.sub(r'(?:<script src="src/[a-z]+\.js"></script>\s*)+', lambda m: inline, html)
html=html.replace('<title>MUD RACING — квадроспорт</title>','<title>MUD RACING — квадроспорт с водными препятствиями</title>')
# PWA: манифест, иконки, service worker (исходники в pwa/, копируются в docs/)
import hashlib, shutil
PWA_HEAD = """<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0b0c0f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="MUD RACING">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>"""
html=html.replace('<!--pwa: build.py вставляет сюда манифест, иконки и регистрацию service worker-->', PWA_HEAD)
open('docs/index.html','w',encoding='utf-8').write(html)
build=hashlib.sha1(html.encode('utf-8')).hexdigest()[:10]
os.makedirs('docs/icons', exist_ok=True)
for f in sorted(x for x in os.listdir('pwa/icons') if x.endswith('.png')):
    shutil.copyfile(os.path.join('pwa/icons', f), os.path.join('docs/icons', f))
shutil.copyfile('pwa/manifest.webmanifest', 'docs/manifest.webmanifest')
shutil.copyfile('pwa/install.html', 'docs/install.html')     # инструкция по установке с картинками
open('docs/sw.js','w',encoding='utf-8').write(open('pwa/sw.js',encoding='utf-8').read().replace('__BUILD__', build))
print('built', len(html)//1024, 'KB')
