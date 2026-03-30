import os

path = r'c:\Users\Ritesh\Desktop\DisasterOps\frontend\src\index.css'
with open(path, 'rb') as f:
    content = f.read()

# Fix potentially corrupted encoding
if b'\x00' in content:
    # Basic de-nulling (brute force)
    content = content.replace(b'\x00', b'')

with open(path, 'wb') as f:
    f.write(content)

# Correctly rewrite the strategy block
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

clean_lines = []
skip = False
for line in lines:
    if 'STRATEGY TAB' in line:
        skip = True
    if not skip and line.strip() != '':
        clean_lines.append(line)
    elif skip and '*/' in line:
        # Stop skipping after the strategy block header if it was corrupted
        # Actually, let's just find the first occurrence of corrupted text and truncate
        pass

# Re-read and truncate at the "bad" part
final_lines = []
for line in clean_lines:
    # Check for the corrupted pattern (spaced out text)
    if 's t r a t e g y' in line:
        break
    final_lines.append(line)

strategy_block = """
/* ================================================================
   STRATEGY TAB (AI INSIGHTS)
   ================================================================ */
.strategy-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px;
}

.strategy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.strategy-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-3);
}

.trigger-btn {
  padding: 6px 12px;
  background: var(--blue-lt);
  color: var(--blue);
  border: 1.5px solid var(--blue-mid);
  border-radius: var(--r-sm);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--ease);
}

.trigger-btn:hover:not(:disabled) {
  background: var(--blue);
  color: white;
}

.trigger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.strategy-card {
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px;
  box-shadow: var(--sh-sm);
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #ffffff 0%, #f9faff 100%);
  position: relative;
  overflow: hidden;
}

.strategy-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--blue), var(--blue-mid));
}

.card-lbl {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.efficiency-meter {
  height: 32px;
  background: var(--bg-subtle);
  border-radius: var(--r-sm);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
}

.efficiency-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, var(--green), #4ade80);
  transition: width 1s ease-in-out;
}

.efficiency-meter span {
  position: relative;
  z-index: 1;
  font-weight: 800;
  font-size: 14px;
  color: var(--text);
  text-shadow: 0 0 10px rgba(255,255,255,0.5);
}

.risk-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
  font-weight: 500;
}

.action-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-list li {
  font-size: 12px;
  padding: 10px 12px;
  background: var(--blue-lt);
  border-left: 3px solid var(--blue);
  border-radius: 4px;
  color: var(--blue);
  font-weight: 600;
}

.strategy-footer {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
  line-height: 1.4;
  font-style: italic;
  margin-top: 10px;
}
"""

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)
    f.write(strategy_block)
