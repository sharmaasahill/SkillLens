from datetime import datetime

from models.resume_analyzer import analyze_text, experience_years
from models.resume_checks import bullets, repeated_verbs, review, timeline, unproven_skills

# A two-column style resume as PDF text comes out: no bullet symbols, wrapped lines, labelled skill lists
RESUME = """Asha Rao
Software Engineer
Acme Cloud | Backend Engineer January 2024 - Present
Developed a Python service on AWS Lambda that processes 10K+ records a day for the
billing team.
Developed REST APIs with FastAPI and PostgreSQL for the admin portal.
Developed a CI pipeline with GitHub Actions that runs every test on each pull request.
Built a React dashboard in TypeScript for finance users.
Beta Labs | Freelance Developer March 2024 - June 2024
Developed a Next.js storefront with Prisma and Stripe payments.
TECHNICAL SKILLS
Languages: Python, Java, SQL, TypeScript
Databases: PostgreSQL, MongoDB, Redis
Tools: Docker, Git, Kubernetes
EDUCATION
B.Tech, Computer Science, Example University
August 2019 - May 2023
"""


def test_bullets_survive_lost_bullet_symbols_and_wrapping():
    items = bullets(RESUME)
    assert items[0].startswith('Developed a Python service') and items[0].endswith('billing team.')
    assert len(items) == 5


def test_repeated_opening_verbs_are_counted_with_alternatives():
    verbs = repeated_verbs(bullets(RESUME))
    assert verbs[0]['verb'] == 'Developed' and verbs[0]['count'] == 4
    assert 'Engineered' in verbs[0]['alternatives']


def test_skills_listed_but_never_shown():
    missing = unproven_skills(RESUME)
    # Listed under skills, never used in a job: these are what interviewers probe
    assert {'Java', 'MongoDB', 'Redis', 'Docker', 'Kubernetes'} <= set(missing)
    # Shown in the bullets (SQL through PostgreSQL, Git through GitHub Actions)
    assert not {'Python', 'TypeScript', 'PostgreSQL', 'SQL', 'Git'} & set(missing)


def test_timeline_flags_overlaps_but_not_education():
    notes = timeline(RESUME, today=datetime(2026, 10, 1))
    assert [n['kind'] for n in notes] == ['overlap']
    assert 'Beta Labs' in notes[0]['text'] and 'Acme Cloud' in notes[0]['text']


def test_degree_dates_on_their_own_line_are_not_work_experience():
    # Two-column PDFs put the degree dates on a separate line; they used to add 4 years of "experience"
    assert experience_years(RESUME) <= 3


def test_checks_come_with_every_analysis():
    checks = analyze_text(RESUME)['checks']
    assert checks['repeated_verbs'] and checks['unproven_skills'] and checks['timeline']
    assert review('I built it. My team and me shipped it.')['first_person'] == 3
