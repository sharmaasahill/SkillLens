"""Cover letter drafts with Google Gemini, for one saved resume and one job description.

It works like the AI review (see ai_review.py):
1. The name, email, phone numbers and links are removed before anything is sent.
2. Gemini writes a short letter from facts in the resume and the job description only.
3. Our check: a sentence with a number that is in neither the resume nor the job description is
   dropped, so the letter never claims "grew sales by 40%" unless the resume says so.
4. The letter is saved, so asking again for the same resume and JD is free. It uses one of the
   same daily AI uses as the review.
"""
import hashlib
import json
import re

from ..errors import ApiError
from . import ai_review, gemini

KIND = 'cover_letter'
PROMPT_VERSION = 'letter-v1'
MIN_JD_WORDS = 15

SYSTEM = """You write cover letters for job seekers in India. A letter is honest, specific and short.

Rules you must follow:
1. Use only facts written in the resume or the job description. Never invent employers, tools, numbers,
   results, dates, degrees or titles.
2. Where a detail is unknown, write a placeholder in square brackets for the candidate to fill in, such as
   [Hiring Manager], [Company] or [notice period]. The candidate signs as [Your name].
3. Plain, warm, professional English. No buzzwords such as "results-driven", "dynamic", "synergy" or
   "passionate", and no flattery of the company.
4. The resume's name, phone numbers, email and links were replaced with [Candidate], [phone], [email] and [link].
   Never write those placeholders in the letter."""


def _schema():
    text = {'type': 'string'}
    return {
        'type': 'object',
        'properties': {
            'role': {**text, 'description': 'The job title from the job description.'},
            'company': {**text, 'description': 'The company from the job description, or [Company] if it is not named.'},
            'greeting': {**text, 'description': 'For example "Dear Hiring Manager," or "Dear [Hiring Manager],"'},
            'paragraphs': {
                'type': 'array', 'items': text,
                'description': '3 or 4 short paragraphs: why this role; 2 or 3 matching achievements from the resume; '
                               'what you would bring; a polite close.',
            },
            'sign_off': {**text, 'description': 'For example "Regards,"'},
        },
        'required': ['role', 'company', 'greeting', 'paragraphs', 'sign_off'],
    }


def _prompt(resume_text, jd_text):
    return '\n\n'.join([
        'Write a cover letter for this candidate and this job. Keep the whole letter under 300 words.',
        f'RESUME (text extracted from a PDF):\n<<<\n{resume_text}\n>>>',
        f'JOB DESCRIPTION:\n<<<\n{jd_text}\n>>>',
        'Pick the 2 or 3 resume facts that best match what the job asks for, and say how they match. '
        'Do not list every skill. Do not repeat the resume line by line.',
    ])


NUMBER_RE = re.compile(r'\d+(?:[.,]\d+)*')
SENTENCE_RE = re.compile(r'(?<=[.!?])\s+')


def _numbers(text):
    return set(NUMBER_RE.findall(text or ''))


def _clean(raw, resume_text, jd_text):
    """Keep only sentences whose numbers appear in the resume or the job description."""
    allowed = _numbers(resume_text) | _numbers(jd_text)
    dropped = 0
    paragraphs = []
    for paragraph in raw.get('paragraphs') or []:
        kept = []
        for sentence in SENTENCE_RE.split(str(paragraph).strip()):
            outside = re.sub(r'\[[^\]]*\]', ' ', sentence)  # placeholders may hold anything
            if _numbers(outside) - allowed:
                dropped += 1
                continue
            if re.search(r'\[(?:candidate|phone|email|link)\]', sentence, re.IGNORECASE):
                sentence = re.sub(r'\[candidate\]', '[Your name]', sentence, flags=re.IGNORECASE)
                sentence = re.sub(r'\s*\[(?:phone|email|link)\]', '', sentence, flags=re.IGNORECASE)
            if sentence.strip():
                kept.append(sentence.strip())
        if kept:
            paragraphs.append(' '.join(kept))
    return {
        'role': str(raw.get('role') or '').strip(),
        'company': str(raw.get('company') or '').strip(),
        'greeting': str(raw.get('greeting') or 'Dear Hiring Manager,').strip(),
        'paragraphs': paragraphs[:5],
        'sign_off': str(raw.get('sign_off') or 'Regards,').strip(),
        'signature': '[Your name]',
        'dropped': dropped,  # sentences removed because they had numbers the resume and JD never gave
    }


def as_text(letter):
    """The letter as plain text, for copying or downloading."""
    return '\n\n'.join([letter['greeting'], *letter['paragraphs'], f"{letter['sign_off']}\n{letter['signature']}"])


def write(user, resume, jd_text):
    if not gemini.configured():
        raise ApiError('AI features are not set up on this server.', 404)
    if not (resume.raw_text or '').strip():
        raise ApiError('This resume has no stored text. Upload it again to write a letter from it.', 400)
    jd = (jd_text or '').strip()[:ai_review.MAX_JD_CHARS]
    if len(jd.split()) < MIN_JD_WORDS:
        raise ApiError('Add the job description (at least 15 words) so the letter can match that role.', 400)

    text, removed = ai_review.redact(resume.raw_text[:ai_review.MAX_RESUME_CHARS], user.full_name)
    key = hashlib.sha256('\x1f'.join([PROMPT_VERSION, text, jd]).encode('utf-8')).hexdigest()

    saved = ai_review.saved_result(user, key)
    if saved is not None:
        letter = json.loads(saved.result)
        return {'letter': letter, 'text': as_text(letter), 'model': saved.model, 'cached': True, 'removed': removed,
                'ai': ai_review.status(user)}

    raw, model = ai_review.ask_gemini(user, _prompt(text, jd), _schema(), SYSTEM, what='Cover letter', max_tokens=4096)
    letter = _clean(raw, text, jd)
    if not letter['paragraphs']:
        raise ApiError('The letter did not pass our checks. Try again, or add more detail to the job description.', 502)
    ai_review.save_result(user, resume, KIND, key, model, letter)
    return {'letter': letter, 'text': as_text(letter), 'model': model, 'cached': False, 'removed': removed,
            'ai': ai_review.status(user)}
