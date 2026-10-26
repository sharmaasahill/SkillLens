"""Live job search: searches and the cached jobs each source returned.

Revision ID: 0006_job_search
Revises: 0005_ai_results
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa

revision = '0006_job_search'
down_revision = '0005_ai_results'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'job_searches',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('results', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_index('ix_job_searches_user_id', 'job_searches', ['user_id'])
    op.create_table(
        'job_source_results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('query_key', sa.String(64), nullable=False),
        sa.Column('status', sa.String(12), nullable=False),
        sa.Column('jobs', sa.Text()),
        sa.Column('error', sa.String(300)),
        sa.Column('started_at', sa.DateTime()),
        sa.Column('finished_at', sa.DateTime()),
    )
    op.create_index('ix_job_source_results_lookup', 'job_source_results', ['source', 'query_key'])


def downgrade():
    op.drop_index('ix_job_source_results_lookup', table_name='job_source_results')
    op.drop_table('job_source_results')
    op.drop_index('ix_job_searches_user_id', table_name='job_searches')
    op.drop_table('job_searches')
