# Notion Formulas — Academy Skill

> Complete reference for Notion's formula language (Formulas 2.0).
> Covers every built-in function, operators, variables, data types,
> rich outputs (pages, dates, people, lists), and common patterns.
> Source: Notion Academy + Help Center (notion.com/help/formula-syntax).

---

## Data Types

Formulas work with these types. The output type is inferred automatically.

| Type       | Examples                       | Notes                          |
|------------|-------------------------------|-------------------------------|
| **Number** | `42`, `3.14`, `-7`            | IEEE 754 doubles               |
| **Text**   | `"hello"`, `"Notion"`          | Wrapped in double quotes       |
| **Boolean**| `true`, `false`                | Returned by comparisons        |
| **Date**   | `now()`, `today()`             | Date or date-range objects     |
| **Person** | `prop("Assignee")`             | Workspace member objects       |
| **Page**   | `prop("Relation").first()`     | References to Notion pages     |
| **List**   | `[1, 2, 3]`, `prop("Tags")`   | Ordered collections            |

---

## Operators

### Arithmetic
`+` (add), `-` (subtract), `*` (multiply), `/` (divide), `%` (modulo), `^` (power)

### Comparison
`==` (equal), `!=` (not equal), `>`, `>=`, `<`, `<=`

### Logical
`and` / `&&`, `or` / `||`, `not` / `!`

### Ternary
`condition ? value_if_true : value_if_false`

---

## Variable Assignment

### let — single variable
```
let(variableName, value, expression)
```
Example: `let(tax, 0.08, prop("Price") * (1 + tax))`

### lets — multiple variables
```
lets(var1, val1, var2, val2, ..., expression)
```
Example: `lets(base, prop("Price"), tax, 0.08, base * (1 + tax))`

---

## Function Reference

### Conditional

| Function | Syntax | Description |
|----------|--------|-------------|
| `if` | `if(cond, val_true, val_false)` | If-then-else |
| `ifs` | `ifs(c1, v1, c2, v2, ..., default)` | Multi-branch if; returns value of first true condition |

### Text / String

