# Analyst guide: how to run an investigation in CART3R: radar

English · [Русский](ANALYST_GUIDE.ru.md)

The service does not pass a verdict. It highlights operations that look unusual and explains why. A human makes the decision by comparing the signal with what your own order and payment systems know about the customer.

## How the analysis works

1. **Overview** — see what changed today.
2. **Sort alerts** — pick the riskiest ones.
3. **Case** — open it and investigate.
4. **Rule-by-rule review** — understand which signal fired and what to compare it with.
5. **Decision and notes** — close the case or keep it in progress.
6. **Tune the rules** — reduce noise if there are many false positives.

Note: the UI has no customer history (past orders, addresses, contacts). You take that from your own system.

## Step 1. Overview: what to look at every morning

Open the Overview tab: new alerts, suspicious accounts, the daily chart and the false-positive share. A sudden jump in alerts or a new rule type appearing is a reason to dig deeper. A calm chart means you just review the highest risks.

## Step 2. Sorting alerts

Open the Alerts tab. By default all alerts are shown; filters narrow them by status and category.

Risk bands:

| Risk | Meaning |
| --- | --- |
| 0–34 | Allowed, usually no alert |
| 35+ | "Flagged": worth a look |
| 70+ | "Review": look first |

Risk is the sum of the weights of the rules that fired, capped at 100.

| Rule | Weight | Default condition |
| --- | --- | --- |
| High amount | 35 | 2000 or more |
| Velocity | 40 | 5 transactions in 10 minutes |
| Card testing | 50 | 3 declined attempts up to $5 within 15 minutes |
| Geo mismatch | 30 | IP country differs from the country or the account's home country |
| New account, large payment | 45 | account under 7 days old, 500 or more |
| Transfer to a new payee | 40 | 800 or more |

Example: high amount (35) + geo mismatch (30) = 65, the operation is flagged.

Working order: risk 70+ first, then 35–69, then series of alerts on one account.

## Step 3. Investigating in a case

Click "Open case". The alert becomes "In progress" and the case appears on the Cases tab (which shows "In progress" cases by default). A case shows the category, severity, customer email, the reason it fired, and a notes field.

Answer six questions:

1. **Who is the customer and how long have they been with us?** A new account with no history is riskier than an old one.
2. **What did they do before?** Usual amounts, countries, time of day, payment method.
3. **What was bought and where did the money go?** Is the item clear, is the recipient known?
4. **Does the data match?** Delivery address, customer country, card country, IP country, device.
5. **Are there other alerts on this account?** Find the same email on the Alerts tab (Cmd+F on Mac, Ctrl+F on Windows). A series of alerts is a strong signal.
6. **Is there confirmation from the customer?** Most reliable is to contact them through a channel you had *before* this operation, not the details from the suspicious order itself.

The service cannot answer questions 1–4 and 6: you take those answers from your own system. The service answers "why does this look suspicious" and helps with question 5.

Each alert is closed separately. If one operation triggered several alerts, open a case on the most important one and refer to it in the notes of the others.

## Step 4. Rule-by-rule review

The "Probably normal" column is a hint, not a guarantee: the combination of facts decides.

| Rule (category) | What to check | Probably normal | Probably suspicious |
| --- | --- | --- | --- |
| High amount (card fraud) | past orders, what was bought, delivery address | the customer had similar amounts, delivery to a usual address | first large order, delivery to a new address in another country |
| Velocity (card fraud) | timing, payment contents, same card or not | customer pays a cart in parts or retries after a failure | many payments in a row for different items or from different cards |
| Card testing (card fraud) | amounts and statuses of attempts, whether an order exists | one person mistyped card data, then paid | a series of declined $1–5 payments with no order, especially from different cards |
| Geo mismatch (account takeover) | IP country, account country, previous logins | customer is travelling or on a VPN, has paid from this country before | always one country, now another, followed at once by a large payment or a password/email change |
| New account, large payment (identity theft) | account age, customer data, type of purchase | a company ordering wholesale under a contract | account created today, disposable email, incomplete or odd data |
| Transfer to a new payee (phishing) | who the payee is, why the transfer, did the customer start it | customer pays a known supplier and confirms it | customer is "in a hurry", was called or messaged and asked to transfer money urgently |

