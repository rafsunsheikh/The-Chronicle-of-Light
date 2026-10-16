Read the chunk file you were given. It begins with a comment naming the book,
the section heading and the page range, then the text, with `<!-- page N -->`
markers where pages begin.

List the datable events in this chunk as a JSON array. Each item has exactly
these fields:

```jsonc
{
  "title": "Battle of the Bridge",                 // 3 to 120 characters, a noun phrase, no trailing period
  "description": "One to three plain sentences saying what happened, who was involved and where, written from the text. 10 to 600 characters.",
  "startDate": "0634-11",                          // YYYY, YYYY-MM or YYYY-MM-DD in the Common Era, as precise as the text allows
  "endDate": null,                                  // same format, only when the text gives a span
  "datePrecision": "month",                        // "day" | "month" | "year" | "approximate"
  "dateBasis": "in the autumn of A.D. 634",        // the words in the text the date comes from
  "placeName": "Kufa",                              // the place as the text spells it, or null if none is named
  "placeHint": "near the Euphrates in Iraq",       // what the text says about where it is, or null
  "category": "military",                           // political | religious | cultural | scientific | military
  "people": ["Abu Obeida", "Mothanna"],           // main named figures, as spelled in the text
  "evidence": "verbatim sentence(s) from the chunk, at most 300 characters",
  "page": 103,                                      // from the nearest preceding <!-- page N --> marker, or null
  "notes": null                                     // anything the reviewer should know: a disputed date, OCR damage, two accounts
}
```

Guidance:

- At most 12 events per chunk. If there are more, keep the 12 the text
  treats as most consequential.
- One record per event, not per paragraph. If the chunk returns to the same
  event later, fold it into one record.
- Skip anything the chunk mentions only as background from another period.
- Categories: battles, sieges, raids and campaigns are "military"; accessions,
  deaths of rulers, treaties, appointments and revolts are "political";
  mosque building, pilgrimages, conversions and the Qur'an are "religious";
  cities founded, poetry and buildings are "cultural"; observatories,
  hospitals, books of science and medicine are "scientific".
- If the chunk has no datable events, return an empty array: `[]`.

Write the array to the output path you were given, as JSON, and nothing else.
