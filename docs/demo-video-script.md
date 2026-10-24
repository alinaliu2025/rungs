# Demo video voiceover script

Timed to `media/rungs-end-to-end.mp4` (about 84 s; regenerate with `npm run demo:video`).
Each section fits a calm pace of about 2.3 words per second. If a line runs long, drop the part in *[brackets]*.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:05 | Title card: "One mini challenge, start to finish." | This is Rungs. Here's one mini challenge, from the first post to the winners. |
| 0:05–0:13 | Lakefront Energy logs in and fills in the survey | A company starts with a short survey: what students should work on, how long it takes, team or solo, the schedule, and the skills it needs. |
| 0:13–0:15 | Challenge page marked "In review" | It doesn't go live yet. *[Every post waits for review.]* |
| 0:15–0:23 | Reviewer opens the queue and approves | A reviewer checks it: real company, real mentor, a doable scope, and nothing that's just free labor. Approved. Now it's on the front page. |
| 0:23–0:31 | Maya logs in, finds it, joins the team pool | Maya, a computer science student, finds it in her feed. It fits her skills and her week, so she signs up days ahead and joins the team pool. |
| 0:31–0:33 | Demo controls add sample sign-ups | *[To keep this short, we add a few more students.]* |
| 0:33–0:38 | Teams form; Maya sees Team Circuit | At the sign-up deadline, Rungs builds the teams: balanced skills, mixed majors. Maya meets a designer and an engineer she'd never have met in class. |
| 0:38–0:44 | Challenge goes live; Maya submits a GitHub link | When it starts, the team works and submits a link to what they built: a GitHub repo, plus a demo. |
| 0:44–0:47 | Other teams submit; the challenge ends | The other teams submit too, and time's up. |
| 0:47–0:56 | Company scores ChargeGap 5 / 5 / 4 with feedback | Now the company judges. Each project gets scored on impact, execution and presentation, with a line of real feedback. |
| 0:56–0:59 | Remaining submissions get sample grades | *[The rest are graded the same way.]* |
| 0:59–1:08 | Suggest top 3, announce winners, public results | Rungs suggests the top three. The company confirms and announces the winners, and the winning projects and their links go public. |
| 1:08–1:17 | Maya sees 1st place, 14/15 and the feedback | Maya sees her place, her scores and the company's feedback. That's a record of real work, earned from real people, not written by AI. |
| 1:17–1:24 | End card: "Sign up → team → ship → feedback." | Sign up, get a team, ship something, get feedback, and climb to the next rung. That's Rungs. |

## Read-straight-through version

> This is Rungs. Here's one mini challenge, from the first post to the winners.
>
> A company starts with a short survey: what students should work on, how long it takes, team or solo, the schedule, and the skills it needs. It doesn't go live yet. Every post waits for review.
>
> A reviewer checks it: real company, real mentor, a doable scope, and nothing that's just free labor. Approved. Now it's on the front page.
>
> Maya, a computer science student, finds it in her feed. It fits her skills and her week, so she signs up days ahead and joins the team pool. To keep this short, we add a few more students.
>
> At the sign-up deadline, Rungs builds the teams: balanced skills, mixed majors. Maya meets a designer and an engineer she'd never have met in class.
>
> When it starts, the team works and submits a link to what they built: a GitHub repo, plus a demo. The other teams submit too, and time's up.
>
> Now the company judges. Each project gets scored on impact, execution and presentation, with a line of real feedback. The rest are graded the same way.
>
> Rungs suggests the top three. The company confirms and announces the winners, and the winning projects and their links go public.
>
> Maya sees her place, her scores and the company's feedback. That's a record of real work, earned from real people, not written by AI.
>
> Sign up, get a team, ship something, get feedback, and climb to the next rung. That's Rungs.

## Recording tips

- Record the voice separately (QuickTime → File → New Audio Recording), then line it up with the video in iMovie or CapCut.
- Pause briefly at each step change; the captions in the video change at the times above.
- If you need more room to talk, add pauses in `scripts/record-demo.mjs` (each `pause(ms)` call) and run `npm run demo:video` again.