Three worked examples:

1. **"Amount 2458.00 ≥ 2000", risk 35, one alert.** One weak signal. The customer's history has orders of 1800–2500, delivered to the usual address. Decision: false positive.
2. **"Amount 5200.00 ≥ 2000" + "IP: DE, account country: US", risk 65.** Two signals together. The customer always paid from the US, this is their first order above 1000, the delivery address is new. Contact the customer through the old contact. No answer: leave the case in progress and hold the order until confirmed.
3. **"4 small declined attempts in 15 minutes", risk 50, amounts $1–$3.** No order behind these payments. This looks like testing stolen cards. Confirm fraud, suspend the account and notify your payment provider per your process.

## Step 5. Decision and notes

The decision is a button inside the case (Cases tab). Notes are saved when you press any close button or "Save notes".

| Situation | Button | Status after |
| --- | --- | --- |
| Customer confirmed the operation or there is a clear, simple explanation | "Close: false positive" | False positive |
| Customer denies the operation or the data clearly doesn't match | "Close: fraud confirmed" | Resolved |
| Not sure, need more data | "Save notes" and don't close | In progress |
| Obviously normal operation, no case needed | "False positive" right on the Alerts tab | False positive |

A closed case leaves the "In progress" filter. To see it, choose "Resolved" or "all".

What to write in notes: write so that a colleague understands it in a month without your explanations. A four-line template:

```
Checked: order history, delivery address, other alerts on the account
Found: customer since 2023, previously spent up to 2500; usual address
Decision: false positive
Next: the "High amount" rule could be relaxed to 3000
```

Do not write card numbers, CVV, passwords or passport data in notes: the order number from your system is enough.

## Step 6. Tuning rules (for administrators)

If many closed alerts are false positives from one rule, that rule is too strict. See this on the Analytics tab in the "Rule quality" table: for each rule it shows confirmed fraud, false positives and precision (confirmed / decided). Precision below 30% with enough decided alerts is a sign the threshold should go up. Choose a period and filters (rule, category, country, channel, status) to narrow the analysis. The percentages next to the totals compare with the previous period of the same length. The Overview tab still gives the quick daily picture.

1. Open the Rules tab (requires the admin role).
2. Find the rule with the highest false-positive share.
3. Raise its threshold by a small step. For example "High amount" from 2000 to 3000, if you have many honest orders of 2000–3000.
4. Wait a few days and compare the false-positive share.
5. If you are missing real fraud, do the opposite: lower the threshold or raise the weight.

Tuning rules: change one rule at a time, otherwise you won't know what helped. Don't disable a rule just because of noise; raise its threshold first. Record what you changed and why. A threshold affects only new operations; old alerts are not recalculated.

## Practice on demo data

Open the Test lab and submit operations one by one.

| What to enter | Expected result |
| --- | --- |
| Country, IP and account country all match, ordinary amount | risk 0, "Allowed" |
| Amount 3000 USD | "High amount", risk 35, "Flagged" |
| IP differs from both the country and the account's home country | "Geo mismatch", risk 30, still "Allowed" |
| 3000 USD + a differing IP | risk 65, "Flagged" |
| Channel "transfer", "New payee", amount around 1000 | "Transfer to a new payee", risk 40 |
| Three declined $1 attempts within 15 minutes | "Card testing", risk 50 |

The "New account, large payment" rule cannot be reproduced through the UI: it depends on account age, which comes from the data. You can see it in the demo data.

After each operation, open Alerts, find it and go through steps 3–5 of this guide.

## Cheat sheet

Before deciding on an alert:

- [ ] I understand which rule fired and why
- [ ] I looked at the customer's history in my own system
- [ ] I compared country, address, device
- [ ] I checked other alerts on the same account
- [ ] If in doubt, I contacted the customer through the old contact
- [ ] I wrote a note: checked, found, decided

Working rules:

- Use the service only for defensive purposes: to protect customers and the business.
- Never put card numbers, CVV, passwords or passport data in notes.
- One signal rarely proves fraud; combinations of facts decide.
- Don't block customers by risk score alone, without checking.
- If unsure, keep the case "In progress" and request more data.
- Follow the personal-data laws of your country.
