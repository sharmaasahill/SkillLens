"""Maintenance commands: flask --app app <command>."""
import click
from flask import Flask

from models.database import Resume
from models.resume_analyzer import analyze_text

from .extensions import db


def register_commands(app: Flask):
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
