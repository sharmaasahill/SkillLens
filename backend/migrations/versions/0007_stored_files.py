"""Keep uploaded resume PDFs in the database, so they survive hosts that wipe the disk on restart.

Revision ID: 0007_stored_files
Revises: 0006_job_search
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_stored_files'
down_revision = '0006_job_search'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stored_files',
        sa.Column('path', sa.String(255), primary_key=True),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime()),
    )


def downgrade():
    op.drop_table('stored_files')
