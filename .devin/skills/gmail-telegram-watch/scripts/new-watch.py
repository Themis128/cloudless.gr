"""Create a new Gmail thread watch: writes watches/<name>.json, baselines the
thread, and posts a Telegram confirmation. The master scheduled task picks it
up automatically — no schtasks needed.

usage: python new-watch.py <name> "<gmail query>" ["<alert prefix>"] [--alert-test]

examples:
  python new-watch.py asep "in:sent to:asep.gov.gr newer_than:60d" "ASEP replied!"
  python new-watch.py acme "from:acme.com newer_than:14d" "ACME mail" --alert-test
"""

import importlib.util
import json
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    test = "--alert-test" in sys.argv
    if len(argv) < 2:
        raise SystemExit(__doc__)
    name, query = argv[0], argv[1]
    cfg = {
        "name": name,
        "query": query,
        "alert_prefix": argv[2] if len(argv) > 2 else name + " replied!",
        "chat_id": "7017840434",
    }
    path = os.path.join(DIR, "watches", name + ".json")
    if os.path.exists(path) and not test:
        raise SystemExit(f"watch '{name}' already exists: {path}")
    if not test:
        json.dump(cfg, open(path, "w", encoding="utf-8"), indent=2)
        print("wrote", path)

    spec = importlib.util.spec_from_file_location("w", os.path.join(DIR, "gmail-thread-watch.py"))
    sys.argv = ["gmail-thread-watch.py", path]
    w = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(w)
    try:
        w.main()
    except SystemExit:
        raise

    st = json.load(open(w.STATE, encoding="utf-8")) if os.path.exists(w.STATE) else {}
    if "thread_id" in st:
        m = w.api("threads/" + st["thread_id"])["messages"][-1]
        tag = "[TEST] " if test else ""
        w.tg(
            f"{tag}Watch '{name}' armed ({w.PREFIX})\n"
            f"Tracking: {w.header(m, 'Subject')}\n"
            f"Query: {query}"
        )
        print("telegram confirmation sent")
    else:
        print("NOTE: no thread matched the query yet — watch will arm when one appears")


if __name__ == "__main__":
    main()
