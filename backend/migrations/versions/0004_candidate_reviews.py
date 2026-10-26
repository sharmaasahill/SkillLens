"""Admin reviews of users (status, note, removed from the list) and user activity time.

Revision ID: 0004_candidate_reviews
Revises: 0003_primary_resume
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_candidate_reviews'
down_revision = '0003_primary_resume'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('last_active_at', sa.DateTime()))
    op.create_table(
        'candidate_reviews',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('status', sa.String(20)),
        sa.Column('note', sa.Text()),
        sa.Column('hidden_at', sa.DateTime()),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('updated_at', sa.DateTime()),
    )


def downgrade():
    op.drop_table('candidate_reviews')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('last_active_at')
