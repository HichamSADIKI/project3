# PDC — Post-dated cheques (migration 0003)

`pdc_cheques` is the UAE-specific first-class entity. One PDC links to **exactly one** of `rentals` or `contracts` (check-constraint), plus a drawer (`clients.id`). State machine:

```
pending ─┬─→ deposited ─┬─→ cleared        (terminal)
         │              └─→ bounced ─→ replaced  (terminal — chained via replaced_by_pdc_id)
         └─→ cancelled                            (terminal)
```

Routes: `/api/v1/pdc` (CRUD), plus state actions `/pdc/{id}/{deposit,clear,bounce,cancel,replace,legal-notice}`. Reference auto-generated as `PDC-YYYY-NNNNNN` (6 digits, lexicographically sortable). Calendar endpoint `/api/v1/pdc/calendar?horizon_days=60` returns active cheques due in the window, used by Celery beat to schedule deposit reminders and overdue alerts (UAE Federal Penal Code art. 401 — bounced cheque = offence; `legal_notices_sent` counter tracks the workflow).

Pure helpers in `pdc.service`: `is_valid_pdc_transition`, `days_to_due`, `is_overdue`, `generate_reference`, `aggregate_outstanding`.
