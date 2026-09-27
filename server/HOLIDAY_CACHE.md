# Holiday cache

`POST /api/company-calendar/holiday-cache` (Express) or
`POST /api/v1/company-calendar/holiday-cache` (Worker) accepts `{ country, year }`.
The authenticated administrator's company owns the cache; client company IDs are ignored.

`company_holiday_cache` stores `company_id`, `country`, `year`, and a JSON array in
`holidays`. New country/year combinations create rows automatically, without runtime
schema changes. NULL means not fetched; an empty array is a successfully fetched year.
Saved years are reused indefinitely. Month and type filters operate on the saved year,
so revisiting a month does not consume API quota. Importing selected holidays into
company policy remains a separate action.

A 60-second database lease prevents simultaneous provider fetches. Provider requests
time out after 20 seconds. Failed requests release the lease and are not cached.

Set the server secret `CALENDARIFIC_API_KEY`. Express also accepts the existing
`VITE_CALENDARIFIC_API_KEY` for compatibility; new configurations should use the
server-only name. The browser no longer reads or sends the provider key.

Express initializes the table automatically. For hosted Worker deployment, apply
`migrations/hrms/0008_holiday_cache.sql` to its D1 database and configure the
`CALENDARIFIC_API_KEY` Worker secret before deploying the updated Worker.

Provider request format follows [Calendarific's documentation](https://calendarific.com/api-documentation).
