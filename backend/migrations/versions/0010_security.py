"""Security: two-factor sign-in, Google sign-in, and privacy consent on accounts.

Revision ID: 0010_security
Revises: 0009_admin_tools
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = '0010_security'
down_revision = '0009_admin_tools'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('totp_secret', sa.String(64)))
        batch.add_column(sa.Column('totp_pending_secret', sa.String(64)))
        batch.add_column(sa.Column('totp_enabled_at', sa.DateTime()))
        batch.add_column(sa.Column('totp_last_step', sa.BigInteger()))
        batch.add_column(sa.Column('recovery_codes', sa.Text()))
        batch.add_column(sa.Column('google_sub', sa.String(64)))
        batch.add_column(sa.Column('has_password', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column('privacy_accepted_at', sa.DateTime()))
        batch.add_column(sa.Column('privacy_version', sa.String(20)))
        batch.create_index('ix_users_google_sub', ['google_sub'], unique=True)


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_index('ix_users_google_sub')
        for column in ('privacy_version', 'privacy_accepted_at', 'has_password', 'google_sub', 'recovery_codes',
                       'totp_last_step', 'totp_enabled_at', 'totp_pending_secret', 'totp_secret'):
            batch.drop_column(column)
