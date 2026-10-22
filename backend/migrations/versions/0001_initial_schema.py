"""Initial schema: users, profile_history, resumes.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-22

Existing databases created before migrations were added already have these tables.
Mark them as up to date with:  flask --app app db stamp 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def _profile_columns():
    return [
        sa.Column('full_name', sa.String(100)),
        sa.Column('phone_number', sa.String(20)),
        sa.Column('address', sa.String(200)),
        sa.Column('age', sa.Integer()),
        sa.Column('current_work', sa.String(150)),
        sa.Column('current_company', sa.String(150)),
        sa.Column('current_location', sa.String(150)),
        sa.Column('total_experience', sa.Float()),
        sa.Column('linkedin_url', sa.String(300)),
        sa.Column('website_url', sa.String(300)),
        sa.Column('bio', sa.Text()),
        sa.Column('profile_resume_filename', sa.String(255)),
        sa.Column('skills_summary', sa.Text()),
        sa.Column('education', sa.String(300)),
        sa.Column('certifications', sa.Text()),
        sa.Column('languages', sa.String(200)),
        sa.Column('achievements', sa.Text()),
    ]


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(120), nullable=False, unique=True),
        sa.Column('password', sa.String(200), nullable=False),
        *_profile_columns(),
        sa.Column('profile_resume_uploaded_at', sa.DateTime()),
        sa.Column('is_admin', sa.Boolean(), server_default=sa.false()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_table(
        'profile_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        *_profile_columns(),
        sa.Column('changed_at', sa.DateTime()),
    )
    op.create_table(
        'resumes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('skills', sa.Text()),
        sa.Column('score', sa.Float()),
        sa.Column('raw_text', sa.Text()),
        sa.Column('uploaded_at', sa.DateTime()),
    )


def downgrade():
    op.drop_table('resumes')
    op.drop_table('profile_history')
    op.drop_table('users')
