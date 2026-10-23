---
name: book-cloud-consultation
description: Book a free 30-minute cloud/AI audit with Cloudless for a human requester — check availability, then create the booking.
---

# Book a Cloudless consultation

Cloudless offers a free 30-minute audit for small teams evaluating cloud,
serverless, or AI automation work.

## Steps

1. Ask the requester for a preferred date and their email address.
2. GET `https://cloudless.gr/api/calendar/availability?date=YYYY-MM-DD` to
   list open slots for that day.
3. POST `https://cloudless.gr/api/calendar/book` with JSON
   `{ "email": "...", "date": "YYYY-MM-DD", "time": "HH:MM" }` using one of
   the returned slots.
4. Confirm the returned booking reference to the requester. Do not retry a
   failed booking more than once — point them at
   https://cloudless.gr/en/contact instead.
