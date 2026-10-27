"""Remove the old age columns. Date of birth (added in 0011) replaced them.

An age cannot be turned into a date of birth, so the old values are simply dropped.

Revision ID: 0013_drop_age
Revises: 0012_profile_picture
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0013_drop_age'
down_revision = '0012_profile_picture'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('profile_history') as batch:
        batch.drop_column('age')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('age')


def downgrade():
    # Brings the columns back empty; the dropped values cannot be restored
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('age', sa.Integer()))
    with op.batch_alter_table('profile_history') as batch:
        batch.add_column(sa.Column('age', sa.Integer()))
