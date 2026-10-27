"""Maintenance commands: flask --app app <command>."""
import os
import shutil

import click
from flask import Flask

from models.database import Resume
from models.resume_analyzer import analyze_text

from .extensions import db


def register_commands(app: Flask):
    @app.cli.command('admin-2fa-off')
    @click.option('--yes', is_flag=True, help='Do not ask for confirmation.')
    def admin_2fa_off(yes):
        """Turn off two-factor sign-in for the admin (the phone and the recovery codes are both lost).

        Run it where DATABASE_URL points to the right database. Turn it on again from the dashboard.
        """
        from models.database import User
        from .services import two_factor

        admin = User.query.filter_by(is_admin=True).first()
        if admin is None or not two_factor.enabled(admin):
            click.echo('Two-factor sign-in is not on for any admin account.')
            return
        if not yes:
            click.confirm(f'Turn off two-factor sign-in for {admin.email}?', abort=True)
        two_factor.disable(admin)
        click.echo(f'Two-factor sign-in is off for {admin.email}. Sign in with the password and set it up again.')

    @app.cli.command('cleanup')
    def cleanup_command():
        """Delete old cached job results, old job searches and old usage counters now."""
        from .services import maintenance

        for name, count in maintenance.cleanup().items():
            click.echo(f'{name}: deleted {count}')

    @app.cli.command('reset-data')
    @click.option('--yes', is_flag=True, help='Do not ask for confirmation.')
    def reset_data(yes):
        """Delete every account (users and admin) and everything they created.

        Runs on whichever database DATABASE_URL points to (local SQLite by default). Tables stay,
        and so do today's paid-API usage counters, so daily budgets still hold. The admin account
        comes back on its next sign-in. Resume files on this computer are removed only for the
        local SQLite database, because a live database's files are not stored here.
        """
        url = db.engine.url
        where = url.render_as_string(hide_password=True)
        if not yes:
            click.confirm(f'Delete ALL accounts and their data in {where}?', abort=True)

        keep = {'api_usage'}
        counts = {}
        for table in reversed(db.metadata.sorted_tables):  # children before parents
            if table.name in keep:
                continue
            counts[table.name] = db.session.execute(table.delete()).rowcount
        db.session.commit()
        for name, count in sorted(counts.items()):
            click.echo(f'{name}: deleted {count} rows')

        if url.get_backend_name() == 'sqlite':
            root = os.path.abspath(app.config['UPLOAD_FOLDER'])
            removed = 0
            for entry in os.listdir(root) if os.path.isdir(root) else []:
                path = os.path.join(root, entry)
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
                removed += 1
            click.echo(f'Removed {removed} items from {root}')
        click.echo(f'Done: {where} is empty.')

    @app.cli.command('rescore-resumes')
    @click.option('--dry-run', is_flag=True, help='Show the new scores without saving them.')
    def rescore_resumes(dry_run):
        """Re-run skill extraction and ATS scoring on every stored resume.

        Uses the text saved at upload time, so the PDF files are not needed.
        Run this after changing the scoring rules.
        """
        changed = skipped = 0
        for resume in Resume.query.order_by(Resume.id).all():
            if not (resume.raw_text or '').strip():
                skipped += 1
                continue
            result = analyze_text(resume.raw_text)
            new_score = result['ats_analysis']['score']
            click.echo(f'#{resume.id} {resume.filename}: {resume.score} -> {new_score}')
            if not dry_run:
                resume.score = new_score
                resume.set_skills(result['skills'])
            changed += 1
        if not dry_run:
            db.session.commit()
        click.echo(f"{'Would rescore' if dry_run else 'Rescored'} {changed} resumes; skipped {skipped} without stored text.")

    @app.cli.command('build-india-data')
    @click.option('--download', is_flag=True, help='Download the raw CSV again even if it exists.')
    @click.option('--skip-training', is_flag=True, help='Only rebuild the cleaned dataset.')
    def build_india_data(download, skip_training):
        """Download the Naukri.com 2025 dataset, clean it and retrain the salary model.

        Writes data/india_jobs.csv.gz and models/india_salary_model.pkl. Takes about two minutes.
        """
        from models import india_data, salary_model

        click.echo('Downloading raw dataset...' if download or not __import__('os').path.exists(india_data.RAW_PATH)
                   else 'Using existing raw dataset.')
        india_data.download_raw(force=download)
        jobs = india_data.build_clean_dataset()
        click.echo(f'Cleaned {len(jobs):,} postings -> {india_data.CLEAN_PATH}')
        if skip_training:
            return
        click.echo('Training salary model (about a minute)...')
        model = salary_model.train()
        m = model.metrics
        click.echo(f"Trained on {m['trained_on_rows']:,} salaries. On held-out companies: "
                   f"median error {m['quick']['median_error_pct']}%, "
                   f"{m['quick']['within_25_pct']}% of estimates within 25%.")

    @app.cli.command('check-job-sources')
    @click.option('--role', default='Software Engineer', show_default=True, help='Role to search for.')
    @click.option('--city', default='Bengaluru', show_default=True, help='City to search in ("" for anywhere in India).')
    @click.option('--only', default='', help='Comma-separated sources to check, e.g. "jsearch,apify_naukri".')
    @click.option('--paid', is_flag=True, help='Also check sources with a limited free quota (each uses one search).')
    def check_job_sources(role, city, only, paid):
        """Check which live job sources are set up and answering, with one small search each.

        Without --paid, only sources with no quota are called (career pages and remote boards);
        keyed sources are listed as set up or not. Nothing is saved.
        """
        import time

        from .services import quota
        from .services.jobs import sources
        from .services.jobs.common import SourceError

        chosen = {s.strip() for s in only.split(',') if s.strip()}
        search = {'role': role, 'city': city, 'days': 14, 'remote_only': False}
        click.echo(f'Searching for "{role}" in {city or "India"}, last 14 days\n')
        for name, src in sources.SOURCES.items():
            if chosen and name not in chosen:
                continue
            label = f'{src.label} ({name})'.ljust(34)
            if not sources.configured(src):
                missing = ', '.join(k for k in src.needs if not app.config.get(k)) or 'turned off in JOB_SOURCES_DISABLED'
                click.echo(f'{label} not set up: add {missing}' if src.needs else f'{label} off: {missing}')
                continue
            if src.needs and not paid and not chosen:
                click.echo(f'{label} key found (run with --paid to test; uses 1 of {sources.daily_limit(src)} daily searches)')
                continue
            if src.needs and not quota.take(f'jobs-{name}', sources.daily_limit(src)):
                click.echo(f"{label} skipped: today's {sources.daily_limit(src)} searches are used up")
                continue
            started = time.perf_counter()
            try:
                jobs = sources.fetch(name, search)
                took = time.perf_counter() - started
                sample = f' e.g. "{jobs[0]["title"]}" at {jobs[0]["company"]}' if jobs else ''
                click.echo(f'{label} OK: {len(jobs)} jobs in {took:.1f}s{sample}')
            except SourceError as exc:
                click.echo(f'{label} FAILED: {exc.message}')
