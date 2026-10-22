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
