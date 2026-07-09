import sys
from html.parser import HTMLParser

class BalanceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.void_tags = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'svg', 'g', 'circle', 'rect'}
        self.results = []
        self.container_open = None

    def handle_starttag(self, tag, attrs):
        if tag not in self.void_tags:
            attrs_dict = dict(attrs)
            if 'class' in attrs_dict and 'container' in attrs_dict['class'].split() and tag == 'div':
                self.container_open = len(self.stack)
            self.stack.append((tag, attrs_dict.get('id')))

    def handle_endtag(self, tag):
        if tag not in self.void_tags:
            if not self.stack:
                self.results.append(f"Extra closing tag: {tag} at line {self.getpos()[0]}")
                return
            expected_tag, tag_id = self.stack.pop()
            if expected_tag != tag:
                self.results.append(f"Mismatch at line {self.getpos()[0]}: expected </{expected_tag}> (id={tag_id}), got </{tag}>")
                # try to sync
                while self.stack:
                    expected_tag, tag_id = self.stack.pop()
                    if expected_tag == tag:
                        break

parser = BalanceParser()
with open("index.html", "r", encoding="utf-8") as f:
    parser.feed(f.read())

with open("parse_results.txt", "w", encoding="utf-8") as f:
    for r in parser.results:
        f.write(r + "\n")
    f.write("Unclosed tags remaining: " + str(len(parser.stack)) + "\n")
    if parser.stack:
        for t in parser.stack:
            f.write(f" - {t}\n")
