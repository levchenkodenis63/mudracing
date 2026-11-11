import re, io, os
order=['src/core.js','src/sound.js','src/render.js','src/game.js']
html=open('index.html').read()
js='\n'.join('/* ===== %s ===== */\n%s'%(p, open(p).read()) for p in order)
html=re.sub(r'<script src="src/core.js"></script>\s*<script src="src/sound.js"></script>\s*<script src="src/render.js"></script>\s*<script src="src/game.js"></script>',
            '<script>\n'+js.replace('</script>','<\\/script>')+'\n</script>', html)
html=html.replace('<title>MUD RACING — квадроспорт</title>','<title>MUD RACING — квадроспорт с водными препятствиями</title>')
open('../MudRacing.html','w').write(html)
print('built', len(html)//1024, 'KB')
