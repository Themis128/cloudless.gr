# Amazon WorkMail endpoint reference

Authoritative source: <https://docs.aws.amazon.com/general/latest/gr/workmail.html>
Mirrored 2026-06-15. Re-check when adding a new region or after any AWS
WorkMail announcement.

WorkMail is available in **three** AWS regions only: `us-east-1`, `us-west-2`,
`eu-west-1`. Picking the wrong region is the most common configuration error
— the protocols silently 404 or time out instead of failing loudly.

## Service endpoints (SDK / control plane)

| Region    | Service             | Endpoint                                            |
| --------- | ------------------- | --------------------------------------------------- |
| us-east-1 | WorkMail SDK        | <https://workmail.us-east-1.amazonaws.com>          |
| us-east-1 | Message Flow SDK    | <https://workmailmessageflow.us-east-1.amazonaws.com> |
| us-west-2 | WorkMail SDK        | <https://workmail.us-west-2.amazonaws.com>          |
| us-west-2 | Message Flow SDK    | <https://workmailmessageflow.us-west-2.amazonaws.com> |
| eu-west-1 | WorkMail SDK        | <https://workmail.eu-west-1.amazonaws.com>          |
| eu-west-1 | Message Flow SDK    | <https://workmailmessageflow.eu-west-1.amazonaws.com> |

## Email-protocol endpoints (what Outlook/clients use)

| Region    | Protocol      | Endpoint                                                                                |
| --------- | ------------- | --------------------------------------------------------------------------------------- |
| us-east-1 | Autodiscover  | `https://autodiscover-service.mail.us-east-1.awsapps.com/autodiscover/autodiscover.xml` |
| us-east-1 | EWS           | `https://ews.mail.us-east-1.awsapps.com/EWS/Exchange.asmx`                              |
| us-east-1 | ActiveSync    | `https://mobile.mail.us-east-1.awsapps.com/Microsoft-Server-ActiveSync`                 |
| us-east-1 | IMAPS         | `imap.mail.us-east-1.awsapps.com:993`                                                   |
| us-east-1 | SMTPS         | `smtp.mail.us-east-1.awsapps.com:465`                                                   |
| us-west-2 | Autodiscover  | `https://autodiscover-service.mail.us-west-2.awsapps.com/autodiscover/autodiscover.xml` |
| us-west-2 | EWS           | `https://ews.mail.us-west-2.awsapps.com/EWS/Exchange.asmx`                              |
| us-west-2 | ActiveSync    | `https://mobile.mail.us-west-2.awsapps.com/Microsoft-Server-ActiveSync`                 |
| us-west-2 | IMAPS         | `imap.mail.us-west-2.awsapps.com:993`                                                   |
| us-west-2 | SMTPS         | `smtp.mail.us-west-2.awsapps.com:465`                                                   |
| eu-west-1 | Autodiscover  | `https://autodiscover-service.mail.eu-west-1.awsapps.com/autodiscover/autodiscover.xml` |
| eu-west-1 | EWS           | `https://ews.mail.eu-west-1.awsapps.com/EWS/Exchange.asmx`                              |
| eu-west-1 | ActiveSync    | `https://mobile.mail.eu-west-1.awsapps.com/Microsoft-Server-ActiveSync`                 |
| eu-west-1 | IMAPS         | `imap.mail.eu-west-1.awsapps.com:993`                                                   |
| eu-west-1 | SMTPS         | `smtp.mail.eu-west-1.awsapps.com:465`                                                   |

## Important gotchas

- The Autodiscover hostname is **`autodiscover-service.mail.<region>.awsapps.com`**,
  not `autodiscover.mail.<region>.awsapps.com`. Older mailboxes resolved the
  shorter name; newer ones do not. Always use the `-service` form.
- IMAP encryption: **SSL/TLS** on 993 (IMAPS). STARTTLS on 143 is not supported.
- SMTP encryption: **SSL/TLS** on 465 (SMTPS). STARTTLS on 587 is **not**
  supported by WorkMail — clients that default to STARTTLS will fail.
- Authentication mechanism: **PLAIN** over the TLS-wrapped channel.
- The username for IMAP/SMTP/EWS is always the **full email address**, never
  the local part.
- WorkMail has no separate "app password" — the human's account password is
  the credential clients use.

## Quotas worth remembering

- Max attachment size: 25 MB per message (after MIME encoding overhead).
- Max recipients per outbound message: 500.
- Per-user mailbox: 50 GB.
- Send rate: 14,400 messages / 24h / user (the spam-filter ceiling, not a
  documented hard limit — burst above this gets throttled).

See <https://docs.aws.amazon.com/workmail/latest/adminguide/workmail_limits.html>
for the authoritative current numbers.
