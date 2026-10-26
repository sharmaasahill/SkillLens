"""Saved AI resume reviews, so the same resume and job description never use the free quota twice.

Revision ID: 0005_ai_results
Revises: 0004_candidate_reviews
Create Date: 2026-10-24
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_ai_results'
down_revision = '0004_candidate_reviews'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resume_id', sa.Integer(), sa.ForeignKey('resumes.id', ondelete='CASCADE')),
        sa.Column('kind', sa.String(30), nullable=False),
        sa.Column('cache_key', sa.String(64), nullable=False),
        sa.Column('model', sa.String(60)),
        sa.Column('result', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime()),
        sa.UniqueConstraint('user_id', 'cache_key', name='uq_ai_results_user_key'),
    )
    op.create_index('ix_ai_results_user_id', 'ai_results', ['user_id'])
    op.create_index('ix_ai_results_resume_id', 'ai_results', ['resume_id'])


def downgrade():
    op.drop_index('ix_ai_results_resume_id', table_name='ai_results')
    op.drop_index('ix_ai_results_user_id', table_name='ai_results')
    op.drop_table('ai_results')
