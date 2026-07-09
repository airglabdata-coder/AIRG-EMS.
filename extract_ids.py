import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
ids = re.findall(r'id=["\'](.*?-view-container)["\']', html)
with open('ids.txt', 'w') as out:
    for i in ids:
        out.write(i + '\n')