| Function | Syntax | Description |
|----------|--------|-------------|
| `contains` | `contains(text, search)` | True if search is found in text |
| `length` | `length(text)` | Character count (or list size) |
| `substring` | `substring(text, start, end?)` | Extract portion by indices |
| `lower` | `lower(text)` | Lowercase |
| `upper` | `upper(text)` | Uppercase |
| `trim` | `trim(text)` | Strip whitespace |
| `repeat` | `repeat(text, n)` | Repeat text n times |
| `replace` | `replace(text, regex, repl)` | Replace first match |
| `replaceAll` | `replaceAll(text, regex, repl)` | Replace all matches |
| `test` | `test(text, regex)` | True if regex matches |
| `match` | `match(text, regex)` | List of all regex matches |
| `format` | `format(value)` | Convert any value to text |
| `link` | `link(label, url)` | Create a clickable hyperlink |
| `style` | `style(text, ...styles)` | Apply formatting: `"b"` bold, `"i"` italic, `"u"` underline, `"c"` code, `"s"` strikethrough. Colors: `"gray"`, `"brown"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, `"purple"`, `"pink"`, `"red"` (add `"_background"` for highlight) |
| `unstyle` | `unstyle(text, style?)` | Remove formatting |
| `split` | `split(text, separator)` | Split text into a list |

### Math

| Function | Syntax | Description |
|----------|--------|-------------|
| `add` | `add(a, b)` or `a + b` | Sum |
| `subtract` | `subtract(a, b)` or `a - b` | Difference |
| `multiply` | `multiply(a, b)` or `a * b` | Product |
| `divide` | `divide(a, b)` or `a / b` | Quotient |
| `mod` | `mod(a, b)` or `a % b` | Remainder |
| `pow` | `pow(base, exp)` or `base ^ exp` | Exponentiation |
| `abs` | `abs(n)` | Absolute value |
| `round` | `round(n, decimals?)` | Round to nearest |
| `ceil` | `ceil(n)` | Round up |
| `floor` | `floor(n)` | Round down |
| `sqrt` | `sqrt(n)` | Square root |
| `cbrt` | `cbrt(n)` | Cube root |
| `sign` | `sign(n)` | Returns 1, -1, or 0 |
| `min` | `min(a, b, ...)` or `min(list)` | Smallest value |
| `max` | `max(a, b, ...)` or `max(list)` | Largest value |
| `sum` | `sum(a, b, ...)` or `sum(list)` | Total of all values |
| `mean` | `mean(a, b, ...)` or `mean(list)` | Arithmetic average |
| `median` | `median(a, b, ...)` or `median(list)` | Middle value |
| `exp` | `exp(n)` | e^n |
| `ln` | `ln(n)` | Natural logarithm |
| `log10` | `log10(n)` | Base-10 logarithm |
| `log2` | `log2(n)` | Base-2 logarithm |
| `pi` | `pi()` | 3.141592653589793 |
| `e` | `e()` | 2.718281828459045 |
| `toNumber` | `toNumber(value)` | Parse text/boolean to number |

### Date / Time

| Function | Syntax | Description |
|----------|--------|-------------|
| `now` | `now()` | Current date + time |
| `today` | `today()` | Current date (no time) |
| `minute` | `minute(date)` | Extract minute (0-59) |
| `hour` | `hour(date)` | Extract hour (0-23) |
| `day` | `day(date)` | Day of week (1=Mon, 7=Sun) |
| `date` | `date(date)` | Day of month (1-31) |
| `week` | `week(date)` | ISO week of year (1-53) |
| `month` | `month(date)` | Month (1-12) |
| `year` | `year(date)` | Full year |
| `dateAdd` | `dateAdd(date, qty, unit)` | Add time. Units: `"years"`, `"quarters"`, `"months"`, `"weeks"`, `"days"`, `"hours"`, `"minutes"` |
| `dateSubtract` | `dateSubtract(date, qty, unit)` | Subtract time |
| `dateBetween` | `dateBetween(d1, d2, unit)` | Difference between dates |
| `dateRange` | `dateRange(start, end)` | Create a date range |
| `dateStart` | `dateStart(range)` | Start of a date range |
| `dateEnd` | `dateEnd(range)` | End of a date range |
| `timestamp` | `timestamp(date)` | Unix ms since epoch |
| `fromTimestamp` | `fromTimestamp(ms)` | Unix ms → date |
| `formatDate` | `formatDate(date, fmt)` | Custom format string. Tokens: `YYYY`, `YY`, `MM`, `M`, `MMMM`, `MMM`, `DD`, `D`, `dddd`, `ddd`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `A`, `a` |
| `parseDate` | `parseDate(iso_str)` | Parse ISO 8601 string |

### List / Array

| Function | Syntax | Description |
|----------|--------|-------------|
| `at` | `at(list, index)` | Item at index (0-based) |
| `first` | `first(list)` | First item |
| `last` | `last(list)` | Last item |
| `slice` | `slice(list, start, end?)` | Sub-list |
| `concat` | `concat(list1, list2, ...)` | Merge lists |
| `sort` | `sort(list)` | Ascending sort |
| `reverse` | `reverse(list)` | Reverse order |
| `join` | `join(list, separator)` | List → text |
| `unique` | `unique(list)` | Remove duplicates |
| `includes` | `includes(list, value)` | True if value is in list |
| `find` | `find(list, expr)` | First item where `current` matches |
| `findIndex` | `findIndex(list, expr)` | Index of first match |
| `filter` | `filter(list, expr)` | Items where expr is true |
| `map` | `map(list, expr)` | Transform each item |
| `some` | `some(list, expr)` | True if any item matches |
| `every` | `every(list, expr)` | True if all items match |
| `flat` | `flat(list)` | Flatten nested lists |

> In `map`, `filter`, `find`, `some`, `every`, `findIndex` — use the keyword
> `current` to reference the item being iterated.

### Logic

| Function | Syntax | Description |
|----------|--------|-------------|
| `empty` | `empty(value)` | True if value is `""`, `0`, `false`, or `[]` |
| `equal` | `equal(a, b)` | Same as `a == b` |
| `unequal` | `unequal(a, b)` | Same as `a != b` |

### Person / Object

| Function | Syntax | Description |
|----------|--------|-------------|
| `name` | `name(person)` | Person's display name |
| `email` | `email(person)` | Person's email |
| `id` | `id()` or `id(page)` | Page ID string |

---

## Common Formula Patterns

### Days until deadline
```
dateBetween(prop("Due Date"), now(), "days")
```

### Percent complete (from sub-tasks via rollup)
```
round(prop("Done Count") / prop("Total Count") * 100)
```

### Status emoji badge
```
ifs(
  prop("Status") == "Done", style("Done", "b", "green"),
  prop("Status") == "In Progress", style("In Progress", "b", "blue"),
  style("To Do", "b", "gray")
)
```

### Full name from relation
```
prop("Assignee").map(current.name()).join(", ")
```

### Overdue check
```
if(
  and(prop("Due Date") < now(), prop("Status") != "Done"),
  style("OVERDUE", "b", "red"),
  ""
)
```

### Tag count
```
length(prop("Tags"))
```

### Fiscal quarter
```
"Q" + format(ceil(month(prop("Date")) / 3))
```

---

## Common Formula Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Type mismatch | Comparing text to number | Use `toNumber()` or `format()` |
| Circular reference | Formula references itself | Remove self-reference |
| Empty property | Operating on null/empty | Guard with `if(empty(...), default, ...)` |
| Invalid regex | Bad pattern in `test`/`match` | Escape special chars with `\\` |

---

## Sources

- https://www.notion.com/help/formula-syntax
- https://www.notion.com/help/formulas
- https://www.notion.com/help/common-formula-errors
- https://www.notion.com/help/guides/new-formulas-whats-changed
