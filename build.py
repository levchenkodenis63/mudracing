import re, io, os
order=['src/core.js','src/store.js','src/sound.js','src/render.js','src/game.js']
html=open('index.html',encoding='utf-8').read()

# фото встраиваем как data-URI, чтобы одиночный файл не зависел от папки img/
import base64, os
if os.path.exists('img/hero.jpg'):
    b64=base64.b64encode(open('img/hero.jpg','rb').read()).decode('ascii')
    uri='url("data:image/jpeg;base64,'+b64+'")'
    html=html.replace('--hero:url("img/hero.jpg")','--hero:'+uri).replace('--hero: url("img/hero.jpg")','--hero:'+uri)
js='\n'.join('/* ===== %s ===== */\n%s'%(p, open(p).read()) for p in order)
inline='<script>\n'+js.replace('</script>','<\\/script>')+'\n</script>'
html=re.sub(r'(?:<script src="src/[a-z]+\.js"></script>\s*)+', lambda m: inline, html)
html=html.replace('<title>MUD RACING — квадроспорт</title>','<title>MUD RACING — квадроспорт с водными препятствиями</title>')
open('docs/index.html','w',encoding='utf-8').write(html)
print('built', len(html)//1024, 'KB')
