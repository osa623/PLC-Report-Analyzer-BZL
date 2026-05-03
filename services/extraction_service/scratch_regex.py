import re

text = """
Income Statement 238
Statement of Financial Position 240
Statement of Changes in Equity 242
Statement of Cash Flows 246
"""

keywords = ["income statement", "statement of financial position", "statement of cash flows"]
lowered_text = text.lower()

for keyword in keywords:
    pattern = re.compile(re.escape(keyword) + r"[^a-zA-Z0-9]{0,60}?(\d{1,4})(?!\d)")
    for match in pattern.finditer(lowered_text):
        print(f"Match for '{keyword}': {match.group(1)} at pos {match.start()}")
