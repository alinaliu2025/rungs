# HackOHI/O 2026 pitch script: Rungs (Bridge Builder Challenge)

Target length: about 3:00. Runs at a relaxed 150 words per minute; the demo uses the 84-second
`media/rungs-end-to-end.mp4` with its own voiceover (see `demo-video-script.md`).
Speakers are suggestions; swap freely. Lines marked **[edit]** should be in your own words.

| # | Section | Time | Speaker | On screen |
|---|---|---|---|---|
| 1 | Hook + team | 0:00–0:15 | Alina | Team on camera, then the Rungs home page |
| 2 | Problem | 0:15–0:40 | Jayden | Home page hero, slow scroll |
| 3 | What we built | 0:40–0:55 | Cullen | Challenge list: mini vs 4–6 week filters |
| 4 | Demo | 0:55–2:19 | Video voiceover | `rungs-end-to-end.mp4` |
| 5 | Why it works | 2:19–2:42 | Reniel | Team simulator: "Rungs vs random" |
| 6 | What we learned | 2:42–2:56 | Alina | Code / architecture diagram from the README |
| 7 | Close | 2:56–3:00 | Everyone | Logo + repo link |

---

## 1 · Hook + team (0:00–0:15) · Alina

> Classes teach a lot, but not what it's like to ship something real with a team you just met.
> We're Alina, Jayden, Cullen and Reniel, and this is **Rungs**: real challenges from real companies, sized to a student's week.

## 2 · Problem (0:15–0:40) · Jayden

> Students want real experience but have very little time. Mentors would gladly give an hour, but rarely six weeks.
> And now that AI writes resumes, a list of skills says less than ever.
> So we asked: what would make a busy student actually take the first step, and what proof of their work can't be generated?

## 3 · What we built (0:40–0:55) · Cullen

> We built two rungs of the ladder: *try something small* and *join a project*.
> Companies post challenges as a one-hour mini or a four-to-six-week project. Students pick based on the time they actually have, and we build the teams for them.

## 4 · Demo (0:55–2:19) · video

Play `media/rungs-end-to-end.mp4` with the voiceover from `demo-video-script.md`.
If you're over time, drop that script's optional lines (0:13, 0:31, 0:56).

## 5 · Why it works (2:19–2:42) · Reniel

> Three design choices matter most.
> First, **respect everyone's time**: minis take hours, and a mentor's whole job is one round of grading.
> Second, **community, not a job board**: teams are cross-major, and the sorting is hidden, so students can't game their profile. In our simulator, it beats random teams on skill coverage, balance and mix of majors.
> Third, **growth you can trust**: every finished challenge leaves public results and private feedback from the company: a record earned from real people.

## 6 · What we learned (2:42–2:56) · Alina **[edit]**

> The hardest part wasn't the code, it was the edge cases of real life: time zones and sign-up deadlines, what happens when only one person signs up, and whether anyone can post.
> We started with "anyone can post", realized it needed review, and built that in. Small decisions like these are what make it feel trustworthy.

## 7 · Close (2:56–3:00) · everyone

> Sign up, get a team, ship, get feedback, and climb. That's Rungs.

---

## Answers to the brief's "things to consider"

Keep these ready for questions from the judges.

- **The empty room:** companies bring the content first, so students never arrive to nothing. The feed gives an "early spot" boost to challenges that still need people, and minis take an hour, so trying one is low risk.
- **Respecting time:** filter by "a few hours" vs "4–6 weeks"; mentors grade once, about an hour of their time; sign-ups and team formation are automatic.
- **Community, not a job board:** the review checklist rejects unpaid work dressed up as a project; teams mix majors; the reward is feedback and a public result, not a recruiter pipeline.
- **Growth made visible:** winners and their links are public; every team gets scores and written feedback from the company.
- **Think big, start small:** one complete flow, from posting through review, sign-up, teams, submission and judging to winners, works end to end. The test suite runs that whole flow.

## Recording checklist

- [ ] Record the demo voiceover first and line it up with the video.
- [ ] Record sections 1–3 and 5–7 on camera or as screen recordings of the app (`npm run dev`).
- [ ] Put the repo link on screen at the end: https://github.com/alinaliu2025/rungs
- [ ] Upload early. The brief says not to wait until the last few minutes.
