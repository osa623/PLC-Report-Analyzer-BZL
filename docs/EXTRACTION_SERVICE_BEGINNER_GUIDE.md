# 🚀 The Absolute Beginner's Guide to the Extraction Service

Welcome! If you are looking at this code and feeling overwhelmed, don't worry. This guide is written exactly for you. We will walk through this entire system without using confusing jargon. By the end of this guide, you will understand how this machine works from A to Z, what every folder does, and how you can safely make changes to it.

---

## 📖 1. What does this service actually do? (The Big Picture)

Imagine you have a giant, 200-page financial report for a company like Apple or Tesla. Somewhere in those hundreds of pages are specific numbers we want: "Total Revenue," "Net Income," "Cash Flow." 

Finding these manually takes hours. **The Extraction Service is a team of robotic assistants that reads the PDF for you, finds exactly those numbers, understands what they mean, and saves them neatly into an organized spreadsheet.**

**Here is the A-Z Flow of how a document is processed:**

1. **The Knock on the Door (The Request):** The system is told, *"Hey, look at this PDF (Report ID: 12345)."*
2. **The Status Update (Job Management):** The system immediately shouts over a loudspeaker: *"I am starting to work on Report 12345!"* (This updates the status so users aren't left waiting blindly).
3. **The Book Slicer (Pipeline & Chunkers):** A robotic arm takes the 200-page PDF and slices it into smaller, manageable chunks or pages. It's too big to read all at once!
4. **The Specialists (Extractors):** Different "specialists" are called in. One specialist ONLY looks for Income Statements. Another ONLY looks for the Balance Sheet. 
5. **The Smart Brains (Integrations & LLMs):** The specialists can't read human text perfectly, so they pass snippets of text to super-smart AI assistants (like ChatGPT, Claude, or Google Gemini) and ask, *"Hey, what is the Total Revenue in this text block?"*
6. **The Filing Cabinet (Storage):** Once the answers are gathered, they are neatly typed up and saved into our permanent filing cabinet (the database) so other services can see the results.
7. **The Final Announcement (Success/Fail):** The system shouts over the loudspeaker: *"I am completely done with Report 12345!"*

---

## 📁 2. The Code Structure: What does every folder and file do?

Here is a map of the `extraction_service` folder. Think of it like rooms in an office building.

### The Front Desk (Main Files)
* **`app.py` & `orchestrator.py`**: These are the main office managers. `app.py` usually sits and listens for incoming work. `orchestrator.py` is the boss who directs traffic: telling the PDF to load, telling the specialists to extract, and telling the database to save.
* **`config.py`**: The sticky note with all the important passwords, settings, and addresses (like "Where is the database located?").
* **`strict_pipeline.py`**: The strict rulebook. It dictates the exact, rigid order things must happen to guarantee we don't mess up financial data.

### 📢 `job_manager.py` (The Loudspeaker / Status Tracker)
You were specifically looking at this file. Think of `Redis` as a big whiteboard in the middle of the office where everyone writes their current status.
* `mark_running(...)`: Erases the old board and writes "EXTRACTION: We just started running!"
* `mark_success(...)`: Crosses out "running" and writes "EXTRACTION: Completed successfully! 🎉"
* `mark_failed(...)`: Writes "EXTRACTION: Failed! 🚨 Here is why..."
* `mark_substage(...)`: Writes detailed updates. E.g., "I'm currently looking for tables" -> "Okay, now I'm mapping fields." It keeps the user interface loading bars accurate!

### 🕵️ `extractors/` (The Specialists)
Inside this folder, you have separate Python files for different financial concepts (`balance_sheet.py`, `cashflow.py`, `income_statement.py`). 
* If you want to know how the service extracts cash flow, you open `cashflow.py`. 
* Each file knows the exact vocabulary and rules to look for in its specific domain.

### 🏭 `pipeline/` (The Assembly Line)
This handles the physical document manipulation.
* `pdf_loader.py`: Opens the actual PDF file.
* `chunker.py`: Chops large text into smaller paragraphs so the AI doesn't get overwhelmed.
* `structure_detector.py`: Scans the document to figure out "Ah, page 14 looks like a massive data table."

### 🧠 `integrations/` & `llm/` (The Interpreters / Smart Brains)
Our code is written in Python, but it relies on external AI to read text.
* `openai_client.py`, `anthropic_client.py`, `gemini_client.py`: These are the literal telephones our code uses to call ChatGPT, Claude, or Google. It dials out, whispers the text, and writes down the AI's answer.
* `prompt_loader.py` (in `llm/`): A prompt is the instruction we give the AI (e.g., *"You are a financial expert. Read this text and find Revenue..."*). This file loads those instructions.

### 🗄️ `storage/` (The Filing Cabinets)
* `canonical_raw_repository.py`: A very fancy way of saying "The script that saves our final, verified answers deep into the database securely."

---

## 🛠️ 3. How to Make Manual Changes (Without Breaking Things)

If you are a beginner, the thought of changing code is scary. Here is a safe, step-by-step guide to making changes depending on what you want to do:

### Scenario A: You want to add a brand new number to extract from the Income Statement.
1. **Find the right specialist**: Open `extractors/income_statement.py`.
2. **Find the list of targets**: You will likely see a list or a "class" defining what it's looking for (e.g., `Revenue`, `Cost of Goods Sold`).
3. **Add your new item**: Type in your new target exactly how the others are formatted (e.g., `Gross Margin`).
4. **Update the Prompt**: You might need to change the instructions sent to the AI in `llm/prompt_loader.py` (or inside the extractor) to explicitly say, *"Also search for 'Gross Margin'."*

### Scenario B: The system is crashing on a specific document, and you want to see why.
1. First, check the "whiteboard". The `job_manager.py::mark_failed` function saves the error. That error usually points to an exact line number.
2. If it says it failed in `pipeline/chunker.py`, go to that file. 
3. **Use print statements!** As a beginner, the easiest way to debug is to type `print("I made it to this line!")` or `print(text_variable)` to see what the machine was thinking right before it crashed.

### Scenario C: You want the loading bar on the website to show more detail.
1. Go to `job_manager.py`.
2. When the orchestrator moves from one tiny task to another, tell it to call `mark_substage(redis, report_id, "my_new_substage", "running")`.
3. The frontend (website) reads this and will show the user that you are on this new step!

---

## 💡 Top 3 Rules for Beginners Working in This Codebase

1. **Don't touch the Database (Storage) alone**: Changing how data is saved can break everything downstream. Always ask a senior developer if you need to alter `storage/` files.
2. **Read the Comments**: The # hashtags in the code are notes left by previous developers explaining *why* they did something.
3. **Follow the Flow**: If you get lost, go back to `orchestrator.py` or `strict_pipeline.py`. Read it strictly from top to bottom like a book chapter. Those files will tell you exactly what file is called next.

You've got this! Start small, read the files like English sentences, and trace the path from the moment the job starts to the moment it finishes.