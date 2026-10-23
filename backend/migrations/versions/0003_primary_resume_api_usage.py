"""Primary resume flag, and a daily counter for quota-limited external APIs.

Each user's most recent resume becomes their primary one.

Revision ID: 0003_primary_resume
Revises: 0002_unique_storage
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_primary_resume'
down_revision = '0002_unique_storage'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('resumes') as batch:
        batch.add_column(sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.false()))

    # Latest upload per user (ties broken by id) becomes primary
    op.execute("""
        UPDATE resumes SET is_primary = 1
        WHERE id IN (
            SELECT r.id FROM resumes r
            WHERE NOT EXISTS (
                SELECT 1 FROM resumes newer
                WHERE newer.user_id = r.user_id
                  AND (newer.uploaded_at > r.uploaded_at
                       OR (newer.uploaded_at = r.uploaded_at AND newer.id > r.id))
            )
        )
    """)

    op.create_table(
        'api_usage',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('provider', sa.String(40), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('calls', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('provider', 'day', name='uq_api_usage_provider_day'),
    )


def downgrade():
    op.drop_table('api_usage')
    with op.batch_alter_table('resumes') as batch:
        batch.drop_column('is_primary')
