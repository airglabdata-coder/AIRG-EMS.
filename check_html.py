from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.void_tags = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'svg', 'g', 'circle', 'rect'}
    
    def handle_starttag(self, tag, attrs):
        if tag not in self.void_tags:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag not in self.void_tags:
            if not self.stack:
                print(f"Error: Encountered closing tag </{tag}> at {self.getpos()} but stack is empty")
                return
            expected_tag, pos = self.stack.pop()
            if expected_tag != tag:
                print(f"Error: Encountered closing tag </{tag}> at {self.getpos()}, but expected </{expected_tag}> from {pos}")
                self.stack.append((expected_tag, pos)) # Push back if mismatch

parser = MyHTMLParser()
with open("index.html", "r", encoding="utf-8") as f:
    parser.feed(f.read())

if parser.stack:
    print("Unclosed tags:", parser.stack)
else:
    print("All tags matched perfectly!")
