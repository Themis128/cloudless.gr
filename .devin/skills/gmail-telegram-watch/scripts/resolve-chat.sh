#!/bin/bash
# resolve telegram chat/channel id once user messages @Cloudless_newbot
TOK=$(cat 'C:/Users/tbaltzakis/AppData/Roaming/devin/secrets/tg-bot-token')
curl -s "https://api.telegram.org/bot$TOK/getUpdates?limit=100" | python -c "
import json,sys
d=json.load(sys.stdin)
seen={}
for u in d.get('result',[]):
    for k in ('message','channel_post','my_chat_member','chat_member'):
        c=u.get(k,{}).get('chat')
        if c:seen[c['id']]=(c.get('type'),c.get('title') or c.get('username') or c.get('first_name'))
for i,(t,n) in seen.items():print(i,t,n)
if not seen:print('none yet — message the bot first')"
