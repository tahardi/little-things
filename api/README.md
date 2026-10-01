# API

The backend API is defined by JSON test data in `testdata/`. It is not app data: the files are examples used only by
Go and Jest tests, so the two sides cannot drift.

**Change a file in `testdata/` only together with both the Go and TypeScript code in the same PR.**

Every request, including `/health`, sends `Authorization: Bearer <key>`. Uploads are limited to 50 MB.

## Endpoints

### GET /health

Returns `200` with `testdata/health-response.json`.

### POST /field

Turns one spoken answer from Add Person into a value for one field.

- Headers: `Authorization`, `Content-Type: multipart/form-data`
- Multipart fields:
  - `audio`: the recording
  - `field`: one of `name`, `preferred_name`, `nicknames`, `relationship`, `birthday`, `address`, `phone`, `interests`
- Success: `200` with `{ "transcript", "value" }`. `value` is a string (`testdata/field-response-phone.json`), a list of
  strings for `nicknames` and `interests` (`testdata/field-response-interests.json`), or a birthday object for
  `birthday` (`testdata/field-response-birthday.json`).
- Failure: `testdata/error-no-speech.json`, `testdata/error-unreadable-date.json`, or `testdata/error-unauthorized.json`

### POST /note

Turns a free-form note into proposed changes for existing people.

- Headers: `Authorization`, `Content-Type: multipart/form-data`
- Multipart fields:
  - `audio`: the recording
  - `people`: JSON matching `testdata/note-people.json`
- Success: `200` with a body matching `testdata/note-response.json`
- Failure: `testdata/error-no-speech.json` or `testdata/error-unauthorized.json`

Every change object has all nine keys; unused keys are `null`. Required keys per `type`:

| Type | Required |
| ---- | -------- |
| `add_interest`, `add_gift_idea`, `add_gift_given`, `set_address`, `set_phone`, `set_relationship`, `set_preferred_name`, `add_nickname` | `text` |
| `set_birthday` | `month`, `day` |
| `add_date` | `label`, `month`, `day`, `recurring` |

### POST /gifts

Suggests five gift ideas for one person.

- Headers: `Authorization`, `Content-Type: application/json`
- Body: `testdata/gifts-request.json`
- Success: `200` with a body matching `testdata/gifts-response.json` (always exactly five ideas)
- Failure: `testdata/error-unauthorized.json`

## Error codes

| Code                | Status |
| ------------------- | ------ |
| `unauthorized`      | 401    |
| `bad_request`       | 400    |
| `payload_too_large` | 413    |
| `no_speech`         | 422    |
| `unreadable_date`   | 422    |
| `upstream_failed`   | 502    |
