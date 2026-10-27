"""Profile photos: upload, load, replace, remove, and removal with the account."""
import io

from models.database import StoredFile, User

from .conftest import PASSWORD

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 64


def _upload(client, headers, data, name='me.png'):
    return client.post('/profile/picture', headers=headers, data={'file': (io.BytesIO(data), name)},
                       content_type='multipart/form-data')


def _photos():
    return StoredFile.query.filter(StoredFile.path.like('users/%/picture/%')).count()


def test_photo_upload_load_replace_and_remove(client, user_session):
    assert client.get('/profile/picture').status_code == 404
    # Checked by its bytes, not its name
    assert _upload(client, user_session, b'<svg onload="alert(1)"/>', 'evil.png').status_code == 400

    saved = _upload(client, user_session, PNG)
    assert saved.status_code == 200 and saved.get_json()['picture']
    assert client.get('/auth/me').get_json()['user']['picture'] == saved.get_json()['picture']
    photo = client.get('/profile/picture')
    assert photo.status_code == 200 and photo.mimetype == 'image/png' and photo.data == PNG
    assert photo.headers['Cache-Control'].startswith('private')

    assert _upload(client, user_session, JPEG, 'me.jpg').status_code == 200
    assert client.get('/profile/picture').mimetype == 'image/jpeg' and _photos() == 1  # the old one is gone

    assert client.delete('/profile/picture', headers=user_session).status_code == 200
    assert client.get('/profile/picture').status_code == 404 and _photos() == 0
    user = User.query.filter_by(email='user@example.com').one()
    assert user.picture_source == 'removed' and client.get('/auth/me').get_json()['user']['picture'] is None


def test_photo_is_deleted_with_the_account(client, user_session):
    _upload(client, user_session, PNG)
    assert _photos() == 1
    assert client.post('/profile/delete', headers=user_session, json={'password': PASSWORD}).status_code == 200
    assert _photos() == 0
