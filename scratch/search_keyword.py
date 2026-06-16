import sys
import os

if len(sys.argv) < 3:
    print('Usage: python search_keyword.py <file> <query>')
    sys.exit(1)

file_name = sys.argv[1]
query = sys.argv[2].lower()

file_path = file_name if os.path.isabs(file_name) else os.path.join(os.path.dirname(__file__), '..', file_name)
if not os.path.exists(file_path):
    print(f'File does not exist: {file_path}')
    sys.exit(1)

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

count = 0
for index, line in enumerate(lines):
    if query in line.lower():
        print(f'{index + 1}: {line.strip()}')
        count += 1

print(f'\nFound {count} matches for "{query}" in {file_name}')
