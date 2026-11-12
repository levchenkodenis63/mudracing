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
open('docs/index.html','w',encoding='utf-8').write(html)
print('built', len(html)//1024, 'KB')
