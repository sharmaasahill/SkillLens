import time

import pytest

from models.resume_analyzer import analyze_text, check_ats_compatibility, extract_skills_simple

from .sample_resumes import AVERAGE, FALSE_POSITIVE_TEXT, STRONG, WEAK


def test_a_strong_resume_can_reach_the_top_of_the_scale():
    result = check_ats_compatibility(STRONG)
    assert result['score'] >= 90
    assert result['max_score'] == 100
    assert sum(part['max'] for part in result['breakdown']) == 100


def test_scores_rank_resumes_by_quality():
    strong, average, weak = (check_ats_compatibility(t)['score'] for t in (STRONG, AVERAGE, WEAK))
    assert strong > average > weak
    assert 30 <= average <= 70
    assert weak <= 20


def test_breakdown_adds_up_to_the_score():
    result = check_ats_compatibility(AVERAGE)
    assert round(sum(part['score'] for part in result['breakdown']), 1) == result['score']
    for part in result['breakdown']:
        assert 0 <= part['score'] <= part['max']


def test_every_lost_point_is_explained():
    result = check_ats_compatibility(WEAK)
    assert any('contact' in issue.lower() for issue in result['issues'])
    assert any('sections' in issue.lower() for issue in result['issues'])
    assert check_ats_compatibility(STRONG)['issues'] == []


def test_skills_are_matched_as_whole_words():
    assert extract_skills_simple(FALSE_POSITIVE_TEXT) == ['communication']
    assert 'r' in extract_skills_simple('Skills: Python, R, SQL')
    assert 'go' in extract_skills_simple('Built services in Go and Golang')
    assert 'c++' in extract_skills_simple('Languages: C++, Java')
    assert 'node.js' in extract_skills_simple('Backend in NodeJS')


def test_letter_spaced_headings_do_not_create_fake_skills():
    text = 'E X P E R I E N C E\nC E R T I F I C A T I O N S\nCopywriter for brands'
    result = analyze_text(text)
    assert 'r' not in result['skills']
    assert 'experience' in result['ats_analysis']['found_sections']


@pytest.mark.parametrize('phone', ['+91 98765 43210', '(555) 123-4567', '555.123.4567', '+1-555-123-4567'])
def test_common_phone_formats_are_recognised(phone):
    result = check_ats_compatibility(f'jane@example.com {phone} linkedin.com/in/jane')
    contact = next(p for p in result['breakdown'] if p['key'] == 'contact')
    assert contact['score'] == 10


def test_year_ranges_are_not_mistaken_for_phone_numbers():
    result = check_ats_compatibility('jane@example.com\nAcme 2019 - 2021')
    contact = next(p for p in result['breakdown'] if p['key'] == 'contact')
    assert contact['score'] == 4


def test_ordinary_words_are_not_formatting_problems():
    text = STRONG + '\nWorked in a toolbox team, drafted columns for the inbox newsletter, circled back.'
    assert check_ats_compatibility(text)['problematic_elements'] == []


def test_scoring_is_fast():
    start = time.perf_counter()
    for _ in range(20):
        analyze_text(STRONG)
    assert (time.perf_counter() - start) / 20 < 0.05


def test_indian_resume_conventions():
    from models.resume_analyzer import ResumeAnalyzer
    from .sample_resumes import INDIAN_ACCOUNTANT

    result = analyze_text(INDIAN_ACCOUNTANT)
    skills = set(result['skills'])
    assert {'tally', 'gst', 'tds', 'bank reconciliation', 'mis', 'excel'} <= skills
    ats = result['ats_analysis']
    contact = next(p for p in ats['breakdown'] if p['key'] == 'contact')
    assert contact['score'] == 10  # +91 number with dashes is recognised
    assert ats['quantified_achievements'] >= 3  # "Rs 2 crore", "30%", "45 clients"
    assert ats['personal_details'] and any('personal details' in i.lower() for i in ats['issues'])

    analyzer = ResumeAnalyzer()
    education = analyzer._extract_education_info(INDIAN_ACCOUNTANT)
    assert 'BCOM' in education['degrees'] and education['cgpa'] == 8.2
    assert analyzer._extract_contact_info(INDIAN_ACCOUNTANT)['location'] == 'Noida'


def test_short_acronyms_do_not_match_ordinary_words():
    skills = extract_skills_simple('I sap energy, lean on my team and miss deadlines rarely. Ragged edges.')
    assert not {'sap', 'lean', 'mis', 'rag'} & set(skills)
