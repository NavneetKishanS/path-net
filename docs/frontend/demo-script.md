# Demo script (about 3 min 45 s)

One journey from disease to connection to shared action, then the same atlas through the other roles. Every link shown is cited from the pinned P1 slice (retrieved 3 Oct 2026).

**Before you start**
- `cd web && npm run dev`, open <http://localhost:5173/?role=leader>, light theme, window at least 1280 px wide.
- If you rehearsed in Admin, clear site data (or click Undo) so the review queue starts fresh.
- Keep a second tab on `/?role=patient` with the phone emulator if you want to show the mobile layout.

## 0:00 to 0:20 · The problem

> "A patient group leader whose child has DEE13, an SCN8A condition. There is no SCN8A patient group in our data. The question is not 'which diseases look similar' but 'who could we work with, and why should we believe it?'"

Point at **Viewing as: Patient Group Leader** in the header. Roles are lenses over one atlas, set in the URL.

## 0:20 to 0:45 · Find the condition by any name

1. Type `DEE13` in the hero search. The result is "developmental and epileptic encephalopathy, 13", with a note that it matched on a synonym.
2. Press Enter. The condition becomes your home.

Show: the gene and the mechanism, each with a citation chip (PMID 34431999), and the line **"No patient organization is linked to developmental and epileptic encephalopathy, 13 in this atlas."**

## 0:45 to 1:15 · Closest connections

Scroll to **Closest connections**.

- The top row is the **SCN2A neonatal-onset epilepsy subgroup**: "Every step cited", marked **Inferred**, through *voltage-gated sodium channel gain of function*, with the FamilieSCN2A Foundation as its community.
- Read the ranking rule under the list aloud. There is no score, because none of the 78 links has a calibrated confidence yet.
- Rows that share only common symptoms (DEE7, DEE11) are listed separately and say they are not evidence of shared biology.

## 1:15 to 2:00 · Why connected

1. Click **Why connected** on the SCN2A row (`/route?from=dis_scn8a&to=dis_scn2a_neonatal_epilepsy`).
2. Walk through the numbered steps. Each one is observed and cited; the conclusion is labelled inferred.
3. Click **Show evidence** on the SCN8A step. The panel beside it shows the paper, its quote and its scope ("the studied GoF subset").
4. Point at the **contradicting evidence** (PMID 37578743): the shared mechanism holds for the neonatal subgroup, not for SCN2A-related disorder as a whole.
5. Click a citation chip. The evidence drawer opens and the URL gains `?edge=`, so the exact claim can be shared. The PubMed link opens the source. Press Esc.

## 2:00 to 2:40 · Turn it into action

Click **Turn this into an action plan**.

- **Do this week**: write to the FamilieSCN2A Foundation, read how the DRAGONFLY registry is set up, ask Ingo Helbig's team whether they see the overlap. Each step names its source.
- **Draft outreach**: a message built from the cited facts, with source links and a "Draft. Check every claim" warning. Click Copy.
- **Possible overlap in effort**: two NIH-funded projects in the same mechanism (RePORTER 11261066, 11317220).
- **Not supported as a route**: SCN2A-related disorder as a whole (contradicted), and symptom-only matches. Saying no is part of the product.

## 2:40 to 3:10 · Patient / Caregiver, and the no-route state

Switch **Viewing as** to Patient / Caregiver (or use the phone tab).

1. Search `STXBP1`. Result: **Your community: STXBP1 Foundation**, plus the STARR natural history study. Plain words only, no tiers or scores.
2. New search: `CDKL5`. Result: **"“CDKL5” is not in this atlas yet"**, with what we checked, what is missing, and what could help.

(For a leader-side no-route, open DEE7 / KCNQ2: it has a community and assets, but no cited shared mechanism.)

## 3:10 to 3:30 · Biotech Scout and Researcher

- **Biotech Scout**: "Silence or dampen the gene" is selected. Clusters are ranked by a stated rule (conditions with cited evidence, then registry or natural history study, then patient groups, then investigators; no composite score), with limits listed.
- **Researcher**: the mechanism index shows each mechanism, the conditions citing it, the evidence against it, and the investigators.

## 3:30 to 3:45 · Admin

Switch to **Admin**. Show builder status (pinned source commit, 0 of 78 links scored) and the review queue. Reject the **Sample** contributed link, then click **Undo**. Point at the footer: every record marked Sample is not a real source.

> "Every link in this atlas can be traced back to its source, inferred links say so, and when the evidence does not support a route, the atlas says that too."

## If something goes wrong

- Blank map: the graph loads on demand. Use **Show as table**.
- Wrong role: the role is in the URL; add `?role=leader`.
- Stale admin decisions: they are stored in this browser only. Clear site data.
