"""Date of birth instead of age, on accounts and in profile history.

An age cannot be turned into a date of birth, so people who had only an age are asked for their
date of birth on their next visit. The old `age` columns are removed in 0013.

Revision ID: 0011_date_of_birth
Revises: 0010_security
Create Date: 2026-10-29
"""
from alembic import op
import sqlalchemy as sa

revision = '0011_date_of_birth'
down_revision = '0010_security'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('date_of_birth', sa.Date()))
    with op.batch_alter_table('profile_history') as batch:
        batch.add_column(sa.Column('date_of_birth', sa.Date()))


def downgrade():
    with op.batch_alter_table('profile_history') as batch:
        batch.drop_column('date_of_birth')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('date_of_birth')
