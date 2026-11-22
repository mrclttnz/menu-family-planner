#!/usr/bin/env bash
# Bottega Automated Security & Hygiene Scanner
# Usage: ./scripts/security-scan.sh [target_dir] [spark|forge|citadel]

set -euo pipefail

TARGET_DIR="${1:-.}"
PROFILE="${2:-auto}"

python3 - "$TARGET_DIR" "$PROFILE" <<'PYEOF'
import os
import re
import sys

target_dir = os.path.abspath(sys.argv[1])
profile = sys.argv[2].lower()

# Auto-detect profile from docs/PROJECT_STATE.md if set to auto
state_file = os.path.join(target_dir, "docs", "PROJECT_STATE.md")
if profile == "auto" and os.path.isfile(state_file):
    try:
        with open(state_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        for p in ("citadel", "forge", "spark"):
            if re.search(rf"Active Bottega Profile\*\*:\s*`?{p}`?", content, re.IGNORECASE):
                profile = p
                break
    except Exception:
        pass
if profile == "auto":
    profile = "forge"

SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
    ".next", ".nuxt", "coverage", "vendor", "target", ".agents", ".claude"
}
CODE_EXTS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".rb", ".php",
    ".cs", ".sh", ".yaml", ".yml", ".json", ".toml", ".env"
}

SECRET_PATTERNS = [
    ("CRITICAL", "Private Key Material", re.compile(r"-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----")),
    ("CRITICAL", "AWS Access Key ID", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("CRITICAL", "GitHub Personal/App Token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{36,}\b")),
    ("HIGH", "Google API Key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("HIGH", "Hardcoded Secret Assignment", re.compile(r"(?i)\b(password|passwd|api_key|secret_key|jwt_secret|private_key)\s*[:=]\s*['\"][A-Za-z0-9_\-\+/=]{12,}['\"]")),
]

CODE_RISK_PATTERNS = [
    ("HIGH", "OS Command Injection Risk (shell=True)", re.compile(r"subprocess\.(Popen|run|call|check_output)\([^)]*shell\s*=\s*True")),
    ("HIGH", "Dangerous eval/exec Usage", re.compile(r"\b(eval|exec)\s*\(")),
    ("MEDIUM", "Raw HTML Injection Risk (dangerouslySetInnerHTML / v-html)", re.compile(r"(dangerouslySetInnerHTML|v-html)")),
    ("HIGH", "TLS Verification Disabled", re.compile(r"(NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true)")),
]

findings = []

# 1. Check .gitignore for .env protection if .env exists or project has code
gitignore_path = os.path.join(target_dir, ".gitignore")
env_path = os.path.join(target_dir, ".env")
if os.path.isfile(env_path):
    has_env_ignore = False
    if os.path.isfile(gitignore_path):
        with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as gf:
            if ".env" in gf.read():
                has_env_ignore = True
    if not has_env_ignore:
        findings.append(("CRITICAL", ".env file exists without .gitignore protection", ".env", 1))

# 2. Walk files
for root, dirs, files in os.walk(target_dir):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fname in files:
        fpath = os.path.join(root, fname)
        relpath = os.path.relpath(fpath, target_dir)

        # Skip templates/examples and the scanner script itself
        if fname.endswith((".example", ".sample", ".template", ".md", ".lock", ".svg", ".png", ".jpg")):
            continue
        if relpath in ("scripts/security-scan.sh", "scripts/pre-command-guard.sh"):
            continue

        # Check Dockerfile for non-root USER
        if fname == "Dockerfile" or fname.startswith("Dockerfile."):
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as df:
                    dcontent = df.read()
                if not re.search(r"^\s*USER\s+(?!root\b)\S+", dcontent, re.MULTILINE):
                    sev = "HIGH" if profile in ("forge", "citadel") else "MEDIUM"
                    findings.append((sev, "Dockerfile missing non-root USER directive", relpath, 1))
            except Exception:
                pass
            continue

        _, ext = os.path.splitext(fname)
        if ext not in CODE_EXTS and not fname.startswith(".env"):
            continue

        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                for lineno, line in enumerate(f, start=1):
                    if "bottega-ignore" in line or "nosec" in line:
                        continue
                    for sev, label, pat in SECRET_PATTERNS:
                        if pat.search(line):
                            findings.append((sev, label, relpath, lineno))
                    if not fname.startswith(".env"):
                        for sev, label, pat in CODE_RISK_PATTERNS:
                            if pat.search(line):
                                findings.append((sev, label, relpath, lineno))
        except Exception:
            pass

print(f"=== Bottega Security Scanner (Profile: {profile.upper()}) ===")
print(f"Target Directory: {target_dir}")
if not findings:
    print("Status: PASS — Zero secrets or static security anti-patterns detected.")
    sys.exit(0)

crit_high = [f for f in findings if f[0] in ("CRITICAL", "HIGH")]
med_low = [f for f in findings if f[0] not in ("CRITICAL", "HIGH")]

for sev, label, relpath, lineno in findings:
    print(f"  [{sev}] {relpath}:{lineno} -> {label}")

print(f"\nSummary: {len(crit_high)} CRITICAL/HIGH, {len(med_low)} MEDIUM/LOW findings.")
if crit_high or (profile == "citadel" and med_low):
    print("Gate Verdict: BLOCK")
    sys.exit(1)
else:
    print("Gate Verdict: PASS_WITH_WARNINGS")
    sys.exit(0)
PYEOF
