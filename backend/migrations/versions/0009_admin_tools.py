"""Admin tools: blocked accounts and session versions, an error log, score history, and admin stages.

The admin stages change from hiring words to admin ones:
shortlisted, contacted, interviewing -> follow_up; hired -> verified; rejected -> flagged.

Revision ID: 0009_admin_tools
Revises: 0008_user_reviews
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = '0009_admin_tools'
down_revision = '0008_user_reviews'
branch_labels = None
depends_on = None

STAGES = [
    ("'shortlisted', 'contacted', 'interviewing'", 'follow_up'),
    ("'hired'", 'verified'),
    ("'rejected'", 'flagged'),
]
OLD_STAGES = [('follow_up', 'contacted'), ('verified', 'hired'), ('flagged', 'rejected')]


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('blocked_at', sa.DateTime()))
        batch.add_column(sa.Column('session_version', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'error_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('level', sa.String(10), nullable=False, server_default='error'),
        sa.Column('source', sa.String(120), nullable=False),
        sa.Column('message', sa.String(500), nullable=False),
        sa.Column('detail', sa.Text()),
        sa.Column('status', sa.Integer()),
        sa.Column('path', sa.String(300)),
        sa.Column('user_id', sa.Integer()),
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('first_seen', sa.DateTime()),
        sa.Column('last_seen', sa.DateTime()),
        sa.Column('resolved_at', sa.DateTime()),
    )
    op.create_index('ix_error_logs_fingerprint', 'error_logs', ['fingerprint'])
    op.create_index('ix_error_logs_last_seen', 'error_logs', ['last_seen'])

    op.create_table(
        'resume_scores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resume_id', sa.Integer()),
        sa.Column('filename', sa.String(255)),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_index('ix_resume_scores_user_id', 'resume_scores', ['user_id'])
    # Every saved resume's current score becomes the first point of its history
    op.execute("""
        INSERT INTO resume_scores (user_id, resume_id, filename, score, created_at)
        SELECT user_id, id, filename, score, uploaded_at FROM resumes WHERE score IS NOT NULL
    """)

    for old, new in STAGES:
        op.execute(f"UPDATE user_reviews SET status = '{new}' WHERE status IN ({old})")


def downgrade():
    for new, old in OLD_STAGES:
        op.execute(f"UPDATE user_reviews SET status = '{old}' WHERE status = '{new}'")
    op.drop_index('ix_resume_scores_user_id', table_name='resume_scores')
    op.drop_table('resume_scores')
    op.drop_index('ix_error_logs_last_seen', table_name='error_logs')
    op.drop_index('ix_error_logs_fingerprint', table_name='error_logs')
    op.drop_table('error_logs')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('session_version')
        batch.drop_column('blocked_at')
