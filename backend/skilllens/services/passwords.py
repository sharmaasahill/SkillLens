"""Refuse passwords that are easy to guess, such as "password123", "India@2026" or a run of digits.

It works offline (no outside service): a password is turned into its "base word" by undoing common
letter swaps (0 for o, @ for a...) and dropping digits and symbols, then checked against common
words, the site's name and the person's own email and name.
"""
import re

from flask import current_app, has_app_context
from werkzeug.security import generate_password_hash

from ..errors import ApiError

# PBKDF2-SHA256 with 600,000 rounds (the OWASP recommendation). Werkzeug 3.1's default of 1,000,000
# takes several seconds per sign-in on a small shared CPU such as Render's free plan.
HASH_METHOD = 'pbkdf2:sha256:600000'


def hash_password(password):
    method = current_app.config.get('PASSWORD_HASH_METHOD', HASH_METHOD) if has_app_context() else HASH_METHOD
    return generate_password_hash(password, method=method)

# Base words that appear in most leaked-password lists, plus local favourites
COMMON_WORDS = {
    'password', 'passwd', 'pass', 'qwerty', 'qwertyuiop', 'qwertyui', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcvbnm',
    'qazwsx', 'qazwsxedc', 'zaqwsx', 'iloveyou', 'loveyou', 'mylove', 'love', 'welcome', 'admin', 'administrator',
    'letmein', 'login', 'user', 'guest', 'test', 'tester', 'default', 'changeme', 'secret', 'master', 'monkey',
    'dragon', 'shadow', 'sunshine', 'princess', 'football', 'baseball', 'cricket', 'superman', 'batman', 'starwars',
    'pokemon', 'freedom', 'whatever', 'trustno', 'computer', 'internet', 'hello', 'hellohello', 'money', 'google',
    'samsung', 'apple', 'iphone', 'mobile', 'india', 'bharat', 'hindustan', 'jaihind', 'krishna', 'ganesh', 'ganesha',
    'sairam', 'omsairam', 'jesus', 'allah', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'aaaa', 'skilllens',
    'skill', 'lens', 'resume', 'salary', 'job', 'jobs',
}
LEET = str.maketrans({'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i'})
SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']
MESSAGE = 'This password is too easy to guess. Try a longer phrase, for example three unrelated words.'


def _base(text):
    """The word under the padding: "P@ssw0rd!!" -> "password", "India@2026" -> "india".

    Digits and symbols at the ends are padding and are dropped first; letter swaps inside are undone.
    """
    core = re.sub(r'^[^a-z]+|[^a-z]+$', '', text.lower())
    return re.sub(r'[^a-z]', '', core.translate(LEET))


def _is_sequence(text):
    low = text.lower()
    if len(set(low)) <= 2:
        return True  # "aaaaaaaa", "abababab"
    return any(low in seq or low in seq[::-1] for seq in SEQUENCES)


def check(password, email=None, name=None):
    """Raise ApiError(400) when the password is easy to guess."""
    password = password or ''
    if len(password) < 8:
        raise ApiError('Use at least 8 characters.', 400)
    if password.isdigit() and len(password) < 12:
        raise ApiError('A password of only digits is easy to guess. Add some letters or words.', 400)
    if _is_sequence(password):
        raise ApiError(MESSAGE, 400)

    base = _base(password)
    personal = set()
    if email:
        local = email.split('@')[0].lower()
        personal |= {_base(local), *(_base(p) for p in re.split(r'[._\-+]', local))}
    if name:
        personal |= {_base(part) for part in name.split()} | {_base(name)}
    personal = {p for p in personal if len(p) >= 3}

    if not base or base in COMMON_WORDS or base in personal or _is_sequence(base):
        raise ApiError(MESSAGE, 400)
    # A common word with a little added ("mypassword", "passwordxyz") is just as weak
    if any(len(word) >= 5 and word in base and len(base) - len(word) <= 3 for word in COMMON_WORDS | personal):
        raise ApiError(MESSAGE, 400)
    # A common word or your own name plus a few digits ("rahul1995") is just as easy to guess
    letters_only = re.sub(r'[^A-Za-z]', '', password)
    if len(letters_only) < 4 and len(password) < 12:
        raise ApiError(MESSAGE, 400)
