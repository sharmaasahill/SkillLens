"""Rename candidate_reviews to user_reviews: SkillLens has only users and one admin.

Revision ID: 0008_user_reviews
Revises: 0007_stored_files
Create Date: 2026-10-26
"""
from alembic import op

revision = '0008_user_reviews'
down_revision = '0007_stored_files'
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table('candidate_reviews', 'user_reviews')


def downgrade():
    op.rename_table('user_reviews', 'candidate_reviews')
