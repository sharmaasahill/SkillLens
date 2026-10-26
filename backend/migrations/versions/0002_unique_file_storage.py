"""Unique file storage paths for resumes, plus indexes for admin user queries.

Revision ID: 0002_unique_storage
Revises: 0001_initial
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_unique_storage'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('resumes') as batch:
        batch.add_column(sa.Column('stored_filename', sa.String(255)))
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('profile_resume_path', sa.String(255)))

    op.create_index('ix_resumes_user_id', 'resumes', ['user_id'])
    op.create_index('ix_profile_history_user_id', 'profile_history', ['user_id'])


def downgrade():
    op.drop_index('ix_profile_history_user_id', table_name='profile_history')
    op.drop_index('ix_resumes_user_id', table_name='resumes')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('profile_resume_path')
    with op.batch_alter_table('resumes') as batch:
        batch.drop_column('stored_filename')
