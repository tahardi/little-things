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

## Route errors

| Route          | Status | Code              | When                                                                   |
| -------------- | ------ | ----------------- | ---------------------------------------------------------------------- |
| `POST /field`  | 400    | `bad_request`     | `field` missing or not one of the listed fields, or `audio` missing    |
| `POST /field`  | 422    | `no_speech`       | transcript is empty                                                    |
| `POST /field`  | 422    | `unreadable_date` | the birthday could not be read as a date                               |
| `POST /field`  | 502    | `upstream_failed` | transcribing or parsing failed, or Claude refused or replied badly     |
| `POST /note`   | 400    | `bad_request`     | `people` missing or not valid JSON, or `audio` missing                 |
| `POST /note`   | 422    | `no_speech`       | transcript is empty                                                    |
| `POST /note`   | 502    | `upstream_failed` | transcribing or extracting failed, or Claude refused or replied badly  |
| `POST /gifts`  | 400    | `bad_request`     | body is not valid JSON, or `name` is blank                             |
| `POST /gifts`  | 413    | `payload_too_large` | body is over 1 MB                                                    |
| `POST /gifts`  | 502    | `upstream_failed` | generating ideas failed, or Claude refused or replied badly            |

Request fields are checked before any audio is transcribed. `people` may be an empty list; every person mentioned is
then reported as unknown. Multipart uploads over 50 MB return `payload_too_large`.
