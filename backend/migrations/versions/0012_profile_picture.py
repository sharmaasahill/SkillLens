"""Profile photos: uploaded on the Profile page, or copied from Google at Google sign-in.

The image itself is a row in stored_files (users/<id>/picture/<random>.<ext>).

Revision ID: 0012_profile_picture
Revises: 0011_date_of_birth
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0012_profile_picture'
down_revision = '0011_date_of_birth'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('picture_path', sa.String(255)))
        batch.add_column(sa.Column('picture_source', sa.String(10)))
        batch.add_column(sa.Column('picture_updated_at', sa.DateTime()))


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('picture_updated_at')
        batch.drop_column('picture_source')
        batch.drop_column('picture_path')
