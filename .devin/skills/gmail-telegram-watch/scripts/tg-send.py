"""Send a Telegram message via @Cloudless_newbot — generic notify tool.

usage: python tg-send.py "message text" [--chat 7017840434]
Reads bot token from %APPDATA%/devin/secrets/tg-bot-token.
Exit 0 on ok:true, 1 otherwise. Prints the Telegram response."""

import json
import sys
import urllib.parse
import urllib.request

KEYS = "C:/Users/tbaltzakis/AppData/Roaming/devin/secrets"
DEFAULT_CHAT = "7017840434"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    chat = DEFAULT_CHAT
    if "--chat" in sys.argv:
        chat = sys.argv[sys.argv.index("--chat") + 1]
    if not args:
        print('usage: tg-send.py "text" [--chat ID]')
        sys.exit(2)
    text = " ".join(args)
    bot = open(KEYS + "/tg-bot-token").read().strip()
    data = urllib.parse.urlencode({"chat_id": chat, "text": text}).encode()
    r = json.loads(
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{bot}/sendMessage", data=data, timeout=15
        ).read()
    )
    print(json.dumps({"ok": r.get("ok"), "message_id": r.get("result", {}).get("message_id")}))
    sys.exit(0 if r.get("ok") else 1)


if __name__ == "__main__":
    main()
